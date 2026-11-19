import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runDrill, setLastTested } from "../../src/drill.js";
import { loadRegisterFile } from "../../src/register.js";
import { parseTime } from "../../src/util.js";
import { NOW, copyFixture } from "../helpers.js";

const now = parseTime(NOW);
const drill = (dir: string, id: string, boundMs = 2000) => {
  const register = loadRegisterFile(join(dir, ".autonomy.yaml"));
  const workflow = register.workflows.find((w: { id: string }) => w.id === id);
  return runDrill({ dir, registerPath: join(dir, ".autonomy.yaml"), workflow, boundMs, now });
};

test("setLastTested replaces an existing date and keeps the rest of the file", () => {
  const text = "workflows:\n  - id: a\n    stop:\n      last_tested: 2026-01-01  # drill\n  - id: b\n    stop:\n      last_tested: 2026-02-02\n";
  assert.equal(
    setLastTested(text, "a", "2026-11-18"),
    "workflows:\n  - id: a\n    stop:\n      last_tested: 2026-11-18  # drill\n  - id: b\n    stop:\n      last_tested: 2026-02-02\n",
  );
});

test("setLastTested inserts the field into a block stop mapping", () => {
  const text = "workflows:\n  - id: a\n    stop:\n      mechanism: m\n";
  assert.equal(setLastTested(text, "a", "2026-11-18"), "workflows:\n  - id: a\n    stop:\n      last_tested: 2026-11-18\n      mechanism: m\n");
});

test("setLastTested edits a flow-style stop mapping", () => {
  const text = "workflows:\n  - id: a\n    stop: { mechanism: m, last_tested: 2026-01-01 }\n";
  assert.equal(setLastTested(text, "a", "2026-11-18"), "workflows:\n  - id: a\n    stop: { mechanism: m, last_tested: 2026-11-18 }\n");
});

test("setLastTested rejects an unknown workflow and a missing stop mapping", () => {
  assert.throws(() => setLastTested("workflows:\n  - id: a\n", "zzz", "2026-11-18"), /not found/);
  assert.throws(() => setLastTested("workflows:\n  - id: a\n    owner: t\n", "a", "2026-11-18"), /no block-style stop/);
});

test("a passing drill halts the canary within the bound and writes stop.last_tested", async () => {
  const dir = copyFixture("registers", "valid");
  const result = await drill(dir, "dep-bump");
  assert.equal(result.passed, true);
  assert.equal(result.reason, null);
  assert.ok((result.halted_in_ms as number) <= 2000);
  const register = loadRegisterFile(join(dir, ".autonomy.yaml"));
  assert.equal(register.workflows[0].stop.last_tested, "2026-11-18");
  const log = readFileSync(join(dir, ".autonomy", "drills.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(log.map((l) => [l.workflow, l.passed]), [["dep-bump", true]]);
});

test("a stop command that signals the canary process also passes", async () => {
  const dir = copyFixture("registers", "valid");
  const path = join(dir, ".autonomy.yaml");
  writeFileSync(path, readFileSync(path, "utf8").replace(`'touch "$AUTONOMY_STOP_FILE"'`, `'kill "$AUTONOMY_CANARY_PID"'`));
  const result = await drill(dir, "dep-bump");
  assert.equal(result.passed, true);
});

test("a failed drill leaves last_tested unchanged and demotes the workflow", async () => {
  const dir = copyFixture("registers", "valid");
  const path = join(dir, ".autonomy.yaml");
  writeFileSync(path, readFileSync(path, "utf8").replace(`'touch "$AUTONOMY_STOP_FILE"'`, "'true'"));
  const result = await drill(dir, "dep-bump", 500);
  assert.equal(result.passed, false);
  assert.equal(result.reason, "canary-still-running");
  assert.equal(loadRegisterFile(path).workflows[0].stop.last_tested, "2026-11-02");
  const state = JSON.parse(readFileSync(join(dir, ".autonomy", "state.json"), "utf8"));
  assert.equal(state.workflows["dep-bump"].demotion_override, 3);
  assert.deepEqual(state.workflows["dep-bump"].reasons, ["stop-drill-failed:canary-still-running"]);
});

test("a stop command that exits non-zero fails the drill", async () => {
  const dir = copyFixture("registers", "valid");
  const path = join(dir, ".autonomy.yaml");
  writeFileSync(path, readFileSync(path, "utf8").replace(`'touch "$AUTONOMY_STOP_FILE"'`, "'exit 7'"));
  const result = await drill(dir, "dep-bump", 500);
  assert.equal(result.reason, "stop-command-failed");
});

test("a workflow without a stop command fails the drill", async () => {
  const dir = copyFixture("registers", "valid");
  const result = await drill(dir, "flaky-test-triage", 500);
  assert.equal(result.passed, false);
  assert.equal(result.reason, "no-stop-command");
});
