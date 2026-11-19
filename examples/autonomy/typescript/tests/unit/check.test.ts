import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { approvedPrefixes, commitsFromGit, formatCheck, isAgentCommit, isGovernanceFile, isLockedFile, isWorkflowFile, runCheck } from "../../src/check.js";
import type { Commit } from "../../src/check.js";
import { parseTime } from "../../src/util.js";
import { NOW, copyFixture, fixture, readFixtureJson } from "../helpers.js";

const now = parseTime(NOW);

test("check on the valid register matches the shared golden result", () => {
  const result = runCheck({ dir: fixture("registers", "valid"), now });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), readFixtureJson("expected", "check-valid.json"));
});

test("check fails when a grant exceeds the cap, matching the shared golden result", () => {
  const result = runCheck({ dir: fixture("registers", "over-cap"), now });
  assert.equal(result.ok, false);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), readFixtureJson("expected", "check-over-cap.json"));
});

test("check fails when the profile is older than 30 days", () => {
  const result = runCheck({ dir: fixture("registers", "valid"), now: parseTime("2026-12-20T00:00:00Z") });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "profile-stale"));
});

test("check fails when the profile is missing", () => {
  const dir = copyFixture("registers", "valid");
  execFileSync("rm", [join(dir, ".autonomy", "profile.json")]);
  const result = runCheck({ dir, now });
  assert.deepEqual(result.failures, [
    { code: "profile-missing" },
    { code: "grant-exceeds-cap", workflow: "dep-bump", granted: 4, cap: 1 },
    { code: "grant-exceeds-cap", workflow: "flaky-test-triage", granted: 3, cap: 1 },
    { code: "grant-exceeds-cap", workflow: "interactive", granted: 3, cap: 1 },
  ]);
});

const MISSING_FAILURES = [
  { code: "profile-missing" },
  { code: "grant-exceeds-cap", workflow: "dep-bump", granted: 4, cap: 1 },
  { code: "grant-exceeds-cap", workflow: "flaky-test-triage", granted: 3, cap: 1 },
  { code: "grant-exceeds-cap", workflow: "interactive", granted: 3, cap: 1 },
];

for (const [name, text] of [
  ["a JSON array", "[]"],
  ["a JSON string", "\"x\""],
  ["a date that is not ISO", "{\"generated\":\"November 18, 2026\"}"],
  ["a date in the future", "{\"generated\":\"2099-01-01\",\"dimensions\":{\"platform\":{\"level\":5},\"governance\":{\"level\":5},\"ownership\":{\"level\":5},\"measuring\":{\"level\":5}}}"],
] as const) {
  test(`a profile that is ${name} counts as missing and does not throw`, () => {
    const dir = copyFixture("registers", "valid");
    writeFileSync(join(dir, ".autonomy", "profile.json"), text);
    const result = runCheck({ dir, now });
    assert.equal(result.cap, 1);
    assert.equal(result.profile_age_days, null);
    assert.deepEqual(result.failures, MISSING_FAILURES);
  });
}

test("a profile with no capping dimensions caps at 1 without being missing", () => {
  const dir = copyFixture("registers", "valid");
  writeFileSync(join(dir, ".autonomy", "profile.json"), JSON.stringify({ generated: "2026-11-17T00:00:00Z", dimensions: {} }));
  const result = runCheck({ dir, now });
  assert.equal(result.cap, 1);
  assert.equal(result.profile_age_days, 1);
  assert.deepEqual(result.failures, MISSING_FAILURES.slice(1));
});

test("check reports schema errors and stops", () => {
  const dir = copyFixture("registers", "valid");
  const text = `version: 1\nworkflows:\n  - id: w\n    owner: t\n    sponsor: s\n    granted_level: 3\n    identity: x\n    exception: waiver\n    risk: { reversible: true, verification: partial, blast_radius: repo, trifecta: { untrusted_input: false, sensitive_data: false, external_action: false } }\n`;
  writeFileSync(join(dir, ".autonomy.yaml"), text);
  const result = runCheck({ dir, now });
  assert.equal(result.ok, false);
  assert.deepEqual(result.failures, [{ code: "schema", path: "/workflows/0/exception", keyword: "additionalProperties" }]);
});

