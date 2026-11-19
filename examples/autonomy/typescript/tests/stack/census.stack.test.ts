import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { cli, NOW, gitFixtureRepo, readFixtureJson } from "../helpers.js";

test("census on the adopter repository writes the golden profile and a cap of 3", () => {
  const dir = gitFixtureRepo("adopter");
  const run = cli(["census", "--dir", dir, "--now", NOW]);
  assert.equal(run.status, 0);
  const profile = JSON.parse(readFileSync(join(dir, ".autonomy", "profile.json"), "utf8"));
  assert.deepEqual(profile, readFixtureJson("expected", "census-adopter.json"));
  assert.equal(profile.cap, 3);
  assert.deepEqual(profile.workflows_over_cap, ["dep-bump"]);
  assert.deepEqual(
    Object.fromEntries(Object.entries(profile.dimensions).map(([k, v]) => [k, (v as { level: unknown }).level])),
    { platform: 3, shared_context: 3, operating_model: 4, governance: 3, ownership: 3, skill: "unknown", measuring: 3 },
  );
});

test("census counts an unknown dimension as level 2 and writes a dated worksheet", () => {
  const dir = gitFixtureRepo("adopter");
  cli(["census", "--dir", dir, "--now", NOW]);
  const profile = JSON.parse(readFileSync(join(dir, ".autonomy", "profile.json"), "utf8"));
  assert.deepEqual(profile.dimensions.skill, { level: "unknown", counted_as: 2, evidence: [], missing_for_next: ["worksheet:skill"] });
  const worksheet = JSON.parse(readFileSync(join(dir, ".autonomy", "worksheet.json"), "utf8"));
  assert.equal(worksheet.generated, NOW);
  assert.deepEqual(worksheet.items.map((i: { dimension: string; step: string }) => `${i.dimension}/${i.step}`), [
    "skill/work-sample",
    "skill/perception-survey",
    "operating_model/merge-sample",
    "shared_context/governed-connectors",
  ]);
});

test("census on a bare repository gives a cap of 1", () => {
  const dir = gitFixtureRepo("bare");
  cli(["census", "--dir", dir, "--now", NOW]);
  const profile = JSON.parse(readFileSync(join(dir, ".autonomy", "profile.json"), "utf8"));
  assert.deepEqual(profile, readFixtureJson("expected", "census-bare.json"));
  assert.equal(profile.cap, 1);
  assert.equal(profile.dimensions.shared_context.level, 2);
});

test("presence without practice does not count: a stale CLAUDE.md loses the freshness probe", () => {
  const dir = gitFixtureRepo("adopter", "2026-01-01T00:00:00Z");
  cli(["census", "--dir", dir, "--now", NOW]);
  const profile = JSON.parse(readFileSync(join(dir, ".autonomy", "profile.json"), "utf8"));
  assert.equal(profile.dimensions.shared_context.level, 2);
  assert.deepEqual(profile.dimensions.shared_context.missing_for_next, ["claude-md-fresh", "decision-log"]);
});

function skillProfile(date: string) {
  const dir = gitFixtureRepo("adopter");
  mkdirSync(join(dir, ".autonomy", "worksheets"), { recursive: true });
  writeFileSync(join(dir, ".autonomy", "worksheets", "skill.json"), JSON.stringify({ date, level: 3 }));
  cli(["census", "--dir", dir, "--now", NOW]);
  return JSON.parse(readFileSync(join(dir, ".autonomy", "profile.json"), "utf8")).dimensions.skill;
}

test("a skill worksheet result within 90 days replaces unknown", () => {
  assert.deepEqual(skillProfile("2026-11-01"), { level: 3, evidence: ["worksheet:skill"], missing_for_next: [] });
});

test("a skill worksheet result older than 90 days reverts to unknown", () => {
  assert.equal(skillProfile("2026-06-01").level, "unknown");
});

test("check fails on the census output of the adopter repository because dep-bump exceeds the cap", () => {
  const dir = gitFixtureRepo("adopter");
  assert.equal(cli(["census", "--dir", dir, "--now", NOW]).status, 0);
  const run = cli(["check", "--dir", dir, "--now", NOW, "--json", "--no-commits"]);
  assert.equal(run.status, 1);
  assert.deepEqual(JSON.parse(run.stdout).failures, [{ code: "grant-exceeds-cap", workflow: "dep-bump", granted: 4, cap: 3 }]);
});

