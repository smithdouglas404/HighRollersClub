import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool, db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { verifyFirebaseToken } from "./firebase-admin";
import type { RequestHandler, Request } from "express";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

declare module "express-session" {
  interface SessionData {
    userId: number;
    username: string;
  }
}

const PgSession = connectPgSimple(session);

let sessionMiddleware: RequestHandler | null = null;

function buildSessionMiddleware(): RequestHandler {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  return session({
    store: new PgSession({
      pool: pool as any,
      tableName: "user_sessions",
      createTableIfMissing: false,
    }),
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  });
}

export function createSessionMiddleware(): RequestHandler {
  if (!sessionMiddleware) {
    sessionMiddleware = buildSessionMiddleware();
  }
  return sessionMiddleware;
}

export function getSessionMiddleware(): RequestHandler {
  if (!sessionMiddleware) {
    sessionMiddleware = buildSessionMiddleware();
  }
  return sessionMiddleware;
}

export async function extractFirebaseUid(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const decoded = await verifyFirebaseToken(token);
    return decoded.uid;
  } catch (err) {
    console.error("Firebase token verification failed:", err);
    return null;
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  if (req.session.userId) {
    next();
    return;
  }

  try {
    const firebaseUid = await extractFirebaseUid(req);
    if (firebaseUid) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, firebaseUid));
      if (user) {
        req.session.userId = user.id;
        req.session.username = user.username;
        next();
        return;
      }
    }
  } catch (err) {
    console.error("requireAuth: Firebase auth check failed:", err);
  }

  res.status(401).json({ error: "Authentication required" });
};

export function getSessionUserId(req: Request): number | undefined {
  return req.session.userId;
}
