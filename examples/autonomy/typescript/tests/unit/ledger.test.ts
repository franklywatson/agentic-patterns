import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { applyDemotion, buildReport, readLedger, wilson } from "../../src/ledger.js";
import { loadRegisterFile } from "../../src/register.js";
import { parseTime, readJson, round4 } from "../../src/util.js";
import { NOW, copyFixture, fixture, readFixtureJson } from "../helpers.js";

const now = parseTime(NOW);
const project = fixture("ledgers", "project");
const register = loadRegisterFile(join(project, ".autonomy.yaml"));
const profile = readJson(join(project, ".autonomy", "profile.json"));
const wfOf = (id: string) => register.workflows.find((w: { id: string }) => w.id === id);
const report = (id: string, wf = wfOf(id), runs = readLedger(project, id), state: unknown = null) =>
  buildReport(wf, runs, profile, state as never, register.defaults, now);

test("Wilson bounds match known values", () => {
  const a = wilson(0, 130);
  assert.equal(round4(a.lower), 0);
  assert.equal(round4(a.upper), 0.0287);
  const b = wilson(129, 130);
  assert.equal(round4(b.lower), 0.9577);
  const c = wilson(5, 5);
  assert.equal(round4(c.lower), 0.5655);
  assert.equal(round4(c.upper), 1);
});

test("Wilson bounds with no observations span the whole interval", () => {
  assert.deepEqual(wilson(0, 0), { lower: 0, upper: 1 });
});

test("five lucky runs cannot clear the 0.80 lower bound", () => {
  assert.ok(wilson(5, 5).lower < 0.8);
});

test("zero reverts clear the 3 percent upper bound only from 125 merged runs", () => {
  assert.ok(wilson(0, 124).upper > 0.03);
  assert.ok(wilson(0, 125).upper <= 0.03);
});

for (const id of ["dep-bump", "dep-hold", "dep-regress", "dep-incident"]) {
  test(`ledger report for ${id} matches the shared golden report`, () => {
    assert.deepEqual(JSON.parse(JSON.stringify(report(id))), readFixtureJson("expected", `ledger-${id}.json`));
  });
}

test("a workflow with enough clean evidence is ready for promotion", () => {
  const r = report("dep-bump");
  assert.equal(r.band, "promote");
  assert.equal(r.promotion_ready, true);
  assert.equal(r.demotion.triggered, false);
});

test("hysteresis: an upper bound between 3 and 6 percent neither promotes nor demotes", () => {
  const r = report("dep-hold");
  assert.equal(r.band, "hold");
  assert.equal(r.promotion_ready, false);
  assert.equal(r.demotion.triggered, false);
  assert.ok(r.revert.upper > 0.03 && r.revert.upper <= 0.06);
});

test("an upper bound above 6 percent with reverts demotes to level 3", () => {
  const r = report("dep-regress");
  assert.equal(r.band, "demote");
  assert.deepEqual(r.demotion, { triggered: true, to_level: 3, reasons: ["revert-upper-above-hysteresis"] });
});

test("an escaped defect demotes to level 2", () => {
  const r = report("dep-incident");
  assert.deepEqual(r.demotion, { triggered: true, to_level: 2, reasons: ["escaped-defect"] });
});

test("zero reverts in a small sample do not trigger a revert demotion", () => {
  const runs = readLedger(project, "dep-incident").map((run) => ({ ...run, escaped_defect: false }));
  const r = report("dep-incident", undefined, runs);
  assert.equal(r.demotion.triggered, false);
});

test("a run over the diff limit demotes to level 3", () => {
  const runs = readLedger(project, "dep-bump").map((run, i) => (i === 0 ? { ...run, level: 4, diff_lines: 900 } : run));
  const wf = { ...wfOf("dep-bump"), granted_level: 4 };
  const r = report("dep-bump", wf, runs);
  assert.deepEqual(r.demotion.reasons, ["diff-limit-breached"]);
  assert.equal(r.demotion.to_level, 3);
});

test("a task bank score below the floor demotes to level 3", () => {
  const runs = readLedger(project, "dep-regress").map((run) => ({ ...run, reverted_at: null, checks: { ...run.checks, "context-eval": 0.7 } }));
  const r = report("dep-regress", undefined, runs);
  assert.deepEqual(r.demotion.reasons, ["task-bank-below-floor"]);
});

test("promotion is blocked during the cooldown after a demotion", () => {
  const state = { workflows: { "dep-bump": { demoted_at: "2026-11-10" } } };
  const r = report("dep-bump", undefined, undefined, state);
  assert.equal(r.promotion_ready, false);
  assert.equal(r.criteria.find((c) => c.id === "cooldown")?.pass, false);
});

test("promotion to level 3 uses the 20-run and 0.80 criteria and lists the human sample", () => {
  const wf = { ...wfOf("dep-bump"), granted_level: 2 };
  const runs = readLedger(project, "dep-bump").slice(0, 25).map((run) => ({ ...run, level: 2 }));
  const r = report("dep-bump", wf, runs);
  assert.deepEqual(r.criteria.map((c) => c.id), ["runs-at-level", "first-run-pass-lower", "owner-named"]);
  assert.equal(r.promotion_ready, true);
  assert.deepEqual(r.manual_items, ["traced sample of 10 runs shows substantive human review"]);
});

test("a workflow at the top level has no promotion target", () => {
  const r = report("dep-bump", { ...wfOf("dep-bump"), granted_level: 5 }, []);
  assert.equal(r.target_level, null);
  assert.equal(r.promotion_ready, null);
});

test("applyDemotion writes an override and never raises an existing one", () => {
  const dir = copyFixture("ledgers", "project");
  applyDemotion(dir, "dep-regress", 3, ["revert-upper-above-hysteresis"], now);
  applyDemotion(dir, "dep-regress", 2, ["escaped-defect"], now);
  applyDemotion(dir, "dep-regress", 3, ["revert-upper-above-hysteresis"], now);
  const state = JSON.parse(readFileSync(join(dir, ".autonomy", "state.json"), "utf8"));
  assert.equal(state.workflows["dep-regress"].demotion_override, 2);
  assert.equal(state.workflows["dep-regress"].demoted_at, "2026-11-18");
});

test("readLedger fails loudly when the ledger is missing", () => {
  assert.throws(() => readLedger(project, "no-such-workflow"), /no ledger/);
});
