import assert from "node:assert/strict";
import { test } from "node:test";
import { runOnce, scoreAll, scoreScenario } from "../../src/eval.js";
import { readFixtureJson } from "../helpers.js";

const suite = readFixtureJson("eval", "scenarios.json");

test("the suite repeats each scenario at least 5 times", () => {
  assert.ok(suite.k >= 5);
});

test("the suite covers A2, A3, A4, cap below grant, stale stop and a trifecta session", () => {
  const ids: string[] = suite.scenarios.map((s: { id: string }) => s.id);
  for (const wanted of ["a2-reviewed", "a3-gated", "a4-unattended", "cap-below-grant", "stale-stop", "trifecta-tainted"]) {
    assert.ok(ids.includes(wanted), wanted);
  }
});

for (const scenario of suite.scenarios) {
  test(`pass^${suite.k}: ${scenario.id}`, () => {
    const score = scoreScenario(scenario, suite.k, suite.project_dir);
    assert.deepEqual(score.mismatches, []);
    assert.equal(score.score, 1);
  });
}

test("the overall score is exactly 1", () => {
  const scores = scoreAll(suite);
  assert.equal(scores.reduce((sum, s) => sum + s.score, 0), scores.length);
});

test("the scorer can fail: a wrong expectation scores 0 and names the mismatch", () => {
  const broken = structuredClone(suite.scenarios.find((s: { id: string }) => s.id === "a3-gated"));
  broken.calls[1].expect = "allow";
  const score = scoreScenario(broken, 5, suite.project_dir);
  assert.equal(score.score, 0);
  assert.equal(score.mismatches.length, 5);
  assert.match(score.mismatches[0], /push-main: got deny protected-branch-push, expected allow/);
});

test("the scorer can fail: a wrong denial code scores 0", () => {
  const broken = structuredClone(suite.scenarios.find((s: { id: string }) => s.id === "a3-gated"));
  broken.calls[1].code = "merge-blocked";
  assert.equal(scoreScenario(broken, 5, suite.project_dir).score, 0);
});

test("the scorer can fail: a wrong effective level scores 0", () => {
  const broken = structuredClone(suite.scenarios.find((s: { id: string }) => s.id === "stale-stop"));
  broken.expect_effective = 4;
  assert.equal(scoreScenario(broken, 5, suite.project_dir).score, 0);
});

test("a scenario is deterministic: repeated runs give identical outcomes", () => {
  const scenario = suite.scenarios.find((s: { id: string }) => s.id === "a4-unattended");
  const first = runOnce(scenario, suite.project_dir);
  for (let i = 0; i < 5; i++) assert.deepEqual(runOnce(scenario, suite.project_dir), first);
});

test("the same A4 grant gets different outcomes under the cap, stale-stop and clean scenarios", () => {
  const byId = (id: string) => runOnce(suite.scenarios.find((s: { id: string }) => s.id === id), suite.project_dir);
  assert.equal(byId("a4-unattended").effective, 4);
  assert.equal(byId("cap-below-grant").effective, 2);
  assert.equal(byId("stale-stop").effective, 2);
  assert.equal(byId("a4-unattended").calls.at(-1)?.allow, true);
  assert.equal(byId("cap-below-grant").calls[0].allow, false);
});
