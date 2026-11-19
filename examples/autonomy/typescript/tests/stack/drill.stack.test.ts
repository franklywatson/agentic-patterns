import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { loadRegisterFile } from "../../src/register.js";
import { NOW, cli, copyFixture } from "../helpers.js";

// The drill and the check run as separate CLI processes on one copied repository, so the only link
// between them is what the drill wrote to the register and to .autonomy/state.json.
const checkJson = (dir: string, now: string) => JSON.parse(cli(["check", "--dir", dir, "--now", now, "--json", "--no-commits"]).stdout);
const depBump = (result: { workflows: Array<{ id: string }> }) => result.workflows.find((w) => w.id === "dep-bump");
const lastTested = (dir: string) => loadRegisterFile(join(dir, ".autonomy.yaml")).workflows[0].stop.last_tested;

test("a passing drill through the CLI restores the grant a stale stop test lowered, using the date it printed", () => {
  const dir = copyFixture("registers", "valid");
  const at = "2026-12-05T00:00:00Z";
  assert.deepEqual(depBump(checkJson(dir, at)), { id: "dep-bump", granted: 4, effective: 2, reasons: ["freshness:stop-test-overdue"] });

  const drill = cli(["drill", "--workflow", "dep-bump", "--dir", dir, "--now", at]);
  assert.equal(drill.status, 0);
  const printed = JSON.parse(drill.stdout);
  assert.equal(printed.passed, true);
  assert.equal(printed.last_tested, "2026-12-05");
  assert.equal(lastTested(dir), printed.last_tested);

  const after = checkJson(dir, at);
  assert.equal(after.ok, true);
  assert.deepEqual(depBump(after), { id: "dep-bump", granted: 4, effective: 4, reasons: [] });
});

test("a failing drill through the CLI demotes the workflow in autonomy check and leaves the date alone", () => {
  const dir = copyFixture("registers", "valid");
  const path = join(dir, ".autonomy.yaml");
  const original = readFileSync(path, "utf8");
  const broken = original.replace(`command: 'touch "$AUTONOMY_STOP_FILE"'`, "command: 'true'");
  assert.notEqual(broken, original);
  writeFileSync(path, broken);
  assert.deepEqual(depBump(checkJson(dir, NOW)), { id: "dep-bump", granted: 4, effective: 4, reasons: [] });

  const drill = cli(["drill", "--workflow", "dep-bump", "--dir", dir, "--now", NOW, "--bound-ms", "500"]);
  assert.equal(drill.status, 1);
  const printed = JSON.parse(drill.stdout);
  assert.deepEqual([printed.passed, printed.reason, printed.last_tested], [false, "canary-still-running", null]);
  assert.equal(lastTested(dir), "2026-11-02");

  const after = checkJson(dir, NOW);
  assert.equal(after.ok, true);
  assert.deepEqual(depBump(after), { id: "dep-bump", granted: 4, effective: 3, reasons: ["demotion:3"] });
});