test("check passes a stale stop test but lowers the effective level", () => {
  const dir = copyFixture("registers", "valid");
  const result = runCheck({ dir, now: parseTime("2026-12-05T00:00:00Z") });
  const dep = result.workflows.find((w) => w.id === "dep-bump");
  assert.equal(result.ok, true);
  assert.deepEqual(dep, { id: "dep-bump", granted: 4, effective: 2, reasons: ["freshness:stop-test-overdue"] });
});

const agentCommit = (files: string[]): Commit => ({ sha: "a1", author: "deps-bot[bot]", email: "bot@example.invalid", files });
const humanCommit = (files: string[]): Commit => ({ sha: "h1", author: "Alice", email: "alice@example.invalid", files });

test("an agent commit that changes .autonomy.yaml fails the check", () => {
  const result = runCheck({ dir: fixture("registers", "valid"), now, commits: [agentCommit([".autonomy.yaml"])] });
  assert.deepEqual(result.failures, [{ code: "governance-file-changed-by-agent", commit: "a1", file: ".autonomy.yaml" }]);
});

test("an agent commit that changes CODEOWNERS or a workflow file fails the check", () => {
  const result = runCheck({ dir: fixture("registers", "valid"), now, commits: [agentCommit(["docs/CODEOWNERS", ".github/workflows/ci.yml", "src/a.ts"])] });
  assert.deepEqual(result.failures.map((f) => [f.code, f.file]), [
    ["governance-file-changed-by-agent", "docs/CODEOWNERS"],
    ["workflow-change-unacknowledged", ".github/workflows/ci.yml"],
  ]);
});

test("a human commit that changes governance files passes the check", () => {
  const result = runCheck({ dir: fixture("registers", "valid"), now, commits: [humanCommit([".autonomy.yaml", "CODEOWNERS"])] });
  assert.equal(result.ok, true);
});

test("a commit by a register identity or a Claude co-author is an agent commit", () => {
  assert.equal(isAgentCommit({ sha: "x", author: "deps-bot", email: "a@b.c", files: [] }, ["deps-bot"]), true);
  assert.equal(isAgentCommit({ sha: "x", author: "Alice", email: "a@b.c", body: "Co-Authored-By: Claude <x@y.z>", files: [] }, []), true);
  assert.equal(isAgentCommit({ sha: "x", author: "Alice", email: "a@b.c", files: [] }, ["deps-bot"]), false);
});

test("governance file patterns", () => {
  for (const p of [".autonomy.yaml", ".autonomy/state.json", "CODEOWNERS", ".github/CODEOWNERS", ".github/workflows/ci.yml"]) {
    assert.equal(isGovernanceFile(p), true, p);
  }
  for (const p of ["src/autonomy.ts", "docs/autonomy.md", ".github/dependabot.yml"]) assert.equal(isGovernanceFile(p), false, p);
});

test("commitsFromGit reads authors and changed files from a real repository", () => {
  const dir = copyFixture("registers", "valid");
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=deps-bot[bot]", "-c", "user.email=bot@example.invalid", ...args], { cwd: dir, stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  appendFileSync(join(dir, ".autonomy.yaml"), "# edited\n");
  git("commit", "-q", "-am", "agent edit");
  const commits = commitsFromGit(dir, "HEAD~1..HEAD");
  assert.equal(commits.length, 1);
  assert.deepEqual(commits[0].files, [".autonomy.yaml"]);
  assert.equal(commits[0].author, "deps-bot[bot]");
  const result = runCheck({ dir, now, commits });
  assert.ok(result.failures.some((f) => f.code === "governance-file-changed-by-agent"));
});

test("a commit body containing @@ and unit separators is parsed intact", () => {
  const dir = copyFixture("registers", "valid");
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=Alice", "-c", "user.email=alice@example.invalid", ...args], { cwd: dir, stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  appendFileSync(join(dir, ".autonomy.yaml"), "# edited\n");
  git("commit", "-q", "-am", "edit\n\n@@ hunk @@ in the body\nCo-Authored-By: Claude <c@example.invalid>");
  const commits = commitsFromGit(dir, "HEAD~1..HEAD");
  assert.equal(commits.length, 1);
  assert.deepEqual(commits[0].files, [".autonomy.yaml"]);
  assert.match(commits[0].body ?? "", /@@ hunk @@ in the body/);
  assert.equal(isAgentCommit(commits[0], []), true);
});

