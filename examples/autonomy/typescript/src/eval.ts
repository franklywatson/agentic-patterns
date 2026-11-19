import { decide } from "./hook.js";
import type { HookContext } from "./hook.js";
import { allWorkflows, effectiveLevel } from "./levels.js";
import { isoSeconds, parseTime } from "./util.js";
import type { Json } from "./util.js";

export interface RunOutcome {
  effective: number | null;
  calls: Array<{ name: string; allow: boolean; code: string | null }>;
}

export interface ScenarioScore {
  id: string;
  k: number;
  /** pass^k: 1 only when every one of the k runs matched every expectation. */
  score: 0 | 1;
  mismatches: string[];
}

function buildContext(s: Json, projectDir: string): HookContext {
  const now = parseTime(s.now);
  const wf = allWorkflows(s.register).find((w: Json) => w.id === s.workflow) ?? null;
  const dims: Json = {};
  for (const d of ["platform", "shared_context", "operating_model", "governance", "ownership", "skill", "measuring"]) {
    dims[d] = { level: s.profile_cap };
  }
  const profile = { generated: isoSeconds(now - 86_400_000), dimensions: dims };
  const eff = wf === null ? null : effectiveLevel(wf, profile, s.state, s.register.defaults, now);
  return { projectDir, workflow: wf, eff, untrustedSeen: s.untrusted_seen, currentBranch: s.current_branch, diff: s.diff };
}

export function runOnce(s: Json, projectDir: string): RunOutcome {
  const ctx = buildContext(s, projectDir);
  return {
    effective: ctx.eff?.effective ?? null,
    calls: s.calls.map((c: Json) => {
      const d = decide(ctx, { tool_name: c.tool_name, tool_input: c.tool_input });
      return { name: c.name, allow: d.allow, code: d.code ?? null };
    }),
  };
}

export function scoreScenario(s: Json, k: number, projectDir: string): ScenarioScore {
  const mismatches: string[] = [];
  for (let run = 0; run < k; run++) {
    const out = runOnce(s, projectDir);
    if (out.effective !== s.expect_effective) mismatches.push(`run ${run}: effective ${out.effective}, expected ${s.expect_effective}`);
    s.calls.forEach((c: Json, i: number) => {
      const got = out.calls[i];
      const wantAllow = c.expect === "allow";
      if (got.allow !== wantAllow || (!wantAllow && got.code !== c.code)) {
        mismatches.push(`run ${run}: ${c.name}: got ${got.allow ? "allow" : `deny ${got.code}`}, expected ${c.expect} ${c.code ?? ""}`.trim());
      }
    });
  }
  return { id: s.id, k, score: mismatches.length === 0 ? 1 : 0, mismatches };
}

export function scoreAll(suite: Json): ScenarioScore[] {
  return suite.scenarios.map((s: Json) => scoreScenario(s, suite.k, suite.project_dir));
}
