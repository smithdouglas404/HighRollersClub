import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { type Express, type Request } from "express";
import { storage } from "./storage";
import { hasDatabase, getPool } from "./db";
import { type User } from "@shared/schema";
import { randomUUID, scrypt, randomBytes, timingSafeEqual, createHmac, createHash } from "crypto";
import { promisify } from "util";
import nodemailer from "nodemailer";

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

function verifyTOTP(secret: string, code: string): boolean {
  const time = Math.floor(Date.now() / 30000); // 30-second window
  for (let i = -1; i <= 1; i++) { // Check current, previous, and next window
    const hmac = createHmac("sha1", Buffer.from(secret, "hex"));
    const timeVal = time + i;
    hmac.update(Buffer.from([
      (timeVal >> 24) & 0xff,
      (timeVal >> 16) & 0xff,
      (timeVal >> 8) & 0xff,
      timeVal & 0xff,
      0, 0, 0, 0,
    ]));
    const hash = hmac.digest();
    const offset = hash[hash.length - 1] & 0x0f;
    const otp =
      ((hash[offset] & 0x7f) << 24 |
        hash[offset + 1] << 16 |
        hash[offset + 2] << 8 |
        hash[offset + 3]) % 1000000;
    if (otp.toString().padStart(6, "0") === code) return true;
  }
  return false;
}