test("check passes after the grant is lowered to the cap", () => {
  const dir = gitFixtureRepo("adopter");
  cli(["census", "--dir", dir, "--now", NOW]);
  const path = join(dir, ".autonomy.yaml");
  const original = readFileSync(path, "utf8");
  const lowered = original.replace("granted_level: 4", "granted_level: 3");
  assert.notEqual(lowered, original);
  writeFileSync(path, lowered);
  assert.equal(cli(["check", "--dir", dir, "--now", NOW, "--no-commits"]).status, 0);
});

const RULES_CASES: Array<[string, boolean]> = [
  ["rules-import", true],
  ["rules-claude-only", true],
  ["rules-agents-only", true],
  ["rules-agents-not-imported", false],
  ["rules-none", false],
];

for (const [name, expected] of RULES_CASES) {
  test(`constitutional-rules probe on ${name} is ${expected ? "met" : "not met"}`, () => {
    const dir = gitFixtureRepo(name);
    cli(["census", "--dir", dir, "--now", NOW]);
    const profile = JSON.parse(readFileSync(join(dir, ".autonomy", "profile.json"), "utf8"));
    assert.equal(profile.dimensions.governance.evidence.includes("constitutional-rules"), expected);
    assert.equal(profile.dimensions.governance.level, expected ? 2 : 1);
  });
}

const STUB_BASELINES: Record<string, object | string> = {
  "empty flow object": { captured: "2026-10-20", flow: {}, stability: { change_failure_rate: 0.08 } },
  "empty stability object": { captured: "2026-10-20", flow: { median_cycle_hours: 31 }, stability: {} },
  "flow that is not an object": { captured: "2026-10-20", flow: "fast", stability: { change_failure_rate: 0.08 } },
  "missing stability": { captured: "2026-10-20", flow: { median_cycle_hours: 31 } },
  "null values only": { captured: "2026-10-20", flow: { x: null }, stability: { y: null } },
  "placeholder strings": { captured: "2026-10-20", flow: { lead_time: "TBD" }, stability: { change_failure_rate: "TBD" } },
  "a capture date in the future": { captured: "2099-01-01", flow: { median_cycle_hours: 31 }, stability: { change_failure_rate: 0.08 } },
  "a capture date that is not ISO": { captured: "October 20, 2026", flow: { median_cycle_hours: 31 }, stability: { change_failure_rate: 0.08 } },
  "a file that is not an object": "[1]",
};

for (const [name, baseline] of Object.entries(STUB_BASELINES)) {
  test(`a baseline.json with ${name} does not satisfy the baseline probe`, () => {
    const dir = gitFixtureRepo("adopter");
    writeFileSync(join(dir, ".autonomy", "baseline.json"), typeof baseline === "string" ? baseline : JSON.stringify(baseline));
    cli(["census", "--dir", dir, "--now", NOW]);
    const measuring = JSON.parse(readFileSync(join(dir, ".autonomy", "profile.json"), "utf8")).dimensions.measuring;
    assert.equal(measuring.level, 2);
    assert.ok(!measuring.evidence.includes("baseline"));
    assert.ok(measuring.missing_for_next.includes("baseline"));
  });
}

// Shared with the Python suite: fixtures/census/non-author-approval.json.
const APPROVAL_CASES: Array<{ name: string; ruleset: object | string; files: Record<string, string | null>; met: boolean }> =
  readFixtureJson("census", "non-author-approval.json").cases;

for (const c of APPROVAL_CASES) {
  test(`non-author-approval on ${c.name} is ${c.met ? "met" : "not met"}`, () => {
    const dir = gitFixtureRepo("adopter");
    writeFileSync(join(dir, ".github", "rulesets", "main.json"), typeof c.ruleset === "string" ? c.ruleset : JSON.stringify(c.ruleset));
    for (const [path, text] of Object.entries(c.files)) {
      if (text === null) rmSync(join(dir, path));
      else writeFileSync(join(dir, path), text);
    }
    assert.equal(cli(["census", "--dir", dir, "--now", NOW]).status, 0);
    const governance = JSON.parse(readFileSync(join(dir, ".autonomy", "profile.json"), "utf8")).dimensions.governance;
    assert.equal(governance.evidence.includes("non-author-approval"), c.met);
    assert.equal(governance.missing_for_next.includes("non-author-approval"), !c.met);
  });
}

