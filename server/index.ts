import { execSync } from "child_process";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { seedData } from "./seed";
import { csrfProtection } from "./middleware/csrf";
import { hasDatabase } from "./db";

try { execSync("fuser -k -9 5000/tcp 2>/dev/null", { timeout: 3000 }); } catch {}
await new Promise(r => setTimeout(r, 2000));

// Auto-push database schema if DATABASE_URL is set
if (hasDatabase()) {
  try {
    log("Syncing database schema...");
    execSync("npx drizzle-kit push --force", { timeout: 30000, stdio: "pipe" });
    log("Database schema synced.");
  } catch (err: any) {
    console.error("[db] Schema push failed:", err.stderr?.toString() || err.message);
    log("WARNING: Database schema push failed — some features may not work.");
  }
} else {
  log("WARNING: No DATABASE_URL set — using in-memory storage. All data will be lost on restart!");
}

const app = express();

const isDev = process.env.NODE_ENV !== "production";
app.use(helmet({
  contentSecurityPolicy: isDev ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      mediaSrc: ["'self'"],
    },
  },
}));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use(cookieParser());

// Setup auth (session + passport) before routes
const sessionMiddleware = setupAuth(app);

// CSRF protection (after session, before routes)
app.use("/api", csrfProtection);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app, sessionMiddleware);

  // Seed default missions and shop items
  await seedData().catch(err => console.error("[seed] Failed:", err));

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
