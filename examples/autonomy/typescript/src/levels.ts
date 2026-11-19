import { ageDays, parseTime } from "./util.js";
import type { Json } from "./util.js";

export const CAPPING_DIMENSIONS = ["platform", "governance", "ownership", "measuring"] as const;
export const ALL_DIMENSIONS = [
  "platform",
  "shared_context",
  "operating_model",
  "governance",
  "ownership",
  "skill",
  "measuring",
] as const;

export const PROFILE_MAX_AGE_DAYS = 30;
export const FRESHNESS_LEVEL = 2;
export const HARNESS_LEVEL = 3;

export interface Effective {
  id: string;
  granted: number;
  cap: number;
  freshness: number;
  harness: number;
  override: number;
  effective: number;
  reasons: string[];
}

/** Level of one dimension as the cap sees it: unknown counts as 2. */
export function dimensionLevel(profile: Json | null, dimension: string): number {
  const entry = profile?.dimensions?.[dimension];
  if (entry === undefined || entry === null) return 2;
  return typeof entry.level === "number" ? entry.level : (entry.counted_as ?? 2);
}

export function capOf(profile: Json | null): number {
  return Math.min(...CAPPING_DIMENSIONS.map((d) => dimensionLevel(profile, d)));
}

export function profileStatus(profile: Json | null, now: number): "ok" | "missing" | "stale" {
  if (profile === null || typeof profile.generated !== "string") return "missing";
  return ageDays(now, parseTime(profile.generated)) > PROFILE_MAX_AGE_DAYS ? "stale" : "ok";
}

function freshnessReasons(wf: Json, defaults: Json, now: number): string[] {
  const reasons: string[] = [];
  const maxAge = defaults?.stop_test_max_age_days ?? 30;
  if (wf.granted_level >= 4) {
    const tested = wf.stop?.last_tested;
    if (tested === undefined || ageDays(now, parseTime(tested)) > maxAge) reasons.push("stop-test-overdue");
  }
  if (wf.review_date !== undefined && parseTime(wf.review_date) < now) reasons.push("review-date-passed");
  if (wf.access_expires !== undefined && parseTime(wf.access_expires) < now) reasons.push("access-expired");
  return reasons;
}

export function effectiveLevel(wf: Json, profile: Json | null, state: Json | null, defaults: Json, now: number): Effective {
  const granted: number = wf.granted_level;
  const cap = capOf(profile);
  const reasons: string[] = [];
  const stale = profileStatus(profile, now);
  const fresh = freshnessReasons(wf, defaults, now);
  if (stale !== "ok") fresh.push(`profile-${stale}`);
  const freshness = fresh.length > 0 ? FRESHNESS_LEVEL : 5;
  const entry = state?.workflows?.[wf.id] ?? {};
  const harnessChanged =
    typeof entry.harness_hash === "string" && entry.harness_hash !== entry.task_bank_passed_hash;
  const harness = harnessChanged ? HARNESS_LEVEL : 5;
  const override: number = typeof entry.demotion_override === "number" ? entry.demotion_override : 5;
  const effective = Math.min(granted, cap, freshness, harness, override);
  if (cap < granted) reasons.push(`cap:${cap}`);
  if (freshness < granted) for (const r of fresh) reasons.push(`freshness:${r}`);
  if (harness < granted) reasons.push("harness:task-bank-not-passed");
  if (override < granted) reasons.push(`demotion:${override}`);
  return { id: wf.id, granted, cap, freshness, harness, override, effective, reasons };
}

/** Workflows including the synthesised interactive entry when the register omits it. */
export function allWorkflows(register: Json): Json[] {
  const list: Json[] = [...register.workflows];
  if (!list.some((w) => w.id === "interactive")) {
    list.push({ id: "interactive", granted_level: register.defaults?.interactive_level ?? 2 });
  }
  return list;
}
