import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { startFixtureServer, runInContainer, type FixtureServer } from "./boundary.js";
import { decide, loadRules } from "./policy.js";
import { networkCases, writeCases } from "./fixtures.js";

const rules = loadRules();
const ctx = { projectRoot: "/work/project", home: "/home/dev" };
const ORIGINAL = "old\n";
const created: string[] = [];
let server: FixtureServer;

before(() => {
  server = startFixtureServer();
});

after(() => {
  server.stop();
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

function makeProject(): { dir: string; target: string } {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "containment-")));
  created.push(dir);
  const target = path.join(dir, "target.txt");
  writeFileSync(target, ORIGINAL);
  // The container user is "nobody": the control run needs write access to succeed.
  chmodSync(dir, 0o777);
  chmodSync(target, 0o666);
  return { dir, target };
}

for (const c of writeCases) {
  test(`write boundary: ${c.id}`, () => {
    assert.equal(decide({ tool: "Bash", command: c.command }, rules, ctx).decision, c.policy);

    const control = makeProject();
    const permissive = runInContainer(c.command, { projectDir: control.dir, readOnly: false, network: "none" });
    assert.equal(permissive.exitCode, 0, permissive.stderr);
    assert.notEqual(readFileSync(control.target, "utf8"), ORIGINAL, "control run must change the file");

    const bounded = makeProject();
    const contained = runInContainer(c.command, { projectDir: bounded.dir, readOnly: true, network: "none" });
    assert.match(contained.stderr, /Read-only file system/);
    assert.equal(readFileSync(bounded.target, "utf8"), ORIGINAL);
  });
}

for (const c of networkCases) {
  test(`network boundary: ${c.id}`, () => {
    const command = c.command.replaceAll("{SERVER}", server.host);
    assert.equal(decide({ tool: "Bash", command }, rules, ctx).decision, c.policy);

    const control = makeProject();
    const permissive = runInContainer(command, { projectDir: control.dir, readOnly: true, network: server.network });
    assert.equal(permissive.exitCode, 0, permissive.stderr);
    assert.equal(permissive.stdout.trim(), "containment-ok");

    const bounded = makeProject();
    const contained = runInContainer(command, { projectDir: bounded.dir, readOnly: true, network: "none" });
    assert.notEqual(contained.exitCode, 0, "the request must fail with no network");
    assert.equal(contained.stdout.includes("containment-ok"), false);
  });
}

test("container runs as a non-root user", () => {
  const p = makeProject();
  const r = runInContainer("id -u", { projectDir: p.dir, readOnly: true, network: "none" });
  assert.equal(r.exitCode, 0, r.stderr);
  assert.equal(r.stdout.trim(), "65534");
});
