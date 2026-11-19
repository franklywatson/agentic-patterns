import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

export const IMAGE = "python:3.12-slim";
const NOBODY = "65534:65534";

export interface RunOptions {
  projectDir: string;
  readOnly: boolean;
  /** "none" for no network, or the name of a Docker network. */
  network: string;
  timeoutMs?: number;
}

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function unique(prefix: string): string {
  return `${prefix}-${process.pid}-${randomBytes(3).toString("hex")}`;
}

function docker(args: string[], timeoutMs = 60_000): RunResult {
  const r = spawnSync("docker", args, { encoding: "utf8", timeout: timeoutMs });
  if (r.error) throw r.error;
  return { exitCode: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/**
 * Runs a shell command in a non-root container with the project directory
 * mounted at /work. The command is passed as one argv entry, so nothing on the
 * host parses it.
 */
export function runInContainer(command: string, opts: RunOptions): RunResult {
  const name = unique("cp-run");
  const mount = `${opts.projectDir}:/work${opts.readOnly ? ":ro" : ""}`;
  try {
    return docker(
      [
        "run", "--rm", "--name", name,
        "--user", NOBODY,
        "--network", opts.network,
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges",
        "-v", mount, "-w", "/work",
        IMAGE, "sh", "-c", command,
      ],
      opts.timeoutMs,
    );
  } finally {
    docker(["rm", "-f", name]);
  }
}

export interface FixtureServer {
  network: string;
  host: string;
  stop: () => void;
}

/** Starts an HTTP server on a private Docker network. It replies "containment-ok". */
export function startFixtureServer(): FixtureServer {
  const network = unique("cp-net");
  const host = unique("cp-srv");
  const stop = (): void => {
    docker(["rm", "-f", host]);
    docker(["network", "rm", network]);
  };
  const created = docker(["network", "create", network]);
  if (created.exitCode !== 0) throw new Error(`network create failed: ${created.stderr}`);
  try {
    const started = docker([
      "run", "-d", "--rm", "--name", host, "--network", network, "--user", NOBODY,
      IMAGE, "sh", "-c",
      "mkdir -p /tmp/srv && echo containment-ok > /tmp/srv/index.html && exec python3 -m http.server 8000 --directory /tmp/srv",
    ]);
    if (started.exitCode !== 0) throw new Error(`server start failed: ${started.stderr}`);
    waitUntilServing(network, host);
  } catch (err) {
    stop();
    throw err;
  }
  return { network, host, stop };
}

function waitUntilServing(network: string, host: string): void {
  const probe = `python3 -c "import urllib.request as u;u.urlopen('http://${host}:8000/',timeout=2)"`;
  for (let attempt = 0; attempt < 30; attempt++) {
    const r = docker(["run", "--rm", "--network", network, IMAGE, "sh", "-c", probe]);
    if (r.exitCode === 0) return;
  }
  throw new Error("fixture server did not become ready");
}
