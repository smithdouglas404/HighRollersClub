/**
 * Security Engine — Centralized IP, VPN, geofence, device, and multi-account enforcement.
 *
 * Provides:
 * - IP blacklist/whitelist (database-backed with expiry)
 * - VPN/proxy/Tor detection via ip-api.com pro fields
 * - 3-tier geofencing (platform → club → table)
 * - Device fingerprint storage and cross-account detection
 * - Force logout via WebSocket session kill
 * - Loss limit enforcement
 */

import { createHash } from "crypto";

// ─── IP Geolocation Cache ───────────────────────────────────────────────────

interface IpGeoInfo {
  country: string;        // ISO country code (US, CA, etc.)
  region: string;         // State/province code (CA, NV, etc.)
  city: string;
  isp: string;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  isHosting: boolean;     // datacenter/hosting provider
  fetchedAt: number;
}

const geoCache = new Map<string, IpGeoInfo>();
const GEO_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// ─── IP Rules Cache ─────────────────────────────────────────────────────────

let ipRulesCache: Array<{ ip: string; type: "ban" | "allow"; expiresAt: Date | null }> = [];
let ipRulesCacheAge = 0;
const IP_RULES_TTL = 60 * 1000; // refresh every 60s

export async function refreshIpRules(db: any, ipRulesTable: any, sql: any) {
  try {
    const rules = await db.select().from(ipRulesTable);
    ipRulesCache = rules.map((r: any) => ({ ip: r.ip, type: r.type, expiresAt: r.expiresAt }));
    ipRulesCacheAge = Date.now();
  } catch {}
}

// ─── IP Geolocation Lookup ──────────────────────────────────────────────────

export async function getIpGeoInfo(ip: string): Promise<IpGeoInfo | null> {
  // Skip private IPs
  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.")) {
    return { country: "LOCAL", region: "", city: "", isp: "localhost", isVpn: false, isProxy: false, isTor: false, isHosting: false, fetchedAt: Date.now() };
  }

  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.fetchedAt < GEO_CACHE_TTL) return cached;

  try {
    // Use HTTPS via pro.ip-api.com when API key is set, otherwise fall back to ip-api.io (free HTTPS)
    const apiBase = process.env.IP_API_URL || (process.env.IP_API_KEY ? "https://pro.ip-api.com" : "https://ip-api.io");
    const keyParam = process.env.IP_API_KEY ? `&key=${process.env.IP_API_KEY}` : "";
    const res = await fetch(`${apiBase}/json/${ip}?fields=status,country,countryCode,region,regionName,city,isp,proxy,hosting${keyParam}`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();

    if (data.status !== "success") return null;

    const info: IpGeoInfo = {
      country: data.countryCode || "",
      region: data.region || "",
      city: data.city || "",
      isp: data.isp || "",
      isVpn: false,
      isProxy: !!data.proxy,
      isTor: false,
      isHosting: !!data.hosting,
      fetchedAt: Date.now(),
    };

    // Detect VPN: hosting provider + proxy flag combo
    if (data.proxy || data.hosting) info.isVpn = true;

    // Known VPN ISP patterns
    const vpnIsps = ["nordvpn", "expressvpn", "surfshark", "mullvad", "private internet access", "cyberghost", "protonvpn", "windscribe"];
    if (info.isp && vpnIsps.some(v => info.isp.toLowerCase().includes(v))) info.isVpn = true;

    geoCache.set(ip, info);
    return info;
  } catch {
    return null;
  }
}

// ─── Check Tor Exit Nodes ───────────────────────────────────────────────────

let torExitNodes = new Set<string>();
let torNodesAge = 0;