const commitAt = (dir: string, date: string) => {
  const env = { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  const run = (args: string[]) => execFileSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", ...args], { cwd: dir, env, stdio: "ignore" });
  run(["add", "-A"]);
  run(["commit", "-q", "-m", "change"]);
};
const sharedContext = (dir: string) => {
  assert.equal(cli(["census", "--dir", dir, "--now", NOW]).status, 0);
  return JSON.parse(readFileSync(join(dir, ".autonomy", "profile.json"), "utf8")).dimensions;
};

test("claude-md-fresh follows @AGENTS.md: a recent AGENTS.md change keeps an old CLAUDE.md fresh", () => {
  const dir = gitFixtureRepo("rules-import", "2026-01-01T00:00:00Z");
  assert.ok(sharedContext(dir).shared_context.missing_for_next.includes("claude-md-fresh"));
  appendFileSync(join(dir, "AGENTS.md"), "2. Every change has a test.\n");
  commitAt(dir, "2026-11-01T00:00:00Z");
  assert.ok(!sharedContext(dir).shared_context.missing_for_next.includes("claude-md-fresh"));
});

test("claude-md-fresh ignores an AGENTS.md that CLAUDE.md does not import", () => {
  const dir = gitFixtureRepo("rules-agents-not-imported", "2026-01-01T00:00:00Z");
  appendFileSync(join(dir, "AGENTS.md"), "2. Every change has a test.\n");
  commitAt(dir, "2026-11-01T00:00:00Z");
  assert.ok(sharedContext(dir).shared_context.missing_for_next.includes("claude-md-fresh"));
});

test("claude-md-short counts CLAUDE.md and the imported AGENTS.md together against 200 lines", () => {
  const dir = gitFixtureRepo("rules-import");
  const claudeLines = readFileSync(join(dir, "CLAUDE.md"), "utf8").split("\n").length - 1;
  const agentsLines = readFileSync(join(dir, "AGENTS.md"), "utf8").split("\n").length - 1;
  writeFileSync(join(dir, "AGENTS.md"), `${readFileSync(join(dir, "AGENTS.md"), "utf8")}${"- rule\n".repeat(200 - claudeLines - agentsLines)}`);
  assert.ok(!sharedContext(dir).shared_context.missing_for_next.includes("claude-md-short"));
  appendFileSync(join(dir, "AGENTS.md"), "- one more\n");
  assert.ok(sharedContext(dir).shared_context.missing_for_next.includes("claude-md-short"));
});

test("check-command and author-trailer read the AGENTS.md that CLAUDE.md imports", () => {
  const dir = gitFixtureRepo("adopter");
  writeFileSync(join(dir, "AGENTS.md"), readFileSync(join(dir, "CLAUDE.md"), "utf8"));
  writeFileSync(join(dir, "CLAUDE.md"), "# Adopter project\n\n@AGENTS.md\n");
  const dims = sharedContext(dir);
  assert.equal(dims.platform.level, 3);
  assert.ok(dims.platform.evidence.includes("check-command"));
  assert.equal(dims.ownership.level, 3);
  assert.ok(dims.ownership.evidence.includes("author-trailer"));
});

test("the census text output names the probes that block each dimension's next position", () => {
  const dir = gitFixtureRepo("bare");
  const lines = cli(["census", "--dir", dir, "--now", NOW]).stdout.trim().split("\n");
  assert.deepEqual(lines.slice(1, 10), [
    "cap: 1",
    "platform: 1 (next: agent-config)",
    "shared_context: 2 (next: claude-md-owner, decision-log, blocking-hook-tested)",
    "operating_model: 1 (next: ci-tests-lint)",
    "governance: 1 (next: constitutional-rules)",
    "ownership: 1 (next: register-owners)",
    "skill: unknown (next: worksheet:skill)",
    "measuring: 1 (next: outcome-tracking)",
    `worksheet: ${join(dir, ".autonomy", "worksheet.json")}`,
  ]);
});
