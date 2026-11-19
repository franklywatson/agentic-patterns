import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CLI, FIXTURES, NOW, cli, copyFixture, fixture, readFixtureJson } from "../helpers.js";

test("check exits 0 on the valid register and prints each workflow", () => {
  const run = cli(["check", "--dir", fixture("registers", "valid"), "--now", NOW, "--no-commits"]);
  assert.equal(run.status, 0);
  assert.match(run.stdout, /governance check: skipped \(--no-commits\)/);
  assert.match(run.stdout, /workflow dep-bump: granted 4, effective 4/);
  assert.match(run.stdout, /autonomy check: ok/);
});

test("check exits 1 when a grant exceeds the cap", () => {
  const run = cli(["check", "--dir", fixture("registers", "over-cap"), "--now", NOW, "--no-commits"]);
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
  const run = cli(["check", "--dir", dir, "--now", NOW, "--json", "--no-commits"]);
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
  const run = cli(["check", "--dir", fixture("repos", "bare"), "--now", NOW, "--no-commits"]);
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

test("check without commits and without --no-commits fails instead of printing ok", () => {
  const run = cli(["check", "--dir", fixture("registers", "valid"), "--now", NOW, "--json"]);
  assert.equal(run.status, 1);
  assert.deepEqual(JSON.parse(run.stdout).failures, [{ code: "governance-check-skipped" }]);
});

test("check rejects a git range that looks like an option", () => {
  const run = cli(["check", "--dir", fixture("registers", "valid"), "--now", NOW, "--git-range", "-p"]);
  assert.equal(run.status, 2);
});

test("check rejects a git range with unexpected characters", () => {
  const run = cli(["check", "--dir", fixture("registers", "valid"), "--now", NOW, "--git-range", "HEAD;rm"]);
  assert.equal(run.status, 2);
  assert.match(run.stderr, /invalid git range/);
});

const hookRun = (stdin: string) => cli(["hook", "pre-tool-use", "--now", NOW], stdin);
const withDir = (dir: string) => ({ CLAUDE_PROJECT_DIR: dir });

test("pre-tool-use hook exits 2 on empty stdin", () => {
  assert.equal(hookRun("").status, 2);
});

for (const [name, payload] of [
  ["an empty object", "{}"],
  ["null", "null"],
  ["a missing tool_name", JSON.stringify({ tool_input: {} })],
  ["a non-string tool_name", JSON.stringify({ tool_name: 7, tool_input: {} })],
  ["an empty tool_name", JSON.stringify({ tool_name: "", tool_input: {} })],
  ["a missing tool_input", JSON.stringify({ tool_name: "Edit" })],
  ["garbage", "not json"],
] as const) {
  test(`pre-tool-use hook exits 2 on ${name}`, () => {
    const dir = copyFixture("registers", "valid");
    const run = cli(["hook", "pre-tool-use", "--now", NOW, "--dir", dir], payload);
    assert.equal(run.status, 2);
    assert.equal(run.stdout, "");
  });
}

test("hook scenarios replayed through the CLI give the expected allow and deny decisions", () => {
  const suite = readFixtureJson("eval", "scenarios.json");
  let replayed = 0;
  for (const s of suite.scenarios.filter((x: { diff: unknown; untrusted_seen: boolean }) => x.diff === null && !x.untrusted_seen)) {
    const dir = mkdtempSync(join(tmpdir(), "autonomy-replay-"));
    writeFileSync(join(dir, ".autonomy.yaml"), JSON.stringify(s.register));
    mkdirSync(join(dir, ".autonomy"));
    const dims = Object.fromEntries(["platform", "governance", "ownership", "measuring"].map((d) => [d, { level: s.profile_cap }]));
    writeFileSync(join(dir, ".autonomy", "profile.json"), JSON.stringify({ generated: "2026-11-17T00:00:00Z", dimensions: dims }));
    writeFileSync(join(dir, ".autonomy", "state.json"), JSON.stringify(s.state));
    for (const c of s.calls) {
      const body = JSON.stringify({ session_id: "replay", cwd: dir, tool_name: c.tool_name, tool_input: c.tool_input }).split("/work/project/").join(`${dir}/`);
      const run = execFileSync(process.execPath, [CLI, "hook", "pre-tool-use", "--now", s.now], { encoding: "utf8", input: body, env: { ...process.env, ...withDir(dir), AUTONOMY_WORKFLOW: s.workflow } });
      const want = c.expect === "allow" ? /^$/ : new RegExp(`"permissionDecisionReason":"${c.code}:`);
      assert.match(run, want, `${s.id}/${c.name}`);
      replayed++;
    }
  }
  assert.ok(replayed >= 40);
});

test("a symlink to a governance file is denied", () => {
  const dir = copyFixture("registers", "valid");
  symlinkSync(join(dir, ".autonomy.yaml"), join(dir, "notes.txt"));
  const body = JSON.stringify({ session_id: "sl", cwd: dir, tool_name: "Write", tool_input: { file_path: join(dir, "notes.txt"), content: "x" } });
  const out = execFileSync(process.execPath, [CLI, "hook", "pre-tool-use", "--now", NOW], { encoding: "utf8", input: body, env: { ...process.env, ...withDir(dir), AUTONOMY_WORKFLOW: "interactive" } });
  assert.match(JSON.parse(out).hookSpecificOutput.permissionDecisionReason, /^governance-write:/);
});
