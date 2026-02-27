import { randomBytes } from "crypto";
import type { Request, Response, NextFunction } from "express";

const CSRF_COOKIE = "csrf-token";
const CSRF_HEADER = "x-csrf-token";
const TOKEN_LENGTH = 32;

// Methods that change state and need CSRF protection
const PROTECTED_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

// Routes that are exempt from CSRF (session-creating endpoints)
// NOTE: When mounted at app.use("/api", csrfProtection), req.path is relative
// to the mount point, so "/api/auth/login" becomes "/auth/login"
const EXEMPT_ROUTES = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/guest",
]);

/**
 * CSRF middleware using the double-submit cookie pattern.
 *
 * - Sets a non-httpOnly `csrf-token` cookie so client JS can read it
 * - Validates that the `X-CSRF-Token` header matches the cookie on all
 *   POST/PUT/DELETE/PATCH requests (except auth routes that create sessions)
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Ensure a CSRF token cookie exists
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = randomBytes(TOKEN_LENGTH).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // client JS must read this
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    // Also set on req.cookies so validation below works on first request
    if (!req.cookies) (req as any).cookies = {};
    req.cookies[CSRF_COOKIE] = token;
  }

  // Only validate on state-changing methods
  if (!PROTECTED_METHODS.has(req.method)) {
    return next();
  }

  // Skip exempt routes
  if (EXEMPT_ROUTES.has(req.path)) {
    return next();
  }

  // Validate: header must match cookie
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;
  const cookieToken = req.cookies?.[CSRF_COOKIE];

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ message: "CSRF token missing or invalid" });
  }

  next();
}