test("a rename out of a governed path still lists the old path", () => {
  const dir = copyFixture("registers", "valid");
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
  writeFileSync(join(dir, ".github", "workflows", "ci.yml"), "name: ci\non: push\njobs: {}\n");
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=deps-bot[bot]", "-c", "user.email=bot@example.invalid", ...args], { cwd: dir, stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  mkdirSync(join(dir, "elsewhere"));
  git("mv", ".github/workflows/ci.yml", "elsewhere/ci.yml");
  git("commit", "-q", "-m", "move");
  const commits = commitsFromGit(dir, "HEAD~1..HEAD");
  assert.deepEqual([...commits[0].files].sort(), [".github/workflows/ci.yml", "elsewhere/ci.yml"]);
  const result = runCheck({ dir, now, commits });
  assert.deepEqual(result.failures, [{ code: "workflow-change-unacknowledged", commit: commits[0].sha, file: ".github/workflows/ci.yml" }]);
});

test("commitsFromGit rejects ranges that are not revisions", () => {
  assert.throws(() => commitsFromGit(fixture("registers", "valid"), "--output=x"), /invalid git range/);
  assert.throws(() => commitsFromGit(fixture("registers", "valid"), "a b"), /invalid git range/);
});

test("governance patterns are case-insensitive and cover hook configuration", () => {
  for (const p of [".AUTONOMY.yaml", "codeowners", "Docs/CodeOwners", ".GitHub/Workflows/ci.yml", ".claude/settings.json", ".claude/settings.local.json", ".claude/hooks/guard.sh", ".harness.yaml"]) {
    assert.equal(isGovernanceFile(p), true, p);
  }
  assert.equal(isGovernanceFile(".claude/commands/review.md"), false);
});

test("a profile path outside .autonomy/ is a schema error, so the cap file stays a locked file", () => {
  for (const profile of ["../../elsewhere/profile.json", "docs/profile.json", ".autonomy/../docs/profile.json", ".autonomy/..", "/etc/profile.json"]) {
    const dir = copyFixture("registers", "valid");
    const path = join(dir, ".autonomy.yaml");
    writeFileSync(path, readFileSync(path, "utf8").replace("profile: .autonomy/profile.json", `profile: "${profile}"`));
    assert.deepEqual(runCheck({ dir, now }).failures, [{ code: "schema", path: "/profile", keyword: "pattern" }], profile);
  }
});

// Shared with the Python suite: fixtures/parity/governance-paths.json.
test("governance paths are compared after Unicode folding and trailing dot and space removal", () => {
  for (const c of readFixtureJson("parity", "governance-paths.json").cases) {
    const got = isLockedFile(c.path) ? "locked" : isWorkflowFile(c.path) ? "workflow" : "none";
    assert.equal(got, c.class, `${JSON.stringify(c.path)}: ${c.why}`);
  }
});

test("an agent commit to a folded governance name or a composite action fails the check", () => {
  const result = runCheck({ dir: fixture("registers", "valid"), now, commits: [agentCommit([".claude/\u017fettings.json", ".harne\u00df.yaml", ".github/actions/setup/action.yml"])] });
  assert.deepEqual(result.failures.map((f) => [f.code, f.file]), [
    ["governance-file-changed-by-agent", ".claude/\u017fettings.json"],
    ["governance-file-changed-by-agent", ".harne\u00df.yaml"],
    ["workflow-change-unacknowledged", ".github/actions/setup/action.yml"],
  ]);
});

test("an impossible calendar date is a schema error, not a crash", () => {
  const dir = copyFixture("registers", "valid");
  const path = join(dir, ".autonomy.yaml");
  writeFileSync(path, readFileSync(path, "utf8").replace("review_date: 2027-02-01", "review_date: 2027-02-31"));
  const result = runCheck({ dir, now });
  assert.deepEqual(result.failures, [{ code: "schema", path: "/workflows/0/review_date", keyword: "format" }]);
});

