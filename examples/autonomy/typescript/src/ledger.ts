import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { capOf } from "./levels.js";
import { DAY_MS, ageDays, isoDate, parseTime, readJsonIfExists, round4 } from "./util.js";
import type { Json } from "./util.js";

export const Z = 1.96;
export const PROMOTE_REVERT_UPPER = 0.03;
export const DEMOTE_REVERT_UPPER = 0.06;
export const TASK_BANK_FLOOR = 0.8;
export const COOLDOWN_DAYS = 30;

export function wilson(k: number, n: number, z = Z): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 1 };
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { lower: Math.max(0, center - half), upper: Math.min(1, center + half) };
}

export function readLedger(dir: string, workflow: string): Json[] {
  const path = join(dir, ".autonomy", "ledger", `${workflow}.jsonl`);
  if (!existsSync(path)) throw new Error(`no ledger at ${path}`);
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

export interface Criterion {
  id: string;
  required: string;
  actual: string | number | boolean | null;
  pass: boolean | null;
}

export interface Report {
  workflow: string;
  now: string;
  granted_level: number;
  target_level: number | null;
  window: { days: number; runs: number };
  first_run_pass: { k: number; n: number; rate: number; lower: number };
  revert: { k: number; n: number; rate: number; upper: number };
  escaped_defects: number;
  task_bank_score: number | null;
  cost_per_merged_outcome: number | null;
  band: "promote" | "hold" | "demote";
  criteria: Criterion[];
  promotion_ready: boolean | null;
  manual_items: string[];
  demotion: { triggered: boolean; to_level: number | null; reasons: string[] };
}

function ratio(k: number, n: number): number {
  return n === 0 ? 0 : round4(k / n);
}

function criterion(id: string, required: string, actual: Criterion["actual"], pass: boolean | null): Criterion {
  return { id, required, actual, pass };
}

export function buildReport(wf: Json, runsAll: Json[], profile: Json | null, state: Json | null, defaults: Json, now: number): Report {
  const granted: number = wf.granted_level;
  const target = granted >= 5 ? null : granted + 1;
  const windowDays = Math.max(defaults?.evidence_window?.max_days ?? 60, target === 5 ? 90 : 0);
  const minRuns: number = defaults?.evidence_window?.min_runs ?? 30;
  const inWindow = runsAll.filter((r) => ageDays(now, parseTime(r.ts)) <= windowDays);
  const atLevel = inWindow.filter((r) => r.level === granted);
  const firstPass = atLevel.filter((r) => r.first_run_pass === true).length;
  const fp = wilson(firstPass, atLevel.length);
  const trail = inWindow.filter((r) => r.level >= 3);
  const merged = trail.filter((r) => r.outcome === "merged");
  const reverted = merged.filter((r) => r.reverted_at !== null && r.reverted_at !== undefined).length;
  const rv = wilson(reverted, merged.length);
  const escaped = trail.filter((r) => r.escaped_defect === true).length;
  const latest = [...inWindow].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0)).at(-1);
  const bankScore: number | null = latest?.checks?.["context-eval"] ?? null;
  const mergedAtLevel = atLevel.filter((r) => r.outcome === "merged");
  const cost = atLevel.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0);
  const costPer = mergedAtLevel.length === 0 ? null : round4(cost / mergedAtLevel.length);
  const cap = capOf(profile);
  const entry = state?.workflows?.[wf.id] ?? {};
  const cooldownOk = entry.demoted_at === undefined || ageDays(now, parseTime(entry.demoted_at)) >= COOLDOWN_DAYS;
  const stopAge = wf.stop?.last_tested === undefined ? null : ageDays(now, parseTime(wf.stop.last_tested));
  const times = atLevel.map((r) => parseTime(r.ts));
  const span = times.length === 0 ? 0 : Math.floor((Math.max(...times) - Math.min(...times)) / DAY_MS);

  const criteria: Criterion[] = [];
  const manual: string[] = [];
  if (target === 3) {
    criteria.push(criterion("runs-at-level", ">= 20", atLevel.length, atLevel.length >= 20));
    criteria.push(criterion("first-run-pass-lower", ">= 0.80", round4(fp.lower), fp.lower >= 0.8));
    criteria.push(criterion("owner-named", "present", wf.owner ?? null, Boolean(wf.owner)));
    manual.push("traced sample of 10 runs shows substantive human review");
  } else if (target === 4) {
    criteria.push(criterion("runs-at-level", ">= 30", atLevel.length, atLevel.length >= 30));
    criteria.push(criterion("first-run-pass-lower", ">= 0.90", round4(fp.lower), fp.lower >= 0.9));
    criteria.push(criterion("revert-upper", "<= 0.03", round4(rv.upper), rv.upper <= PROMOTE_REVERT_UPPER));
    criteria.push(criterion("escaped-defects", "0", escaped, escaped === 0));
    criteria.push(criterion("task-bank-score", ">= 0.90", bankScore, bankScore !== null && bankScore >= 0.9));
    criteria.push(criterion("reversible", "true", wf.risk?.reversible ?? null, wf.risk?.reversible === true));
    criteria.push(criterion("mechanical", "mechanical", wf.risk?.verification ?? null, wf.risk?.verification === "mechanical"));
    criteria.push(criterion("stop-drill-age-days", "<= 30", stopAge, stopAge !== null && stopAge <= 30));
    criteria.push(criterion("cap", ">= 4", cap, cap >= 4));
    criteria.push(criterion("cooldown", ">= 30 days since demotion", entry.demoted_at ?? null, cooldownOk));
  } else if (target === 5) {
    criteria.push(criterion("days-at-level", ">= 90", span, span >= 90));
    criteria.push(criterion("baseline", "present", wf.baseline ?? null, Boolean(wf.baseline)));
    criteria.push(criterion("target", "present", wf.target ?? null, Boolean(wf.target)));
    criteria.push(criterion("stop-rule", "present", wf.stop_rule ?? null, Boolean(wf.stop_rule)));
    criteria.push(criterion("cost-per-merged-outcome", "reported", costPer, costPer !== null));
    criteria.push(criterion("cap", ">= 5", cap, cap >= 5));
    criteria.push(criterion("cooldown", ">= 30 days since demotion", entry.demoted_at ?? null, cooldownOk));
    manual.push("one review cycle completed with a recorded decision");
  }

  const reasons: string[] = [];
  let to = 5;
  const lower = (level: number, reason: string) => {
    to = Math.min(to, level);
    reasons.push(reason);
  };
  if (granted >= 3) {
    if (escaped > 0) lower(2, "escaped-defect");
    if (reverted > 0 && merged.length >= minRuns && rv.upper > DEMOTE_REVERT_UPPER) lower(3, "revert-upper-above-hysteresis");
    if (bankScore !== null && bankScore < TASK_BANK_FLOOR) lower(3, "task-bank-below-floor");
    const lim = wf.limits ?? {};
    if (lim.max_diff_lines !== undefined && trail.some((r) => r.diff_lines > lim.max_diff_lines)) lower(3, "diff-limit-breached");
    if (lim.max_cost_usd_per_run !== undefined && trail.some((r) => r.cost_usd > lim.max_cost_usd_per_run)) lower(3, "cost-limit-breached");
    if (lim.max_runs_per_day !== undefined) {
      const perDay = new Map<string, number>();
      for (const r of trail) perDay.set(r.ts.slice(0, 10), (perDay.get(r.ts.slice(0, 10)) ?? 0) + 1);
      if ([...perDay.values()].some((n) => n > lim.max_runs_per_day)) lower(3, "run-limit-breached");
    }
  }
  const triggered = reasons.length > 0 && to < granted;
  let band: Report["band"] = "hold";
  if (triggered) band = "demote";
  else if (merged.length > 0 && rv.upper <= PROMOTE_REVERT_UPPER) band = "promote";
  const autoPass = criteria.every((c) => c.pass === true);
  return {
    workflow: wf.id,
    now: new Date(now).toISOString().replace(/\.\d{3}Z$/, "Z"),
    granted_level: granted,
    target_level: target,
    window: { days: windowDays, runs: inWindow.length },
    first_run_pass: { k: firstPass, n: atLevel.length, rate: ratio(firstPass, atLevel.length), lower: round4(fp.lower) },
    revert: { k: reverted, n: merged.length, rate: ratio(reverted, merged.length), upper: round4(rv.upper) },
    escaped_defects: escaped,
    task_bank_score: bankScore,
    cost_per_merged_outcome: costPer,
    band,
    criteria,
    promotion_ready: target === null ? null : autoPass && !triggered,
    manual_items: manual,
    demotion: { triggered, to_level: triggered ? to : null, reasons: triggered ? reasons : [] },
  };
}

