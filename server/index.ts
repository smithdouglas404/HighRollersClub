import { execSync } from "child_process";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { seedData } from "./seed";
import { seedBotTables } from "./seed-bot-tables";
import { scheduleDailyTournaments } from "./scheduler";
import { csrfProtection } from "./middleware/csrf";
import { hasDatabase, getPool } from "./db";
import { SERVICE_MODE, logServiceMode } from "./service-mode";

logServiceMode();

// Auto-push database schema if DATABASE_URL is set
if (hasDatabase()) {
  // Run raw SQL to ensure all required columns/tables exist
  // This is more reliable than drizzle-kit push which hangs on interactive prompts
  try {
    log("Syncing database schema...");
    const pool = getPool();
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_level text NOT NULL DEFAULT 'none';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_points integer NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_level integer NOT NULL DEFAULT 1;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_streak_days integer NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_last_play_date text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_multiplier integer NOT NULL DEFAULT 100;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_login_streak integer NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_reward_at timestamp;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by varchar;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code varchar;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_plan text;
      ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS earnable_at_level integer;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS loyalty_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id),
        amount integer NOT NULL,
        reason text NOT NULL,
        multiplier_x100 integer NOT NULL DEFAULT 100,
        base_amount integer NOT NULL,
        new_total integer NOT NULL,
        new_level integer NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS club_messages (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        club_id varchar NOT NULL REFERENCES clubs(id),
        user_id varchar NOT NULL REFERENCES users(id),
        message text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    log("Database schema synced.");
  } catch (err: any) {
    console.error("[db] Schema sync failed:", err.message);
    log("WARNING: Database schema sync failed — some features may not work.");
  }

  // Ensure the session table exists before the app starts accepting requests.
  // connect-pg-simple has createTableIfMissing but it can race with early requests.
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      ) WITH (OIDS=FALSE);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
    log("Session table verified.");
  } catch (err: any) {
    console.error("[db] Session table creation failed:", err.message);
  }
} else {
  log("WARNING: No DATABASE_URL set — using in-memory storage. All data will be lost on restart!");
}

const app = express();

const isDev = process.env.NODE_ENV !== "production";
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "*.firebaseapp.com", "*.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "*.googleapis.com", "*.didit.me"],
      connectSrc: ["'self'", "*.firebaseapp.com", "*.googleapis.com", "*.didit.me", "*.daily.co", "wss:", "ws:"],
      frameSrc: ["'self'", "*.didit.me", "*.daily.co", "*.firebaseapp.com"],
      mediaSrc: ["'self'", "blob:", "*.daily.co"],
      workerSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
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
  // Run evaluator self-test at startup to ensure both hand evaluators agree
  const { selfTestEvaluators } = await import("./game/engine");
  selfTestEvaluators();

  // Auto-migrate database schema (add missing columns/tables)
  const { autoMigrate } = await import("./db");
  await autoMigrate().catch(err => console.warn("[init] Auto-migrate:", err.message));

  // Ensure "system" user exists before any tables/tournaments are created
  const { storage } = await import("./storage");
  try {
    await storage.ensureSystemUser();
  } catch (err: any) {
    console.error("[FATAL] Cannot create system user — scheduler and bot tables will fail:", err.message);
    // Retry once after a short delay (migration may still be settling)
    await new Promise(r => setTimeout(r, 2000));
    await storage.ensureSystemUser();
  }

  // Register REST routes + WebSocket (registerRoutes sets up both)
  // In monolith mode: everything as before
  // In api mode: routes are registered, WebSocket is set up (handled inside registerRoutes)
  // In game/payments/jobs mode: still need a minimal HTTP server for health checks
  const server = await registerRoutes(app, sessionMiddleware);

  // Seed default missions and shop items (only needed for api/game services)
  if (SERVICE_MODE.api || SERVICE_MODE.game) {
    await seedData().catch(err => console.error("[seed] Failed:", err));
  }

  // Seed bot tables so the lobby is never empty (only for api/game services)
  if (SERVICE_MODE.api || SERVICE_MODE.game) {
    await seedBotTables().catch(err => console.error("[seed-bot-tables] Failed:", err));
  }

  // Start the recurring daily tournament scheduler (only for jobs service)
  if (SERVICE_MODE.jobs) {
    scheduleDailyTournaments();
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  // Only serve the client frontend when running the API service
  if (SERVICE_MODE.api) {
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);

  // Kill any stale node server on our port before we try to bind.
  // Exclude Replit's pid2 (PID typically < 100) since we can't/shouldn't kill it.
  try {
    const pids = execSync(`fuser ${port}/tcp 2>/dev/null || true`, { timeout: 3000 }).toString().trim().split(/\s+/);
    for (const p of pids) {
      const pid = parseInt(p, 10);
      if (pid > 100) {
        try { process.kill(pid, "SIGKILL"); } catch {}
      }
    }
    if (pids.some(p => parseInt(p, 10) > 100)) {
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch {}

  let retries = 0;
  const MAX_RETRIES = 3;

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" && retries < MAX_RETRIES) {
      retries++;
      log(`Port ${port} is busy — retry ${retries}/${MAX_RETRIES} in 2s...`);
      try { execSync(`fuser -k -9 ${port}/tcp 2>/dev/null`, { timeout: 3000 }); } catch {}
      setTimeout(() => {
        server.listen({ port, host: "0.0.0.0", reusePort: true });
      }, 2000);
    } else if (err.code === "EADDRINUSE") {
      console.error(`[server] Port ${port} still busy after ${MAX_RETRIES} retries. Is another instance running?`);
      process.exit(1);
    } else {
      console.error("[server] Fatal error:", err);
      process.exit(1);
    }
  });

  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Graceful shutdown — close connections cleanly so the port is freed immediately
  function gracefulShutdown(signal: string) {
    log(`${signal} received — shutting down gracefully...`);
    server.close(() => {
      log("HTTP server closed.");
      if (hasDatabase()) {
        getPool().end().then(() => {
          log("Database pool closed.");
          process.exit(0);
        }).catch(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
    // Force exit after 5 seconds if graceful shutdown stalls
    setTimeout(() => {
      console.error("[server] Graceful shutdown timed out — forcing exit.");
      process.exit(1);
    }, 5000);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
})();
