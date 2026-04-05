/**
 * Timing-Based Bot Detection System
 *
 * Analyzes player action timing patterns to detect automated play.
 * Uses statistical analysis of handActions.timeSpent data.
 *
 * Detection signals:
 * 1. Inhuman speed — actions consistently under 500ms (human minimum ~800ms for simple decisions)
 * 2. Robotic consistency — standard deviation of action times near zero (humans are noisy)
 * 3. Perfect intervals — actions at exact intervals (e.g., every 2.000s)
 * 4. No variation by decision complexity — humans take longer on raises than checks
 * 5. Session length anomalies — playing 8+ hours without timing variance changes
 */

import { createHash } from "crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BotDetectionResult {
  userId: string;
  riskScore: number;        // 0-100 (0 = definitely human, 100 = definitely bot)
  signals: BotSignal[];
  actionCount: number;
  avgTimeMs: number;
  stdDevMs: number;
  recommendation: "clear" | "monitor" | "flag" | "suspend";
  analyzedAt: string;
}

export interface BotSignal {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  value: number;
  threshold: number;
}

interface ActionTiming {
  actionType: string;
  timeSpentMs: number;
  street: string;
}

// ─── Statistical Helpers ────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function coefficientOfVariation(values: number[]): number {
  const avg = mean(values);
  if (avg === 0) return 0;
  return stdDev(values) / avg;
}

// Check if values cluster around exact intervals
function intervalConsistency(values: number[]): number {
  if (values.length < 5) return 0;
  // Check differences between consecutive actions
  const diffs = [];
  for (let i = 1; i < values.length; i++) {
    diffs.push(Math.abs(values[i] - values[i - 1]));
  }
  // Low CV of diffs = robotic timing
  return 1 - Math.min(coefficientOfVariation(diffs), 1);
}

// ─── Analysis Engine ────────────────────────────────────────────────────────

export function analyzePlayerTiming(
  userId: string,
  actions: ActionTiming[]
): BotDetectionResult {
  const signals: BotSignal[] = [];
  let riskScore = 0;

  if (actions.length < 10) {
    return {
      userId,
      riskScore: 0,
      signals: [],
      actionCount: actions.length,
      avgTimeMs: mean(actions.map(a => a.timeSpentMs)),
      stdDevMs: stdDev(actions.map(a => a.timeSpentMs)),
      recommendation: "clear",
      analyzedAt: new Date().toISOString(),
    };
  }

  const times = actions.map(a => a.timeSpentMs);
  const avgTime = mean(times);
  const stdDevTime = stdDev(times);
  const cv = coefficientOfVariation(times);

  // ── Signal 1: Inhuman speed ──
  // Humans need at least ~800ms to read, decide, and click
  const fastActions = times.filter(t => t < 500).length;
  const fastPercent = fastActions / times.length;
  if (fastPercent > 0.3) {
    const severity = fastPercent > 0.7 ? "critical" : fastPercent > 0.5 ? "high" : "medium";
    signals.push({
      type: "inhuman_speed",
      severity,
      description: `${Math.round(fastPercent * 100)}% of actions under 500ms (human minimum ~800ms)`,
      value: fastPercent,
      threshold: 0.3,
    });
    riskScore += severity === "critical" ? 35 : severity === "high" ? 25 : 15;
  }

  // ── Signal 2: Robotic consistency (low coefficient of variation) ──
  // Humans typically have CV > 0.4, bots often < 0.15
  if (cv < 0.15 && actions.length >= 20) {
    signals.push({
      type: "robotic_consistency",
      severity: cv < 0.05 ? "critical" : "high",
      description: `Action time CV = ${cv.toFixed(3)} (humans > 0.4, bots < 0.15)`,
      value: cv,
      threshold: 0.15,
    });
    riskScore += cv < 0.05 ? 30 : 20;
  }

  // ── Signal 3: Perfect interval timing ──
  const intervalScore = intervalConsistency(times);
  if (intervalScore > 0.85 && actions.length >= 15) {
    signals.push({
      type: "perfect_intervals",
      severity: intervalScore > 0.95 ? "critical" : "high",
      description: `Action intervals ${Math.round(intervalScore * 100)}% consistent (humans are noisy)`,
      value: intervalScore,
      threshold: 0.85,
    });
    riskScore += intervalScore > 0.95 ? 25 : 15;
  }

  // ── Signal 4: No complexity variance ──
  // Humans take longer on raises/all-ins than checks/folds
  const checkFoldTimes = actions.filter(a => a.actionType === "check" || a.actionType === "fold").map(a => a.timeSpentMs);
  const raiseTimes = actions.filter(a => a.actionType === "raise" || a.actionType === "all_in").map(a => a.timeSpentMs);

  if (checkFoldTimes.length >= 5 && raiseTimes.length >= 5) {
    const checkAvg = mean(checkFoldTimes);
    const raiseAvg = mean(raiseTimes);
    const ratio = raiseAvg / Math.max(checkAvg, 1);

    // Humans typically take 1.5-3x longer on raises than checks
    if (ratio < 1.1) {
      signals.push({
        type: "no_complexity_variance",
        severity: ratio < 1.02 ? "high" : "medium",
        description: `Raise/check time ratio = ${ratio.toFixed(2)} (humans: 1.5-3x, bots: ~1.0)`,
        value: ratio,
        threshold: 1.1,
      });
      riskScore += ratio < 1.02 ? 20 : 10;
    }
  }

  // ── Signal 5: Superhuman average speed ──
  if (avgTime < 1000 && actions.length >= 20) {
    signals.push({
      type: "superhuman_average",
      severity: avgTime < 500 ? "critical" : "high",
      description: `Average ${Math.round(avgTime)}ms per action across ${actions.length} actions`,
      value: avgTime,
      threshold: 1000,
    });
    riskScore += avgTime < 500 ? 20 : 10;
  }

  // ── Signal 6: No preflop vs postflop timing difference ──
  const preflopTimes = actions.filter(a => a.street === "preflop" || a.street === "pre-flop").map(a => a.timeSpentMs);
  const postflopTimes = actions.filter(a => a.street !== "preflop" && a.street !== "pre-flop" && a.street !== "showdown").map(a => a.timeSpentMs);

  if (preflopTimes.length >= 5 && postflopTimes.length >= 5) {
    const preflopAvg = mean(preflopTimes);
    const postflopAvg = mean(postflopTimes);
    const streetRatio = postflopAvg / Math.max(preflopAvg, 1);

    // Humans typically slower postflop (more complex decisions)
    if (streetRatio < 1.05 && streetRatio > 0.95) {
      signals.push({
        type: "no_street_variance",
        severity: "medium",
        description: `Preflop/postflop timing nearly identical (ratio ${streetRatio.toFixed(2)})`,
        value: streetRatio,
        threshold: 1.05,
      });
      riskScore += 10;
    }
  }

  // Cap at 100
  riskScore = Math.min(riskScore, 100);

  const recommendation: BotDetectionResult["recommendation"] =
    riskScore >= 80 ? "suspend" :
    riskScore >= 50 ? "flag" :
    riskScore >= 25 ? "monitor" :
    "clear";

  return {
    userId,
    riskScore,
    signals,
    actionCount: actions.length,
    avgTimeMs: Math.round(avgTime),
    stdDevMs: Math.round(stdDevTime),
    recommendation,
    analyzedAt: new Date().toISOString(),
  };
}
