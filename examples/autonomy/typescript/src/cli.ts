#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { commitsFromGit, formatCheck, runCheck } from "./check.js";
import type { Commit } from "./check.js";
import { runCensus, writeCensus } from "./census.js";
import { runDrill } from "./drill.js";
import { runHook } from "./hook.js";
import { allWorkflows } from "./levels.js";
import { applyDemotion, buildReport, formatReport, readLedger } from "./ledger.js";
import { loadRegisterFile, validateRegister } from "./register.js";
import { nowMs, readJson, readJsonIfExists } from "./util.js";

const USAGE = `usage: autonomy <command> [options]

  check   [--dir D] [--register F] [--now T] (--commits F | --git-range R | --no-commits) [--json]
  census  [--dir D] [--now T] [--json]
  ledger  --workflow ID [--dir D] [--now T] [--apply-demotion] [--json]
  drill   --workflow ID [--dir D] [--bound-ms N] [--now T]
  hook    pre-tool-use | session-start   (reads the hook JSON on stdin)
`;

function parseArgs(argv: string[]): { flags: Map<string, string | true>; rest: string[] } {
  const flags = new Map<string, string | true>();
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(a.slice(2), next);
        i++;
      } else flags.set(a.slice(2), true);
    } else rest.push(a);
  }
  return { flags, rest };
}

function loadValidRegister(dir: string) {
  const register = loadRegisterFile(join(dir, ".autonomy.yaml"));
  const errors = validateRegister(register);
  if (errors.length > 0) throw new Error(`register is invalid: ${JSON.stringify(errors)}`);
  return register;
}

async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  const { flags, rest } = parseArgs(args);
  const str = (k: string) => (typeof flags.get(k) === "string" ? (flags.get(k) as string) : undefined);
  const dir = resolve(str("dir") ?? process.cwd());
  const now = nowMs(str("now"));
  const json = flags.has("json");
  switch (command) {
    case "check": {
      let commits: Commit[] | undefined;
      if (str("commits")) commits = readJson(str("commits") as string);
      else if (str("git-range")) commits = commitsFromGit(dir, str("git-range") as string);
      const result = runCheck({ dir, registerPath: str("register"), now, commits });
      const skipped = commits === undefined;
      if (skipped && !flags.has("no-commits")) {
        result.failures.push({ code: "governance-check-skipped" });
        result.ok = false;
      }
      const note = skipped && flags.has("no-commits") ? "\ngovernance check: skipped (--no-commits)" : "";
      console.log(json ? JSON.stringify(result, null, 2) : `${formatCheck(result)}${note}`);
      return result.ok ? 0 : 1;
    }
    case "census": {
      const result = runCensus(dir, now);
      const path = writeCensus(dir, result);
      const line = ([d, v]: [string, any]) => `${d}: ${v.level}${v.missing_for_next.length > 0 ? ` (next: ${v.missing_for_next.join(", ")})` : ""}`;
      const dims = Object.entries(result.profile.dimensions).map(line).join("\n");
      console.log(json ? JSON.stringify(result.profile, null, 2) : `wrote ${path}\ncap: ${result.profile.cap}\n${dims}\nworksheet: ${join(dir, ".autonomy", "worksheet.json")}`);
      return 0;
    }
    case "ledger": {
      const id = str("workflow");
      if (!id) throw new Error("ledger needs --workflow");
      const register = loadValidRegister(dir);
      const wf = allWorkflows(register).find((w) => w.id === id);
      if (!wf) throw new Error(`workflow ${id} is not in the register`);
      const profile = readJsonIfExists(join(dir, register.profile ?? ".autonomy/profile.json"));
      const state = readJsonIfExists(join(dir, ".autonomy", "state.json"));
      const report = buildReport(wf, readLedger(dir, id), profile, state, register.defaults, now);
      if (flags.has("apply-demotion") && report.demotion.triggered) {
        applyDemotion(dir, id, report.demotion.to_level as number, report.demotion.reasons, now);
      }
      console.log(json ? JSON.stringify(report, null, 2) : formatReport(report));
      return 0;
    }
    case "drill": {
      const id = str("workflow");
      if (!id) throw new Error("drill needs --workflow");
      const register = loadValidRegister(dir);
      const wf = register.workflows.find((w: any) => w.id === id);
      if (!wf) throw new Error(`workflow ${id} is not in the register`);
      const result = await runDrill({ dir, registerPath: join(dir, ".autonomy.yaml"), workflow: wf, boundMs: Number(str("bound-ms") ?? 2000), now });
      console.log(JSON.stringify(result, null, 2));
      if (result.reason === "canary-never-started") return 2;
      return result.passed ? 0 : 1;
    }
    case "hook": {
      const out = runHook(rest[0], readFileSync(0, "utf8"), process.env, now);
      if (out.stdout) process.stdout.write(out.stdout);
      return out.exitCode;
    }
    default:
      process.stderr.write(USAGE);
      return 2;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: Error) => {
    process.stderr.write(`autonomy: ${err.message}\n`);
    process.exit(2);
  },
);

