import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export type Json = any;

export const DAY_MS = 86_400_000;

const here = dirname(fileURLToPath(import.meta.url));
// dist/src -> typescript -> autonomy
export const AUTONOMY_ROOT = join(here, "..", "..", "..");
export const SCHEMA_PATH = join(AUTONOMY_ROOT, "schema", "autonomy.schema.json");

export function parseTime(value: string): number {
  const text = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) throw new Error(`invalid date: ${value}`);
  return ms;
}

export function nowMs(arg?: string): number {
  const value = arg ?? process.env.AUTONOMY_NOW;
  return value ? parseTime(value) : Date.now();
}

export function isoSeconds(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function ageDays(now: number, then: number): number {
  return Math.floor((now - then) / DAY_MS);
}

export function round4(value: number): number {
  return Math.floor(value * 10000 + 0.5) / 10000;
}

export function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readJsonIfExists(path: string): Json | null {
  return existsSync(path) ? readJson(path) : null;
}

/** Translate a glob to a RegExp. `*` stays inside one path segment unless `anySlash`. */
export function globToRegExp(glob: string, anySlash: boolean): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        out += ".*";
        i++;
      } else {
        out += anySlash ? ".*" : "[^/]*";
      }
    } else if (ch === "?") {
      out += anySlash ? "." : "[^/]";
    } else {
      out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${out}$`);
}

export function matchPath(glob: string, path: string): boolean {
  return globToRegExp(glob, false).test(path);
}

export function matchCommand(glob: string, command: string): boolean {
  return globToRegExp(glob, true).test(command);
}

export function toPosix(path: string): string {
  return path.split(sep).join("/");
}

export function git(dir: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

export function isGitRepo(dir: string): boolean {
  return git(dir, ["rev-parse", "--is-inside-work-tree"])?.trim() === "true";
}

export function listFiles(dir: string): string[] {
  const tracked = git(dir, ["ls-files"]);
  if (tracked !== null) return tracked.split("\n").filter(Boolean).sort();
  const out: string[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      if (name === ".git" || name === "node_modules") continue;
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(toPosix(relative(dir, full)));
    }
  };
  walk(dir);
  return out.sort();
}

/** Commit time of the last commit touching `path`, or null when there is none. */
export function lastChanged(dir: string, path: string): number | null {
  const out = git(dir, ["log", "-1", "--format=%cI", "--", path]);
  const text = out?.trim();
  return text ? Date.parse(text) : null;
}

/** Number of files deleted under `path` since `sinceMs`. */
export function deletionsSince(dir: string, path: string, sinceMs: number): number {
  const out = git(dir, [
    "log",
    `--since=${new Date(sinceMs).toISOString()}`,
    "--diff-filter=D",
    "--name-only",
    "--format=",
    "--",
    path,
  ]);
  return (out ?? "").split("\n").filter(Boolean).length;
}
