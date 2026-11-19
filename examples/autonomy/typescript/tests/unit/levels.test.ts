import assert from "node:assert/strict";
import { test } from "node:test";
import { capOf, dimensionLevel, effectiveLevel, profileStatus } from "../../src/levels.js";
import { parseTime } from "../../src/util.js";

const NOW = parseTime("2026-11-18T00:00:00Z");
const dims = (levels: Record<string, number | "unknown">) => ({
  generated: "2026-11-10T00:00:00Z",
  dimensions: Object.fromEntries(Object.entries(levels).map(([k, v]) => [k, v === "unknown" ? { level: "unknown", counted_as: 2 } : { level: v }])),
});
const wf = (over: Record<string, unknown> = {}) => ({
  id: "w", granted_level: 4, stop: { last_tested: "2026-11-02" }, review_date: "2027-02-01", access_expires: "2027-02-01", ...over,
});
const full = dims({ platform: 4, governance: 4, ownership: 4, measuring: 4 });

test("cap is the minimum of the four capping dimensions", () => {
  assert.equal(capOf(dims({ platform: 5, governance: 3, ownership: 4, measuring: 5 }), NOW), 3);
});

test("a dimension outside the capping four does not lower the cap", () => {
  assert.equal(capOf(dims({ platform: 4, governance: 4, ownership: 4, measuring: 4, skill: 1 }), NOW), 4);
});

test("skill recorded as unknown does not lower the cap", () => {
  assert.equal(capOf(dims({ platform: 4, governance: 4, ownership: 4, measuring: 4, skill: "unknown" }), NOW), 4);
});

test("a capping dimension recorded as unknown counts as 1", () => {
  assert.equal(dimensionLevel(dims({ measuring: "unknown" }), "measuring"), 1);
  assert.equal(capOf(dims({ platform: 4, governance: 4, ownership: 4, measuring: "unknown" }), NOW), 1);
});

test("an absent capping dimension counts as 1", () => {
  assert.equal(capOf(dims({ platform: 4, governance: 4, ownership: 4 }), NOW), 1);
});

test("a profile with no capping dimensions caps at 1", () => {
  assert.equal(capOf({ generated: "2026-11-10T00:00:00Z" }, NOW), 1);
  assert.equal(capOf({ generated: "2026-11-10T00:00:00Z", dimensions: {} }, NOW), 1);
  assert.equal(capOf({ generated: "2026-11-10T00:00:00Z", dimensions: [] }, NOW), 1);
  assert.equal(capOf({ generated: "2026-11-10T00:00:00Z", dimensions: "x" }, NOW), 1);
});

test("a dimension entry that is not an object counts as 1", () => {
  const profile = { generated: "2026-11-10T00:00:00Z", dimensions: { platform: 4, governance: { level: 4 }, ownership: { level: 4 }, measuring: { level: 4 } } };
  assert.equal(capOf(profile, NOW), 1);
});

test("a missing profile caps at 1", () => {
  assert.equal(capOf(null, NOW), 1);
  assert.equal(capOf({ dimensions: full.dimensions }, NOW), 1);
  assert.equal(capOf([] as unknown as null, NOW), 1);
  assert.equal(capOf("x" as unknown as null, NOW), 1);
  assert.equal(capOf(5 as unknown as null, NOW), 1);
});

test("a generated time in the future or not an ISO date counts as a missing profile", () => {
  for (const generated of ["2099-01-01", "2026-11-18T00:00:01Z", "November 18, 2026", "", "2026-11-18T00:00:00", "20261118", "2026-02-31"]) {
    const profile = { ...full, generated };
    assert.equal(capOf(profile, NOW), 1, generated);
    assert.equal(profileStatus(profile, NOW), "missing", generated);
    assert.equal(effectiveLevel(wf(), profile, null, {}, NOW).effective, 1, generated);
  }
  assert.equal(capOf({ ...full, generated: "2026-11-18T00:00:00Z" }, NOW), 4);
  assert.equal(capOf({ ...full, generated: "2026-11-18T01:00:00+02:00" }, NOW), 4);
});

test("a missing profile holds every grant at 1", () => {
  const e = effectiveLevel({ id: "interactive", granted_level: 2 }, null, null, {}, NOW);
  assert.equal(e.effective, 1);
  assert.deepEqual(e.reasons, ["cap:1"]);
});

