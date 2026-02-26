// Geofencing — IP-based jurisdiction blocking
import type { Request, Response, NextFunction } from "express";

// Countries where online gambling is explicitly prohibited
// Configure via environment variable BLOCKED_COUNTRIES (comma-separated ISO codes)
const BLOCKED_COUNTRIES: string[] = (process.env.BLOCKED_COUNTRIES || "").split(",").map(s => s.trim()).filter(Boolean);

// Cache IP → country lookups for 24 hours
const ipCache = new Map<string, { country: string; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0].trim();
  return req.socket.remoteAddress || "unknown";
}

async function getCountryFromIP(ip: string): Promise<string | null> {
  // Check cache first
  const cached = ipCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.country;
  }

  // Skip lookup for local/private IPs (RFC 1918 + loopback)
  if (ip === "127.0.0.1" || ip === "::1" || ip === "unknown" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return null;
  }
  // 172.16.0.0 – 172.31.255.255 is private; 172.0-15.x.x and 172.32+.x.x are public
  if (ip.startsWith("172.")) {
    const secondOctet = parseInt(ip.split(".")[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    const country = data.countryCode || null;

    if (country) {
      ipCache.set(ip, { country, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return country;
  } catch {
    // Graceful: don't block on API failure
    return null;
  }
}

export function geofenceMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (BLOCKED_COUNTRIES.length === 0) {
      return next();
    }

    const ip = getClientIp(req);
    const country = await getCountryFromIP(ip);

    if (country && BLOCKED_COUNTRIES.includes(country)) {
      return res.status(403).json({
        error: "Service not available in your jurisdiction",
        code: "GEOFENCE_BLOCKED",
      });
    }

    next();
  };
}

// For WebSocket upgrade check
export async function isIpBlocked(ip: string): Promise<boolean> {
  if (BLOCKED_COUNTRIES.length === 0) return false;
  const country = await getCountryFromIP(ip);
  return country !== null && BLOCKED_COUNTRIES.includes(country);
}
