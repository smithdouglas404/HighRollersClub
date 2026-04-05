/**
 * Service Mode — Detects which services should run in this process.
 *
 * When SERVICE_MODE is not set, all services run together (monolith / all-in-one).
 * Set SERVICE_MODE to one of: "api", "game", "payments", "jobs" to run a single service.
 */

const mode = process.env.SERVICE_MODE;

export const SERVICE_MODE = {
  api: mode === "api" || !mode,
  game: mode === "game" || !mode,
  payments: mode === "payments" || !mode,
  jobs: mode === "jobs" || !mode,
  isMonolith: !mode,
};

export function logServiceMode(): void {
  if (SERVICE_MODE.isMonolith) {
    console.log("[service-mode] Running as monolith (all services in one process)");
  } else {
    console.log(`[service-mode] Running as: ${mode}`);
  }
}