test("profile status distinguishes ok, stale and missing", () => {
  assert.equal(profileStatus(full, NOW), "ok");
  assert.equal(profileStatus({ ...full, generated: "2026-10-01T00:00:00Z" }, NOW), "stale");
  assert.equal(profileStatus(null, NOW), "missing");
});

test("effective level equals the grant when every gate is open", () => {
  const e = effectiveLevel(wf(), full, null, {}, NOW);
  assert.equal(e.effective, 4);
  assert.deepEqual(e.reasons, []);
});

test("a cap below the grant lowers the effective level and names the cap", () => {
  const e = effectiveLevel(wf(), dims({ platform: 3, governance: 4, ownership: 4, measuring: 4 }), null, {}, NOW);
  assert.equal(e.effective, 3);
  assert.deepEqual(e.reasons, ["cap:3"]);
});

test("a stop test older than the default 30 days drops a level 4 workflow to 2", () => {
  const e = effectiveLevel(wf({ stop: { last_tested: "2026-10-01" } }), full, null, {}, NOW);
  assert.equal(e.effective, 2);
  assert.deepEqual(e.reasons, ["freshness:stop-test-overdue"]);
});

test("stop_test_max_age_days from the register defaults is honoured", () => {
  const e = effectiveLevel(wf({ stop: { last_tested: "2026-10-01" } }), full, null, { stop_test_max_age_days: 60 }, NOW);
  assert.equal(e.effective, 4);
});

test("a passed review date and an expired access each drop the grant to 2", () => {
  assert.equal(effectiveLevel(wf({ review_date: "2026-11-01" }), full, null, {}, NOW).effective, 2);
  assert.equal(effectiveLevel(wf({ access_expires: "2026-11-01" }), full, null, {}, NOW).effective, 2);
});

test("a stale profile drops the grant to 2", () => {
  const e = effectiveLevel(wf(), { ...full, generated: "2026-09-01T00:00:00Z" }, null, {}, NOW);
  assert.equal(e.effective, 2);
  assert.deepEqual(e.reasons, ["freshness:profile-stale"]);
});

test("a harness hash without a passing task bank caps the grant at 3", () => {
  const state = { workflows: { w: { harness_hash: "sha256:new", task_bank_passed_hash: "sha256:old" } } };
  const e = effectiveLevel(wf(), full, state, {}, NOW);
  assert.equal(e.effective, 3);
  assert.deepEqual(e.reasons, ["harness:task-bank-not-passed"]);
});

test("a matching harness hash leaves the grant alone", () => {
  const state = { workflows: { w: { harness_hash: "sha256:a", task_bank_passed_hash: "sha256:a" } } };
  assert.equal(effectiveLevel(wf(), full, state, {}, NOW).effective, 4);
});

test("a demotion override lowers the effective level", () => {
  const e = effectiveLevel(wf(), full, { workflows: { w: { demotion_override: 3 } } }, {}, NOW);
  assert.equal(e.effective, 3);
  assert.deepEqual(e.reasons, ["demotion:3"]);
});

test("the effective level is the minimum of all gates", () => {
  const state = { workflows: { w: { demotion_override: 3 } } };
  const e = effectiveLevel(wf({ review_date: "2026-11-01" }), dims({ platform: 3, governance: 4, ownership: 4, measuring: 4 }), state, {}, NOW);
  assert.equal(e.effective, 2);
});

test("counted_as in a profile cannot raise the cap: an unknown capping dimension is 1", () => {
  const forged = { generated: "2026-11-10T00:00:00Z", dimensions: { platform: { level: 4 }, governance: { level: 4 }, ownership: { level: 4 }, measuring: { level: "unknown", counted_as: 5 } } };
  assert.equal(capOf(forged, NOW), 1);
});

test("a level outside 1 to 5 counts as 1", () => {
  const dimensionsFor = (level: unknown) => ({ generated: "2026-11-10T00:00:00Z", dimensions: { platform: { level: 4 }, governance: { level: 4 }, ownership: { level: 4 }, measuring: { level } } });
  assert.equal(capOf(dimensionsFor(9), NOW), 1);
  assert.equal(capOf(dimensionsFor(0), NOW), 1);
  assert.equal(capOf(dimensionsFor(2.5), NOW), 1);
  assert.equal(capOf(dimensionsFor("4"), NOW), 1);
});

test("a state file that is not an object applies no override and does not throw", () => {
  for (const state of [[], "x", 5, { workflows: [] }, { workflows: { w: "x" } }]) {
    assert.equal(effectiveLevel(wf(), full, state, {}, NOW).effective, 4);
  }
});