export function formatReport(r: Report): string {
  const lines = [
    `Evidence report: ${r.workflow}`,
    `Date: ${r.now}`,
    `Granted level: ${r.granted_level}; target: ${r.target_level ?? "none (top level)"}`,
    `Window: ${r.window.days} days, ${r.window.runs} runs (${r.first_run_pass.n} at the granted level)`,
    `First-run pass: ${r.first_run_pass.k}/${r.first_run_pass.n} = ${r.first_run_pass.rate}, Wilson lower bound ${r.first_run_pass.lower}`,
    `Reverts: ${r.revert.k}/${r.revert.n} merged = ${r.revert.rate}, Wilson upper bound ${r.revert.upper}`,
    `Escaped defects: ${r.escaped_defects}`,
    `Band: ${r.band} (promote at revert upper <= ${PROMOTE_REVERT_UPPER}, demote above ${DEMOTE_REVERT_UPPER})`,
    "",
    "| Criterion | Required | Actual | Result |",
    "|---|---|---|---|",
    ...r.criteria.map((c) => `| ${c.id} | ${c.required} | ${c.actual} | ${c.pass ? "pass" : "FAIL"} |`),
    "",
  ];
  for (const item of r.manual_items) lines.push(`Needs a human: ${item}`);
  if (r.promotion_ready !== null) lines.push(`Automated criteria: ${r.promotion_ready ? "all met" : "not met"}`);
  lines.push(
    r.demotion.triggered
      ? `Demotion: to level ${r.demotion.to_level} (${r.demotion.reasons.join(", ")})`
      : "Demotion: not triggered",
  );
  return lines.join("\n");
}

/** Write a demotion override. Only ever lowers the stored override. */
export function applyDemotion(dir: string, workflow: string, to: number, reasons: string[], now: number): void {
  const path = join(dir, ".autonomy", "state.json");
  const state: Json = readJsonIfExists(path) ?? { workflows: {} };
  state.workflows ??= {};
  const entry = state.workflows[workflow] ?? {};
  entry.demotion_override = Math.min(to, entry.demotion_override ?? 5);
  entry.demoted_at = isoDate(now);
  entry.reasons = reasons;
  state.workflows[workflow] = entry;
  mkdirSync(join(dir, ".autonomy"), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}

