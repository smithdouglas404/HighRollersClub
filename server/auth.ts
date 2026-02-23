import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import createMemoryStore from "memorystore";
import { type Express, type Request } from "express";
import { storage } from "./storage";
import { type User } from "@shared/schema";
import { randomUUID } from "crypto";

// Simple password hashing using Web Crypto (no bcrypt dependency needed)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = randomUUID();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return `${salt}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex === hash;
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
  const MemoryStore = createMemoryStore(session);

  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || "poker-platform-dev-secret-" + randomUUID(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
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

// Auth route handlers
export function registerAuthRoutes(app: Express) {
  // Create guest account
  app.post("/api/auth/guest", async (req, res, next) => {
    try {
      const guestName = generateGuestName();
      const user = await storage.createUser({
        username: guestName.toLowerCase(),
        password: await hashPassword(randomUUID()), // random password
        displayName: guestName,
        role: "guest",
        chipBalance: 10000,
      });

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
    try {
      const { username, password, displayName } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ message: "Username must be 3-20 characters" });
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

      const safeUser = sanitizeUser(user);
      req.login(safeUser, (err) => {
        if (err) return next(err);
        res.json(safeUser);
      });
    } catch (err) {
      next(err);
    }
  });

  // Login
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Login failed" });
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