const commitsFixture = (name: string): Commit[] => readFixtureJson("commits", `${name}.json`);
const checkCommits = (name: string) => runCheck({ dir: fixture("registers", "valid"), now, commits: commitsFixture(name) });
const A1 = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const A2 = "b2c3d4e5f60718293a4b5c6d7e8f901234567890";
const H1 = "c3d4e5f60718293a4b5c6d7e8f90123456789012";
const unacknowledged = (commit: string, file: string) => ({ code: "workflow-change-unacknowledged", commit, file });

test("a locked file still fails when a later human commit carries an acknowledgement line", () => {
  const result = checkCommits("governance-locked-with-ack");
  assert.deepEqual(result.failures, [{ code: "governance-file-changed-by-agent", commit: A1, file: ".autonomy.yaml" }]);
  assert.deepEqual(result.acknowledged, []);
});

test("an unacknowledged agent change to a workflow fails with workflow-change-unacknowledged", () => {
  assert.deepEqual(checkCommits("governance-workflow-unacknowledged").failures, [unacknowledged(A1, ".github/workflows/ci.yml")]);
});

test("a workflow change acknowledged by a later human commit passes and is reported", () => {
  const result = checkCommits("governance-workflow-acknowledged");
  assert.equal(result.ok, true);
  assert.deepEqual(result.acknowledged, [{ commit: A1, file: ".github/workflows/ci.yml", by: H1 }]);
  assert.match(formatCheck(result), /^governance: a1b2c3d changed \.github\/workflows\/ci\.yml \(acknowledged by c3d4e5f\)$/m);
});

test("an acknowledgement by an agent commit does not count", () => {
  assert.deepEqual(checkCommits("governance-workflow-ack-by-agent").failures, [unacknowledged(A1, ".github/workflows/ci.yml")]);
});

test("an acknowledgement that comes before the agent commit does not count", () => {
  assert.deepEqual(checkCommits("governance-workflow-ack-before").failures, [unacknowledged(A1, ".github/workflows/ci.yml")]);
});

test("an acknowledgement with a 6 character prefix does not count", () => {
  assert.deepEqual(checkCommits("governance-workflow-ack-short-prefix").failures, [unacknowledged(A1, ".github/workflows/ci.yml")]);
});

test("an acknowledgement for a different sha does not count", () => {
  assert.deepEqual(checkCommits("governance-workflow-ack-wrong-sha").failures, [unacknowledged(A1, ".github/workflows/ci.yml")]);
});

test("a case-variant workflow path is a workflow file", () => {
  assert.equal(isWorkflowFile(".GitHub/Workflows/x.yml"), true);
  assert.equal(isLockedFile(".GitHub/Workflows/x.yml"), false);
  assert.deepEqual(checkCommits("governance-workflow-case-variant").failures, [unacknowledged(A1, ".GitHub/Workflows/x.yml")]);
});

test("with two agent commits, only the acknowledged one passes", () => {
  const result = checkCommits("governance-workflow-two-agents-one-acked");
  assert.deepEqual(result.failures, [unacknowledged(A2, ".github/workflows/release.yml")]);
  assert.deepEqual(result.acknowledged, [{ commit: A1, file: ".github/workflows/ci.yml", by: H1 }]);
});

test("acknowledgement lines are parsed strictly", () => {
  assert.deepEqual(approvedPrefixes("x\nGovernance-Approved: a1b2c3d\ngovernance-approved:A1B2C3D4"), ["a1b2c3d", "a1b2c3d4"]);
  assert.deepEqual(approvedPrefixes("subject\nGovernance-Approved: a1b2c3\nGovernance-Approved: a1b2c3dzz\n see Governance-Approved: a1b2c3d"), []);
});