async function refreshTorNodes() {
  if (Date.now() - torNodesAge < 60 * 60 * 1000) return; // refresh hourly
  try {
    const res = await fetch("https://check.torproject.org/torbulkexitlist", { signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    const nodes = new Set(text.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#")));
    if (nodes.size > 100) { // sanity check
      torExitNodes = nodes;
      torNodesAge = Date.now();
    }
  } catch {}
}

export function isTorExitNode(ip: string): boolean {
  return torExitNodes.has(ip);
}

// Refresh on startup
refreshTorNodes();
setInterval(refreshTorNodes, 60 * 60 * 1000);

// ─── IP Rule Checking ───────────────────────────────────────────────────────

export function checkIpRules(ip: string): { allowed: boolean; rule?: string } {
  const now = new Date();
  for (const rule of ipRulesCache) {
    if (rule.expiresAt && rule.expiresAt < now) continue; // expired
    if (rule.ip === ip || ip.startsWith(rule.ip.replace("*", ""))) {
      if (rule.type === "ban") return { allowed: false, rule: `IP banned: ${rule.ip}` };
      if (rule.type === "allow") return { allowed: true, rule: `IP whitelisted: ${rule.ip}` };
    }
  }
  return { allowed: true }; // default allow
}

// ─── Geofence Check (3-tier) ────────────────────────────────────────────────

export interface GeofenceConfig {
  platformCountries: string[] | null;  // null = all allowed
  platformStates: string[] | null;
  platformBlockVpn: boolean;
  clubCountries: string[] | null;
  clubStates: string[] | null;
  clubBlockVpn: boolean;
  tableCountries: string[] | null;
  tableStates: string[] | null;
  tableBlockVpn: boolean;
}

export function checkGeofence(geo: IpGeoInfo, config: GeofenceConfig): { allowed: boolean; reason?: string } {
  // VPN check (most restrictive level wins)
  if (geo.isVpn || geo.isProxy || geo.isTor) {
    if (config.tableBlockVpn || config.clubBlockVpn || config.platformBlockVpn) {
      const source = geo.isTor ? "Tor" : geo.isProxy ? "Proxy" : "VPN";
      return { allowed: false, reason: `${source} detected — not allowed` };
    }
  }

  // Country check (most specific level wins: table > club > platform)
  const allowedCountries = config.tableCountries || config.clubCountries || config.platformCountries;
  if (allowedCountries && allowedCountries.length > 0) {
    if (!allowedCountries.includes(geo.country)) {
      return { allowed: false, reason: `Country ${geo.country} not allowed` };
    }
  }

  // State check (same precedence)
  const allowedStates = config.tableStates || config.clubStates || config.platformStates;
  if (allowedStates && allowedStates.length > 0) {
    if (!allowedStates.includes(geo.region)) {
      return { allowed: false, reason: `State/region ${geo.region} not allowed` };
    }
  }

  return { allowed: true };
}

// ─── Device Fingerprint Helpers ─────────────────────────────────────────────

export function hashFingerprint(components: {
  canvas?: string;
  webgl?: string;
  fonts?: string;
  screen?: string;
  timezone?: string;
  language?: string;
}): string {
  const data = [
    components.canvas || "",
    components.webgl || "",
    components.fonts || "",
    components.screen || "",
    components.timezone || "",
    components.language || "",
  ].join("|");
  return createHash("sha256").update(data).digest("hex");
}

// ─── Loss Limit Check ───────────────────────────────────────────────────────

export function checkLossLimit(dailyLoss: number, limit: number): { allowed: boolean; remaining: number } {
  if (limit <= 0) return { allowed: true, remaining: Infinity }; // 0 = no limit
  const remaining = limit - Math.abs(dailyLoss);
  return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
}

// ─── Multi-Account Detection ────────────────────────────────────────────────

export interface MultiAccountMatch {
  userId: string;
  matchedUserId: string;
  fingerprint: string;
  matchType: "same_device" | "same_ip_range";
  confidence: number; // 0-100
}

export function detectMultiAccounts(
  userId: string,
  fingerprint: string,
  ip: string,
  allFingerprints: Array<{ userId: string; fingerprint: string; ipAddress: string }>
): MultiAccountMatch[] {
  const matches: MultiAccountMatch[] = [];

  for (const fp of allFingerprints) {
    if (fp.userId === userId) continue;

    // Exact device fingerprint match = very high confidence
    if (fp.fingerprint === fingerprint) {
      matches.push({
        userId,
        matchedUserId: fp.userId,
        fingerprint,
        matchType: "same_device",
        confidence: 95,
      });
    }

    // Same IP range (first 3 octets for IPv4)
    if (ip && fp.ipAddress) {
      const ipParts = ip.split(".");
      const fpParts = fp.ipAddress.split(".");
      if (ipParts.length === 4 && fpParts.length === 4 && ipParts.slice(0, 3).join(".") === fpParts.slice(0, 3).join(".")) {
        matches.push({
          userId,
          matchedUserId: fp.userId,
          fingerprint: fp.fingerprint,
          matchType: "same_ip_range",
          confidence: 60,
        });
      }
    }
  }

  return matches;
}

// ─── Platform Settings Helpers ──────────────────────────────────────────────

// In-memory cache of platform settings (refreshed from DB periodically)
let platformSettingsCache: Record<string, any> = {};

export function getPlatformSetting(key: string, defaultValue: any = null): any {
  return platformSettingsCache[key] ?? defaultValue;
}

export function updatePlatformSettingsCache(settings: Array<{ key: string; value: any }>) {
  for (const s of settings) {
    platformSettingsCache[s.key] = s.value;
  }
}

// Default platform settings
export const DEFAULT_PLATFORM_SETTINGS = {
  "geofence.countries": ["US"],          // Default: US only
  "geofence.states": null as string[] | null, // null = all states
  "geofence.block_vpn": true,
  "geofence.block_tor": true,
  "maintenance.enabled": false,
  "maintenance.reason": "",
  "maintenance.scheduled_end": null as string | null,
  "limits.daily_loss_default": 0,        // 0 = no limit
  "limits.daily_deposit_default": 0,
  "security.require_device_fingerprint": true,
  "security.multi_account_auto_flag": true,
  "security.bot_auto_suspend_threshold": 80,
};
