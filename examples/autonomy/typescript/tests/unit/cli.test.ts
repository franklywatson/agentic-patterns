import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { FIXTURES, NOW, cli, copyFixture, fixture } from "../helpers.js";

test("check exits 0 on the valid register and prints each workflow", () => {
  const run = cli(["check", "--dir", fixture("registers", "valid"), "--now", NOW]);
  assert.equal(run.status, 0);
  assert.match(run.stdout, /workflow dep-bump: granted 4, effective 4/);
  assert.match(run.stdout, /autonomy check: ok/);
});

test("check exits 1 when a grant exceeds the cap", () => {
  const run = cli(["check", "--dir", fixture("registers", "over-cap"), "--now", NOW]);
  assert.equal(run.status, 1);
  assert.match(run.stdout, /grant-exceeds-cap/);
  assert.match(run.stdout, /autonomy check: FAILED/);
});

test("check exits 1 when an agent commit changed a governance file", () => {
  const run = cli(["check", "--dir", fixture("registers", "valid"), "--now", NOW, "--commits", fixture("commits", "agent-edits-register.json")]);
  assert.equal(run.status, 1);
  assert.match(run.stdout, /governance-file-changed-by-agent/);
});

test("check exits 0 when only a human changed governance files", () => {
  const run = cli(["check", "--dir", fixture("registers", "valid"), "--now", NOW, "--commits", fixture("commits", "human-edits-register.json")]);
  assert.equal(run.status, 0);
});

test("ledger prints a Markdown evidence report and exits 0", () => {
  const run = cli(["ledger", "--dir", fixture("ledgers", "project"), "--workflow", "dep-bump", "--now", NOW]);
  assert.equal(run.status, 0);
  assert.match(run.stdout, /\| revert-upper \| <= 0.03 \| 0.0287 \| pass \|/);
});

test("ledger --apply-demotion writes the override and a later check shows the lowered level", () => {
  const dir = copyFixture("ledgers", "project");
  assert.equal(cli(["ledger", "--dir", dir, "--workflow", "dep-regress", "--now", NOW, "--apply-demotion"]).status, 0);
  const run = cli(["check", "--dir", dir, "--now", NOW, "--json"]);
  const dep = JSON.parse(run.stdout).workflows.find((w: { id: string }) => w.id === "dep-regress");
  assert.deepEqual(dep, { id: "dep-regress", granted: 4, effective: 3, reasons: ["demotion:3"] });
});

test("the hook subcommand reads JSON on stdin and prints the deny decision", () => {
  const dir = copyFixture("registers", "valid");
  const input = JSON.stringify({ session_id: "cli", cwd: dir, hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: `${dir}/CODEOWNERS`, content: "x" } });
  const run = cli(["hook", "pre-tool-use", "--now", NOW], input);
  assert.equal(run.status, 0);
  assert.equal(JSON.parse(run.stdout).hookSpecificOutput.permissionDecision, "deny");
});

test("an unknown command exits 2 with usage on stderr", () => {
  const run = cli(["frobnicate"]);
  assert.equal(run.status, 2);
  assert.match(run.stderr, /usage: autonomy/);
});

test("a missing register is a loud error with exit code 2", () => {
  const run = cli(["check", "--dir", fixture("repos", "bare"), "--now", NOW]);
  assert.equal(run.status, 2);
  assert.match(run.stderr, /autonomy: /);
});

test("the hook settings examples name SessionStart and PreToolUse and call the hook subcommands", () => {
  for (const file of ["settings.typescript.example.json", "settings.python.example.json"]) {
    const settings = JSON.parse(readFileSync(join(FIXTURES, "..", "hooks", file), "utf8"));
    assert.deepEqual(Object.keys(settings.hooks).sort(), ["PreToolUse", "SessionStart"]);
    assert.match(settings.hooks.PreToolUse[0].hooks[0].command, /hook pre-tool-use$/);
    assert.match(settings.hooks.SessionStart[0].hooks[0].command, /hook session-start$/);
    assert.equal(settings.hooks.PreToolUse[0].hooks[0].type, "command");
  }
});
