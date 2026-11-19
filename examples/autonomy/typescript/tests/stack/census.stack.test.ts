import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
};

for (const [name, baseline] of Object.entries(STUB_BASELINES)) {
  test(`a baseline.json with ${name} does not satisfy the baseline probe`, () => {
    const dir = gitFixtureRepo("adopter");
    writeFileSync(join(dir, ".autonomy", "baseline.json"), JSON.stringify(baseline));
    cli(["census", "--dir", dir, "--now", NOW]);
    const measuring = JSON.parse(readFileSync(join(dir, ".autonomy", "profile.json"), "utf8")).dimensions.measuring;
    assert.equal(measuring.level, 2);
    assert.ok(!measuring.evidence.includes("baseline"));
    assert.ok(measuring.missing_for_next.includes("baseline"));
  });
}
