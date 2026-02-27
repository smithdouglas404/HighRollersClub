import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { type Express, type Request } from "express";
import { storage } from "./storage";
import { hasDatabase, getPool } from "./db";
import { type User } from "@shared/schema";
import { randomUUID, scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const hashBuffer = Buffer.from(hash, "hex");
  return timingSafeEqual(derived, hashBuffer);
}

// Extend Express types for session user
declare global {
  namespace Express {
    interface User extends Omit<import("@shared/schema").User, "password"> {}
  }
}

declare module "express-session" {
  interface SessionData {
    passport: { user: string };
  }
}

export function setupAuth(app: Express) {
  // Use PostgreSQL session store when database is available, otherwise fall back to memory store
  let store: session.Store;
  if (hasDatabase()) {
    const PgSession = connectPgSimple(session);
    store = new PgSession({
      pool: getPool(),
      createTableIfMissing: true,
    });
  } else {
    const MemoryStore = createMemoryStore(session);
    store = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }

  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || "poker-platform-dev-secret-change-me-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
    store,
  });

  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport local strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) return done(null, false, { message: "Invalid username or password" });

        const valid = await verifyPassword(password, user.password);
        if (!valid) return done(null, false, { message: "Invalid username or password" });

        return done(null, sanitizeUser(user));
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      done(null, sanitizeUser(user));
    } catch (err) {
      done(err);
    }
  });

  // Return session middleware for WebSocket auth
  return sessionMiddleware;
}

// Strip password from user object
function sanitizeUser(user: User): Express.User {
  const { password, ...safe } = user;
  return safe;
}

// Generate random guest name
function generateGuestName(): string {
  const adjectives = ["Lucky", "Bold", "Swift", "Dark", "Neon", "Cyber", "Shadow", "Royal", "Iron", "Ghost"];
  const nouns = ["Ace", "King", "Shark", "Wolf", "Hawk", "Fox", "Tiger", "Viper", "Phoenix", "Dragon"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 999);
  return `${adj}${noun}${num}`;
}

// Avatar IDs that can be randomly assigned to guest users
const GUEST_AVATAR_IDS = [
  "neon-viper", "chrome-siren", "gold-phantom", "shadow-king",
  "red-wolf", "ice-queen", "tech-monk", "cyber-punk",
  "steel-ghost", "neon-fox", "dark-ace", "bolt-runner",
];

// Rate limiting for registration/guest creation
const registrationAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_REG_ATTEMPTS = 5;
const REG_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRegistrationRate(req: Request): boolean {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const attempts = registrationAttempts.get(ip);
  if (attempts) {
    if (now < attempts.resetAt) {
      if (attempts.count >= MAX_REG_ATTEMPTS) return false;
      attempts.count++;
    } else {
      registrationAttempts.set(ip, { count: 1, resetAt: now + REG_WINDOW_MS });
    }
  } else {
    registrationAttempts.set(ip, { count: 1, resetAt: now + REG_WINDOW_MS });
  }
  return true;
}

// Auth route handlers
export function registerAuthRoutes(app: Express) {
  // Create guest account
  app.post("/api/auth/guest", async (req, res, next) => {
    if (!checkRegistrationRate(req)) {
      return res.status(429).json({ message: "Too many accounts created. Try again later." });
    }
    try {
      const guestName = generateGuestName();
      const randomAvatar = GUEST_AVATAR_IDS[Math.floor(Math.random() * GUEST_AVATAR_IDS.length)];
      const user = await storage.createUser({
        username: guestName.toLowerCase(),
        password: await hashPassword(randomUUID()), // random password
        displayName: guestName,
        role: "guest",
        chipBalance: 10000,
        avatarId: randomAvatar,
      });

      // Create wallets and seed main wallet with starting chips
      const wallets = await storage.ensureWallets(user.id);
      await storage.atomicAddToWallet(user.id, "main", 10000);

      const safeUser = sanitizeUser(user);
      req.login(safeUser, (err) => {
        if (err) return next(err);
        res.json(safeUser);
      });
    } catch (err) {
      next(err);
    }
  });

  // Register with username + password
  app.post("/api/auth/register", async (req, res, next) => {
    if (!checkRegistrationRate(req)) {
      return res.status(429).json({ message: "Too many registration attempts. Try again later." });
    }
    try {
      const { username, password, displayName } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ message: "Username must be 3-20 characters" });
      }
      // #10: Reject HTML special chars to prevent XSS in non-React contexts
      if (/[<>&"'/\\]/.test(username)) {
        return res.status(400).json({ message: "Username contains invalid characters" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }

      const hashedPassword = await hashPassword(password);

      // If currently logged in as guest, upgrade the account
      if (req.user && req.user.role === "guest") {
        const updated = await storage.updateUser(req.user.id, {
          username,
          password: hashedPassword,
          displayName: displayName || username,
          role: "member",
        });
        if (updated) {
          const safeUser = sanitizeUser(updated);
          req.login(safeUser, (err) => {
            if (err) return next(err);
            res.json(safeUser);
          });
          return;
        }
      }

      const user = await storage.createUser({
        username,
        password: hashedPassword,
        displayName: displayName || username,
        role: "member",
        chipBalance: 10000,
      });

      // Create wallets and seed main wallet with starting chips
      await storage.ensureWallets(user.id);
      await storage.atomicAddToWallet(user.id, "main", 10000);

      const safeUser = sanitizeUser(user);
      req.login(safeUser, (err) => {
        if (err) return next(err);
        res.json(safeUser);
      });
    } catch (err) {
      next(err);
    }
  });

  // Rate limiting for login attempts
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  // Login
  app.post("/api/auth/login", (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const attempts = loginAttempts.get(ip);
    if (attempts) {
      if (now < attempts.resetAt) {
        if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
          return res.status(429).json({ message: "Too many login attempts. Try again in 15 minutes." });
        }
      } else {
        loginAttempts.delete(ip);
      }
    }

    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) {
        const current = loginAttempts.get(ip) || { count: 0, resetAt: now + LOGIN_WINDOW_MS };
        current.count++;
        loginAttempts.set(ip, current);
        return res.status(401).json({ message: info?.message || "Login failed" });
      }
      loginAttempts.delete(ip);
      req.login(user, (err) => {
        if (err) return next(err);
        res.json(user);
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  // Get current user
  app.get("/api/auth/me", (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    res.json(req.user);
  });
}

// Middleware to require authentication
export function requireAuth(req: Request, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export { hashPassword, verifyPassword };