// Extend Express types for session user
declare global {
  namespace Express {
    interface User extends Omit<import("@shared/schema").User, "password" | "twoFactorSecret"> {}
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

// Strip sensitive fields from user object
function sanitizeUser(user: User): Express.User {
  const { password, twoFactorSecret, ...safe } = user;
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
      const tempId = randomUUID();
      const memberId = "HR-" + createHash("sha256").update(tempId + Date.now().toString()).digest("hex").substring(0, 8);
      const user = await storage.createUser({
        username: guestName.toLowerCase(),
        password: await hashPassword(randomUUID()), // random password
        displayName: guestName,
        role: "guest",
        chipBalance: 10000,
        avatarId: randomAvatar,
        memberId,
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

      const regMemberId = "HR-" + createHash("sha256").update(randomUUID() + Date.now().toString()).digest("hex").substring(0, 8);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        displayName: displayName || username,
        role: "member",
        chipBalance: 10000,
        memberId: regMemberId,
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

  // Change password
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new passwords are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      // Get user with password from storage
      const user = await storage.getUser(req.user!.id);
      if (!user || !user.password) {
        return res.status(400).json({ message: "Cannot change password for this account" });
      }

      // Verify current password
      const isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash and store new password
      const hashed = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashed });

      res.json({ message: "Password changed successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Generate 2FA secret
  app.post("/api/auth/2fa/setup", requireAuth, async (req, res) => {
    try {
      // Generate a random secret (hex-encoded for HMAC use)
      const secret = randomBytes(20).toString("hex");

      // Store secret on user (not yet enabled)
      await storage.updateUser(req.user!.id, { twoFactorSecret: secret });

      // Return the secret for QR code generation (client-side)
      const otpauthUrl = `otpauth://totp/HighRollers:${req.user!.username}?secret=${secret}&issuer=HighRollers`;

      res.json({ secret, otpauthUrl });
    } catch (err) {
      res.status(500).json({ message: "Failed to setup 2FA" });
    }
  });

  // Verify and enable 2FA
  app.post("/api/auth/2fa/verify", requireAuth, async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ message: "Verification code required" });

      const user = await storage.getUser(req.user!.id);
      if (!user?.twoFactorSecret) {
        return res.status(400).json({ message: "2FA not initialized. Call /api/auth/2fa/setup first" });
      }

      // Simple TOTP verification using HMAC
      const isValid = verifyTOTP(user.twoFactorSecret, code);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      await storage.updateUser(user.id, { twoFactorEnabled: true });
      res.json({ message: "2FA enabled successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to verify 2FA" });
    }
  });

  // Disable 2FA
  app.post("/api/auth/2fa/disable", requireAuth, async (req, res) => {
    try {
      await storage.updateUser(req.user!.id, { twoFactorEnabled: false, twoFactorSecret: null });
      res.json({ message: "2FA disabled" });
    } catch (err) {
      res.status(500).json({ message: "Failed to disable 2FA" });
    }
  });

  // ── Recovery Codes ─────────────────────────────────────────────────

  // Generate 8 recovery codes for the authenticated user
  app.post("/api/auth/generate-recovery-codes", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Generate 8 plaintext codes in XXXX-XXXX format
      const plaintextCodes: string[] = [];
      const hashedCodes: Array<{ hash: string; salt: string; used: boolean }> = [];

      for (let i = 0; i < 8; i++) {
        const code = randomBytes(4).toString("hex").toUpperCase().replace(/(.{4})(.{4})/, "$1-$2");
        plaintextCodes.push(code);

        const salt = randomBytes(16).toString("hex");
        const derived = (await scryptAsync(code, salt, 64)) as Buffer;
        hashedCodes.push({ hash: derived.toString("hex"), salt, used: false });
      }

      await storage.updateUser(user.id, { recoveryCodes: hashedCodes });
      res.json({ codes: plaintextCodes });
    } catch (err) {
      res.status(500).json({ message: "Failed to generate recovery codes" });
    }
  });

  // Recover account using a backup code (unauthenticated)
  app.post("/api/auth/recover-with-code", async (req, res, next) => {
    try {
      const { username, code } = req.body;
      if (!username || !code) {
        return res.status(400).json({ message: "Username and recovery code required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ message: "Invalid username or recovery code" });

      const storedCodes: Array<{ hash: string; salt: string; used: boolean }> =
        Array.isArray(user.recoveryCodes) ? (user.recoveryCodes as any) : [];

      if (storedCodes.length === 0) {
        return res.status(401).json({ message: "No recovery codes configured for this account" });
      }

      // Check each unused code
      let matchIndex = -1;
      for (let i = 0; i < storedCodes.length; i++) {
        if (storedCodes[i].used) continue;
        const derived = (await scryptAsync(code.trim().toUpperCase(), storedCodes[i].salt, 64)) as Buffer;
        const storedHash = Buffer.from(storedCodes[i].hash, "hex");
        if (derived.length === storedHash.length && timingSafeEqual(derived, storedHash)) {
          matchIndex = i;
          break;
        }
      }

      if (matchIndex === -1) {
        return res.status(401).json({ message: "Invalid username or recovery code" });
      }

      // Mark code as used
      storedCodes[matchIndex].used = true;
      await storage.updateUser(user.id, { recoveryCodes: storedCodes });

      // Log the user in via session
      const safeUser = sanitizeUser(user);
      req.login(safeUser, (err) => {
        if (err) return next(err);
        res.json({ message: "Recovery successful", user: safeUser });
      });
    } catch (err) {
      res.status(500).json({ message: "Recovery failed" });
    }
  });

  // ── Email Recovery ──────────────────────────────────────────────────

  const recoveryCodeStore = new Map<string, { code: string; expiresAt: number }>();

  app.post("/api/auth/request-recovery-email", async (req, res) => {
    try {
      const { email, username } = req.body;
      // Look up user by username or email
      let user: User | undefined;
      if (username) {
        user = await storage.getUserByUsername(username);
      } else if (email) {
        user = await storage.getUserByEmail(email);
      }

      // Always return 200 (don't reveal if user exists)
      if (!user) {
        return res.json({ sent: true });
      }

      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min
      recoveryCodeStore.set(user.id, { code, expiresAt });

      if (process.env.SMTP_HOST) {
        // Send real email
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587", 10),
          secure: process.env.SMTP_SECURE === "true",
          auth: process.env.SMTP_USER ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          } : undefined,
        });

        const fromAddr = process.env.SMTP_FROM || "noreply@highrollers.club";
        const targetEmail = user.email || email;
        if (targetEmail) {
          await transporter.sendMail({
            from: fromAddr,
            to: targetEmail,
            subject: "HighRollers Account Recovery Code",
            text: `Your recovery code is: ${code}\n\nThis code expires in 15 minutes.`,
            html: `<p>Your recovery code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`,
          });
        }
        res.json({ sent: true });
      } else {
        // Dev mode: log code to console
        console.log(`[DEV] Recovery code for ${user.username}: ${code}`);
        res.json({ sent: true, dev: true });
      }
    } catch (err) {
      console.error("Recovery email error:", err);
      res.json({ sent: true }); // Don't leak errors
    }
  });

  app.post("/api/auth/verify-recovery-email", async (req, res, next) => {
    try {
      const { username, code } = req.body;
      if (!username || !code) {
        return res.status(400).json({ message: "Username and code are required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or code" });
      }

      const stored = recoveryCodeStore.get(user.id);
      if (!stored) {
        return res.status(401).json({ message: "No recovery code found. Please request a new one." });
      }

      if (Date.now() > stored.expiresAt) {
        recoveryCodeStore.delete(user.id);
        return res.status(401).json({ message: "Recovery code has expired. Please request a new one." });
      }

      if (stored.code !== code.trim()) {
        return res.status(401).json({ message: "Invalid recovery code" });
      }

      // Code is valid - delete it and log user in
      recoveryCodeStore.delete(user.id);
      const safeUser = sanitizeUser(user);
      req.login(safeUser, (err) => {
        if (err) return next(err);
        res.json({ message: "Recovery successful", user: safeUser });
      });
    } catch (err) {
      res.status(500).json({ message: "Recovery failed" });
    }
  });

  // ── Wallet Challenge / Verify ──────────────────────────────────────

  const walletChallengeStore = new Map<string, { challenge: string; expiresAt: number }>();

  app.post("/api/auth/wallet-challenge", (_req, res) => {
    const challenge = `Sign this message to verify your wallet ownership: ${randomUUID()}`;
    const token = randomBytes(16).toString("hex");
    walletChallengeStore.set(token, { challenge, expiresAt: Date.now() + 10 * 60 * 1000 });
    res.json({ challenge, token });
  });

  app.post("/api/auth/verify-wallet", async (req, res, next) => {
    try {
      const { address, signature, token } = req.body;
      if (!address || !signature || !token) {
        return res.status(400).json({ message: "Address, signature, and token are required" });
      }

      const stored = walletChallengeStore.get(token);
      if (!stored) {
        return res.status(401).json({ message: "Invalid or expired challenge. Please request a new one." });
      }

      if (Date.now() > stored.expiresAt) {
        walletChallengeStore.delete(token);
        return res.status(401).json({ message: "Challenge has expired. Please request a new one." });
      }

      // Simplified verification: just check signature is non-empty and challenge matches
      // Real crypto verification (e.g. with ethers.js) can be added later
      if (typeof signature !== "string" || signature.trim().length === 0) {
        return res.status(400).json({ message: "Signature cannot be empty" });
      }

      walletChallengeStore.delete(token);

      // If user is already logged in, link the wallet to their account
      if (req.user) {
        await storage.updateUser(req.user.id, { walletAddress: address.trim() });
        const updatedUser = await storage.getUser(req.user.id);
        if (updatedUser) {
          const safeUser = sanitizeUser(updatedUser);
          return res.json({ message: "Wallet linked successfully", user: safeUser });
        }
      }

      // Otherwise, find user by stored wallet address
      const user = await storage.getUserByWalletAddress(address.trim());
      if (!user) {
        return res.status(401).json({ message: "No account found with this wallet address. Please link your wallet first from Security settings." });
      }

      const safeUser = sanitizeUser(user);
      req.login(safeUser, (err) => {
        if (err) return next(err);
        res.json({ message: "Wallet verification successful", user: safeUser });
      });
    } catch (err) {
      res.status(500).json({ message: "Wallet verification failed" });
    }
  });

  // ── Wallet Connection Endpoints ────────────────────────────────────

  const VALID_WALLET_PROVIDERS = ["metamask", "coinbase", "walletconnect", "phantom"];

  // Connect a wallet
  app.post("/api/auth/wallet/connect", requireAuth, async (req, res) => {
    try {
      const { provider, address } = req.body;
      if (!provider || !VALID_WALLET_PROVIDERS.includes(provider)) {
        return res.status(400).json({ message: "Invalid wallet provider. Must be one of: " + VALID_WALLET_PROVIDERS.join(", ") });
      }
      if (!address || typeof address !== "string" || address.trim().length === 0) {
        return res.status(400).json({ message: "Wallet address is required" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const existing: Array<{ provider: string; address: string }> = Array.isArray(user.connectedWallets) ? user.connectedWallets as any : [];
      // Replace if provider already exists, otherwise add
      const updated = existing.filter((w: any) => w.provider !== provider);
      updated.push({ provider, address: address.trim() });

      await storage.updateUser(user.id, { connectedWallets: updated });
      res.json({ message: "Wallet connected", provider, address: address.trim() });
    } catch (err) {
      res.status(500).json({ message: "Failed to connect wallet" });
    }
  });

  // Disconnect a wallet
  app.post("/api/auth/wallet/disconnect", requireAuth, async (req, res) => {
    try {
      const { provider } = req.body;
      if (!provider || !VALID_WALLET_PROVIDERS.includes(provider)) {
        return res.status(400).json({ message: "Invalid wallet provider" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const existing: Array<{ provider: string; address: string }> = Array.isArray(user.connectedWallets) ? user.connectedWallets as any : [];
      const updated = existing.filter((w: any) => w.provider !== provider);

      await storage.updateUser(user.id, { connectedWallets: updated });
      res.json({ message: "Wallet disconnected" });
    } catch (err) {
      res.status(500).json({ message: "Failed to disconnect wallet" });
    }
  });

  // Get connected wallets
  app.get("/api/auth/wallets", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const wallets: Array<{ provider: string; address: string }> = Array.isArray(user.connectedWallets) ? user.connectedWallets as any : [];
      res.json({ wallets });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch wallets" });
    }
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