test("commitsFromGit lists commits oldest first so a later acknowledgement is found", () => {
  const dir = copyFixture("registers", "valid");
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
  const git = (name: string, ...args: string[]) => execFileSync("git", ["-c", `user.name=${name}`, "-c", "user.email=a@example.invalid", ...args], { cwd: dir, stdio: "ignore" });
  git("Alice", "init", "-q");
  git("Alice", "add", "-A");
  git("Alice", "commit", "-q", "-m", "base");
  writeFileSync(join(dir, ".github", "workflows", "ci.yml"), "name: ci\non: push\njobs: {}\n");
  git("deps-bot[bot]", "add", "-A");
  git("deps-bot[bot]", "commit", "-q", "-m", "add ci");
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
  git("Alice", "commit", "-q", "--allow-empty", "-m", `approve\n\nGovernance-Approved: ${sha.slice(0, 7)}`);
  const commits = commitsFromGit(dir, "HEAD~2..HEAD");
  assert.equal(commits[0].sha, sha);
  const result = runCheck({ dir, now, commits });
  assert.equal(result.ok, true);
  assert.equal(result.acknowledged.length, 1);
});

const WF = ".github/workflows/ci.yml";
const B1 = "a1b2c3d0e5f60718293a4b5c6d7e8f9012345678";

test("an acknowledgement prefix that matches two agent commits acknowledges neither", () => {
  const result = checkCommits("governance-workflow-ack-ambiguous-prefix");
  assert.deepEqual(result.failures, [unacknowledged(A1, WF), unacknowledged(B1, ".github/workflows/release.yml")]);
  assert.deepEqual(result.acknowledged, []);
});

test("a longer prefix that names one agent commit acknowledges only that commit", () => {
  const result = checkCommits("governance-workflow-ack-disambiguated-prefix");
  assert.deepEqual(result.failures, [unacknowledged(B1, ".github/workflows/release.yml")]);
  assert.deepEqual(result.acknowledged, [{ commit: A1, file: WF, by: H1 }]);
});

for (const name of [
  "governance-workflow-ack-subject-line",
  "governance-workflow-ack-cr",
  "governance-workflow-ack-crlf",
  "governance-workflow-ack-line-separator",
  "governance-workflow-ack-by-anthropic-coauthor",
  "governance-workflow-ack-by-agent-committer",
]) {
  test(`${name} does not acknowledge`, () => {
    const result = checkCommits(name);
    assert.deepEqual(result.failures, [unacknowledged(A1, WF)]);
    assert.deepEqual(result.acknowledged, []);
  });
}

test("one commit that touches a locked and a workflow file fails the locked file and still reports the acknowledged workflow file", () => {
  const result = checkCommits("governance-locked-and-workflow-one-commit");
  assert.deepEqual(result.failures, [{ code: "governance-file-changed-by-agent", commit: A1, file: ".autonomy.yaml" }]);
  assert.deepEqual(result.acknowledged, [{ commit: A1, file: WF, by: H1 }]);
});

test("any Claude or Anthropic co-author trailer marks an agent commit, and the committer counts", () => {
  const body = (b: string) => ({ sha: "x", author: "Alice", email: "a@b.c", body: b, files: [] });
  for (const b of ["m\n\nCo-Authored-By: Anthropic Claude <x@y.z>", "m\n\nco-authored-by: claude", "m\n\nCO-AUTHORED-BY: Someone <n@anthropic.com>"]) {
    assert.equal(isAgentCommit(body(b), []), true, b);
  }
  assert.equal(isAgentCommit(body("m\n\nCo-Authored-By: Bob <b@example.invalid>"), []), false);
  assert.equal(isAgentCommit({ ...body("m"), committer: "deps-bot[bot]", committer_email: "x@y.z" }, []), true);
});

const repoWith = (author = "Alice") => {
  const dir = copyFixture("registers", "valid");
  const run = (name: string, args: string[], env: Record<string, string> = {}) =>
    execFileSync("git", ["-c", `user.name=${name}`, "-c", "user.email=a@example.invalid", ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, ...env } });
  run(author, ["init", "-q"]);
  run(author, ["add", "-A"]);
  run(author, ["commit", "-q", "-m", "base"]);
  return { dir, run };
};

