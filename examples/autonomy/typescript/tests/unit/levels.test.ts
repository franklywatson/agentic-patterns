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
  assert.equal(capOf(dims({ platform: 5, governance: 3, ownership: 4, measuring: 5 })), 3);
});

test("a dimension outside the capping four does not lower the cap", () => {
  assert.equal(capOf(dims({ platform: 4, governance: 4, ownership: 4, measuring: 4, skill: 1 })), 4);
});

test("unknown counts as level 2", () => {
  assert.equal(dimensionLevel(dims({ measuring: "unknown" }), "measuring"), 2);
  assert.equal(capOf(dims({ platform: 4, governance: 4, ownership: 4, measuring: "unknown" })), 2);
});

test("a missing profile caps at 2", () => {
  assert.equal(capOf(null), 2);
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
