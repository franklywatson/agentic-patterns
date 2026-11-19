import { ageDays, parseTime, tryParseTime } from "./util.js";
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

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** Level of one capping dimension: an absent, unknown or invalid entry counts as 1. */
export function dimensionLevel(profile: Json | null, dimension: string): number {
  const dimensions = isObject(profile) && isObject(profile.dimensions) ? profile.dimensions : {};
  const entry = dimensions[dimension];
  if (!isObject(entry)) return 1;
  return Number.isInteger(entry.level) && entry.level >= 1 && entry.level <= 5 ? entry.level : 1;
}

/**
 * A profile is missing when there is none, it is not an object, or its `generated` time is absent, not an ISO
 * date or time, or later than `now`.
 */
function isMissing(profile: Json | null, now: number): boolean {
  if (!isObject(profile)) return true;
  const generated = tryParseTime(profile.generated);
  return generated === null || generated > now;
}

/** Lowest capping dimension; a missing profile caps at 1, because nothing has been measured. */
export function capOf(profile: Json | null, now: number): number {
  if (isMissing(profile, now)) return 1;
  return Math.min(...CAPPING_DIMENSIONS.map((d) => dimensionLevel(profile, d)));
}

export function profileStatus(profile: Json | null, now: number): "ok" | "missing" | "stale" {
  if (isMissing(profile, now)) return "missing";
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
  const cap = capOf(profile, now);
  const reasons: string[] = [];
  const stale = profileStatus(profile, now);
  const fresh = freshnessReasons(wf, defaults, now);
  if (stale !== "ok") fresh.push(`profile-${stale}`);
  const freshness = fresh.length > 0 ? FRESHNESS_LEVEL : 5;
  const workflows = isObject(state) && isObject(state.workflows) ? state.workflows : {};
  const entry = isObject(workflows[wf.id]) ? workflows[wf.id] : {};
  const harnessChanged =
    typeof entry.harness_hash === "string" && entry.harness_hash !== entry.task_bank_passed_hash;
  const harness = harnessChanged ? HARNESS_LEVEL : 5;
  const override: number = Number.isInteger(entry.demotion_override) ? entry.demotion_override : 5;
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
