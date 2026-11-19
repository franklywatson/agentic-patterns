import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// dist/tests -> dist -> typescript -> autonomy
export const FIXTURES = join(here, "..", "..", "..", "fixtures");
export const CLI = join(here, "..", "src", "cli.js");
export const NOW = "2026-11-18T00:00:00Z";

export const fixture = (...parts: string[]) => join(FIXTURES, ...parts);
export const readFixtureJson = (...parts: string[]) => JSON.parse(readFileSync(fixture(...parts), "utf8"));

/** Copy a fixture directory to a fresh temp directory. */
export function copyFixture(...parts: string[]): string {
  const dest = mkdtempSync(join(tmpdir(), "autonomy-fixture-"));
  cpSync(fixture(...parts), dest, { recursive: true });
  return dest;
}

/** Copy a fixture repository and commit it with a fixed date so census sees practice. */
export function gitFixtureRepo(name: string, date = "2026-11-01T00:00:00Z"): string {
  const dest = copyFixture("repos", name);
  const env = { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  const run = (args: string[]) => execFileSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", ...args], { cwd: dest, env, stdio: "ignore" });
  run(["init", "-q"]);
  run(["add", "-A"]);
  run(["commit", "-q", "-m", "fixture"]);
  return dest;
}

export function cli(args: string[], input = ""): { status: number | null; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"] });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { status: e.status, stdout: e.stdout, stderr: e.stderr };
  }
}
