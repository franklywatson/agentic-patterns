import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export type Json = any;

export const DAY_MS = 86_400_000;

const here = dirname(fileURLToPath(import.meta.url));
// dist/src -> typescript -> autonomy
export const AUTONOMY_ROOT = join(here, "..", "..", "..");
export const SCHEMA_PATH = join(AUTONOMY_ROOT, "schema", "autonomy.schema.json");

/** ISO 8601 as this tooling writes it: a date, or a date and time with `Z` or an offset. */
const ISO_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

/** Parse an ISO date or time to epoch milliseconds; throws on anything else, including 2027-02-31. */
export function parseTime(value: string): number {
  const m = typeof value === "string" ? ISO_TIME.exec(value) : null;
  if (m === null) throw new Error(`invalid date: ${value}`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    throw new Error(`invalid date: ${value}`);
  }
  const ms = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(ms)) throw new Error(`invalid date: ${value}`);
  return ms;
}

/** Parse a time, or return null when it is not an ISO date or time. */
export function tryParseTime(value: unknown): number | null {
  try {
    return parseTime(value as string);
  } catch {
    return null;
  }
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

export function insideDir(dir: string, rel: string): boolean {
  const root = resolve(dir);
  const target = resolve(root, rel);
  return target === root || target.startsWith(root + sep);
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readJsonIfExists(path: string): Json | null {
  return existsSync(path) ? readJson(path) : null;
}

// A glob wildcard never matches a line terminator, in either language.
const ANY = "[^\\n\\r\\u2028\\u2029]";
const SEGMENT = "[^/\\n\\r\\u2028\\u2029]";

/** Translate a glob to a RegExp. `*` stays inside one path segment unless `anySlash`. */
export function globToRegExp(glob: string, anySlash: boolean): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        out += `${ANY}*`;
        i++;
      } else {
        out += anySlash ? `${ANY}*` : `${SEGMENT}*`;
      }
    } else if (ch === "?") {
      out += anySlash ? ANY : SEGMENT;
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