test("non-ASCII and tab paths are listed unquoted and match the governance lists", () => {
  const { dir, run } = repoWith("deps-bot[bot]");
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
  mkdirSync(join(dir, ".autonomy", "ledger"), { recursive: true });
  writeFileSync(join(dir, ".github", "workflows", "déploy.yml"), "name: d\n");
  writeFileSync(join(dir, ".github", "workflows", "tab\there.yml"), "name: t\n");
  writeFileSync(join(dir, ".autonomy", "ledger", "réview.jsonl"), "{}\n");
  run("deps-bot[bot]", ["add", "-A"]);
  run("deps-bot[bot]", ["commit", "-q", "-m", "evil names"]);
  const commits = commitsFromGit(dir, "HEAD~1..HEAD");
  assert.deepEqual([...commits[0].files].sort(), [".autonomy/ledger/réview.jsonl", ".github/workflows/déploy.yml", ".github/workflows/tab\there.yml"]);
  const result = runCheck({ dir, now, commits });
  assert.deepEqual(result.failures.map((f) => [f.code, f.file]), [
    ["governance-file-changed-by-agent", ".autonomy/ledger/réview.jsonl"],
    ["workflow-change-unacknowledged", ".github/workflows/déploy.yml"],
    ["workflow-change-unacknowledged", ".github/workflows/tab\there.yml"],
  ]);
});

test("a commit message with record separators cannot forge a commit or an acknowledgement", () => {
  const { dir, run } = repoWith("deps-bot[bot]");
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
  writeFileSync(join(dir, ".github", "workflows", "ci.yml"), "name: ci\n");
  run("deps-bot[bot]", ["add", "-A"]);
  run("deps-bot[bot]", ["commit", "-q", "-m", "add ci"]);
  const sha = run("deps-bot[bot]", ["rev-parse", "HEAD"]).trim();
  const forged = `empty\n\n\x1d\x1e${"f".repeat(40)}\x1fAlice\x1falice@example.invalid\x1fApprove\n\nGovernance-Approved: ${sha.slice(0, 7)}\n`;
  run("deps-bot[bot]", ["commit", "-q", "--allow-empty", "-m", forged]);
  const commits = commitsFromGit(dir, "HEAD~2..HEAD");
  assert.equal(commits.length, 2);
  assert.ok(commits.every((c) => c.sha.length === 40 && c.author === "deps-bot[bot]"));
  const result = runCheck({ dir, now, commits });
  assert.deepEqual(result.failures, [unacknowledged(sha, ".github/workflows/ci.yml")]);
});

test("files an agent adds in a merge commit are listed and fail as locked files", () => {
  const { dir, run } = repoWith("Alice");
  run("Alice", ["checkout", "-q", "-b", "side"]);
  writeFileSync(join(dir, "side.txt"), "side\n");
  run("Alice", ["add", "-A"]);
  run("Alice", ["commit", "-q", "-m", "side"]);
  run("Alice", ["checkout", "-q", "-"]);
  writeFileSync(join(dir, "main.txt"), "main\n");
  run("Alice", ["add", "-A"]);
  run("Alice", ["commit", "-q", "-m", "main"]);
  run("deps-bot[bot]", ["merge", "--no-ff", "--no-commit", "side"]);
  mkdirSync(join(dir, ".claude", "hooks"), { recursive: true });
  writeFileSync(join(dir, ".claude", "hooks", "x.sh"), "true\n");
  writeFileSync(join(dir, "CODEOWNERS"), "* @agent\n");
  run("deps-bot[bot]", ["add", "-A"]);
  run("deps-bot[bot]", ["commit", "-q", "-m", "merge side"]);
  const commits = commitsFromGit(dir, "HEAD~2..HEAD");
  const merge = commits[commits.length - 1];
  assert.deepEqual([...merge.files].sort(), [".claude/hooks/x.sh", "CODEOWNERS"]);
  const result = runCheck({ dir, now, commits });
  assert.deepEqual(result.failures.map((f) => [f.code, f.file]), [
    ["governance-file-changed-by-agent", ".claude/hooks/x.sh"],
    ["governance-file-changed-by-agent", "CODEOWNERS"],
  ]);
});

test("commitsFromGit reads the committer, so an agent committer is an agent commit", () => {
  const { dir, run } = repoWith("Alice");
  writeFileSync(join(dir, "a.txt"), "a\n");
  run("Alice", ["add", "-A"]);
  run("Alice", ["commit", "-q", "-m", "x"], { GIT_COMMITTER_NAME: "deps-bot[bot]" });
  const commits = commitsFromGit(dir, "HEAD~1..HEAD");
  assert.equal(commits[0].author, "Alice");
  assert.equal(commits[0].committer, "deps-bot[bot]");
  assert.equal(isAgentCommit(commits[0], []), true);
});

