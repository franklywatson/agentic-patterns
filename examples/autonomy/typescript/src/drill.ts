import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyDemotion } from "./ledger.js";
import { escapeRegExp, isoDate, isoSeconds } from "./util.js";
import type { Json } from "./util.js";

const CANARY = `
const fs = require("node:fs");
const hb = process.env.AUTONOMY_HEARTBEAT;
const stop = process.env.AUTONOMY_STOP_FILE;
let n = 0;
setInterval(() => {
  if (fs.existsSync(stop)) process.exit(0);
  fs.writeFileSync(hb, String(++n));
}, 50);
`;

export interface DrillResult {
  workflow: string;
  passed: boolean;
  reason: string | null;
  halted_in_ms: number | null;
  bound_ms: number;
  /** The date written to `stop.last_tested`; null when the drill did not pass. */
  last_tested: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(test: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (test()) return true;
    await sleep(20);
  }
  return test();
}

const readBeat = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

/** Set `last_tested` for one workflow by editing the register text in place. */
export function setLastTested(text: string, workflowId: string, date: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^\\s*-\\s+id:\\s*["']?${escapeRegExp(workflowId)}["']?\\s*$`).test(l));
  if (start < 0) throw new Error(`workflow ${workflowId} not found in register text`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*-\s+id:/.test(lines[i])) {
      end = i;
      break;
    }
  }
  for (let i = start; i < end; i++) {
    if (/(last_tested:\s*)(\d{4}-\d{2}-\d{2})/.test(lines[i])) {
      lines[i] = lines[i].replace(/(last_tested:\s*)(\d{4}-\d{2}-\d{2})/, `$1${date}`);
      return lines.join("\n");
    }
  }
  for (let i = start; i < end; i++) {
    const m = /^(\s*)stop:\s*$/.exec(lines[i]);
    if (m) {
      lines.splice(i + 1, 0, `${m[1]}  last_tested: ${date}`);
      return lines.join("\n");
    }
  }
  throw new Error(`workflow ${workflowId} has no block-style stop mapping to update`);
}

export async function runDrill(opts: {
  dir: string;
  registerPath: string;
  workflow: Json;
  boundMs: number;
  now: number;
  /** Command that starts the canary; defaults to a node heartbeat loop. Tests override it. */
  canary?: string[];
  startTimeoutMs?: number;
}): Promise<DrillResult> {
  const { workflow, boundMs } = opts;
  const work = mkdtempSync(join(tmpdir(), "autonomy-drill-"));
  const heartbeat = join(work, "heartbeat");
  const stopFile = join(work, "stop");
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, AUTONOMY_HEARTBEAT: heartbeat, AUTONOMY_STOP_FILE: stopFile };
  const [cmd, ...cmdArgs] = opts.canary ?? [process.execPath, "-e", CANARY];
  const canary = spawn(cmd, cmdArgs, { env, stdio: "ignore" });
  let exited = false;
  canary.on("exit", () => {
    exited = true;
  });
  const fail = (reason: string, ms: number | null): DrillResult => ({
    workflow: workflow.id,
    passed: false,
    reason,
    halted_in_ms: ms,
    bound_ms: boundMs,
    last_tested: null,
  });
  let result: DrillResult;
  try {
    const beating = await waitFor(() => Number(readBeat(heartbeat) || 0) >= 2, opts.startTimeoutMs ?? 5000);
    if (!beating) {
      result = fail("canary-never-started", null);
    } else if (!workflow.stop?.command) {
      result = fail("no-stop-command", null);
    } else {
      const started = Date.now();
      const stop = spawnSync("sh", ["-c", workflow.stop.command], {
        env: { ...env, AUTONOMY_CANARY_PID: String(canary.pid) },
        cwd: opts.dir,
        timeout: 10_000,
      });
      const stopTook = Date.now() - started;
      if (stop.status !== 0) {
        result = fail("stop-command-failed", null);
      } else if (stopTook > boundMs) {
        result = fail("bound-exceeded", stopTook);
      } else {
        const halted = await waitFor(() => exited, Math.max(0, boundMs - (Date.now() - started)));
        const took = Date.now() - started;
        if (!halted) {
          result = fail("canary-still-running", null);
        } else {
          const before = readBeat(heartbeat);
          await sleep(300);
          result = readBeat(heartbeat) === before ? { workflow: workflow.id, passed: true, reason: null, halted_in_ms: took, bound_ms: boundMs, last_tested: null } : fail("heartbeat-continued", took);
        }
      }
    }
  } finally {
    if (!exited) canary.kill("SIGKILL");
    rmSync(work, { recursive: true, force: true });
  }
  mkdirSync(join(opts.dir, ".autonomy"), { recursive: true });
  appendFileSync(
    join(opts.dir, ".autonomy", "drills.jsonl"),
    `${JSON.stringify({ ts: isoSeconds(opts.now), workflow: workflow.id, passed: result.passed, reason: result.reason })}\n`,
  );
  if (result.reason === "canary-never-started") return result;
  if (result.passed) {
    const text = readFileSync(opts.registerPath, "utf8");
    result.last_tested = isoDate(opts.now);
    writeFileSync(opts.registerPath, setLastTested(text, workflow.id, result.last_tested));
  } else {
    applyDemotion(opts.dir, workflow.id, 3, [`stop-drill-failed:${result.reason}`], opts.now);
  }
  return result;
}