const octopusRepo = (mergeAuthor: string) => {
  const { dir, run } = repoWith("Alice");
  run("Alice", ["branch", "-M", "master"]);
  for (const b of ["b1", "b2"]) {
    run("Alice", ["checkout", "-q", "-b", b, "master"]);
    writeFileSync(join(dir, `${b}.txt`), `${b}\n`);
    run("Alice", ["add", "-A"]);
    run("Alice", ["commit", "-q", "-m", b]);
  }
  run("Alice", ["checkout", "-q", "-b", "trunk", "master"]);
  run(mergeAuthor, ["merge", "--no-ff", "--no-commit", "b1", "b2"]);
  mkdirSync(join(dir, ".claude", "hooks"), { recursive: true });
  writeFileSync(join(dir, ".claude", "hooks", "x.sh"), "true\n");
  run(mergeAuthor, ["add", "-A"]);
  run(mergeAuthor, ["commit", "-q", "-m", "octopus"]);
  return { dir, run };
};

test("an agent commit with more than two parents fails with merge-unsupported", () => {
  const { dir } = octopusRepo("deps-bot[bot]");
  const commits = commitsFromGit(dir, "master..HEAD");
  const octopus = commits[commits.length - 1];
  assert.equal(octopus.parents, 3);
  assert.deepEqual(runCheck({ dir, now, commits }).failures, [{ code: "merge-unsupported", commit: octopus.sha }]);
});

test("a non-agent octopus merge is not checked and lists files against its first parent", () => {
  const { dir } = octopusRepo("Alice");
  const commits = commitsFromGit(dir, "master..HEAD");
  const octopus = commits[commits.length - 1];
  assert.deepEqual([...octopus.files].sort(), [".claude/hooks/x.sh", "b1.txt", "b2.txt"]);
  assert.equal(runCheck({ dir, now, commits }).ok, true);
});

test("a CRLF acknowledgement read from git does not count", () => {
  const { dir, run } = repoWith("deps-bot[bot]");
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
  writeFileSync(join(dir, ".github", "workflows", "ci.yml"), "name: ci\n");
  run("deps-bot[bot]", ["add", "-A"]);
  run("deps-bot[bot]", ["commit", "-q", "-m", "add ci"]);
  const sha = run("deps-bot[bot]", ["rev-parse", "HEAD"]).trim();
  run("Alice", ["commit", "-q", "--allow-empty", "--cleanup=verbatim", "-m", `Approve\r\n\r\nGovernance-Approved: ${sha.slice(0, 7)}\r\n`]);
  const commits = commitsFromGit(dir, "HEAD~2..HEAD");
  assert.match(commits[1].body ?? "", /\r\n/);
  assert.deepEqual(runCheck({ dir, now, commits }).failures, [unacknowledged(sha, ".github/workflows/ci.yml")]);
});

test("a path that is not valid UTF-8 fails closed as path-undecodable", () => {
  const { dir, run } = repoWith("deps-bot[bot]");
  const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: dir, input: "x\n", encoding: "utf8" }).trim();
  const entry = Buffer.concat([Buffer.from(`100644 ${blob}\t.github/workflows/`), Buffer.from([0xff]), Buffer.from(".yml\n")]);
  execFileSync("git", ["update-index", "--add", "--index-info"], { cwd: dir, input: entry });
  run("deps-bot[bot]", ["commit", "-q", "-m", "bad path"]);
  const commits = commitsFromGit(dir, "HEAD~1..HEAD");
  assert.deepEqual(runCheck({ dir, now, commits }).failures, [{ code: "path-undecodable", commit: commits[0].sha, file: ".github/workflows/\ufffd.yml" }]);
});

test("FAIL lines print non-ASCII paths as they are", () => {
  const result = runCheck({ dir: fixture("registers", "valid"), now, commits: [agentCommit([".autonomy/ledger/réview.jsonl"])] });
  assert.ok(formatCheck(result).includes('"file":".autonomy/ledger/réview.jsonl"'));
});
