/**
 * Environment Detection
 *
 * Detects available tools and context at session start.
 * Results are cached to avoid repeated checks.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { access, constants, stat } from 'node:fs/promises';

const execAsync = promisify(exec);

/**
 * Detected environment state
 */
export interface Environment {
  /** RTK (token-optimized CLI proxy) is available */
  rtkAvailable: boolean;
  /** Project is indexed by jcodemunch */
  jcodemunchIndexed: boolean;
  /** Stack test is active (recent test-logs modifications) */
  stackTestActive: boolean;
  /** When this environment was detected (for cache expiry) */
  detectedAt: number;
}

/** Cache duration: 30 minutes */
const CACHE_TTL = 30 * 60 * 1000;

/** Cached environment state */
let cachedEnvironment: Environment | null = null;

/**
 * Check if RTK is installed and available.
 * Runs `which rtk` and checks exit code.
 */
async function checkRTKAvailable(): Promise<boolean> {
  try {
    await execAsync('which rtk');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if jcodemunch has indexed the project.
 * Looks for `.jcodemunch/` directory in project root.
 */
async function checkJcodemunchIndexed(projectDir: string): Promise<boolean> {
  try {
    await access(`${projectDir}/.jcodemunch`, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if stack test is active.
 * Looks for `./test-logs/` directory with files modified within 5 minutes.
 */
async function checkStackTestActive(projectDir: string): Promise<boolean> {
  const testLogsDir = `${projectDir}/test-logs`;
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  try {
    const stats = await stat(testLogsDir);
    if (!stats.isDirectory()) {
      return false;
    }

    // Check modification time of the directory itself
    // (In production, you might scan for recently modified files)
    return stats.mtimeMs > fiveMinutesAgo;
  } catch {
    return false;
  }
}

/**
 * Detect the current environment.
 * All checks run in parallel for speed.
 */
export async function detectEnvironment(projectDir: string): Promise<Environment> {
  const [rtkAvailable, jcodemunchIndexed, stackTestActive] = await Promise.all([
    checkRTKAvailable(),
    checkJcodemunchIndexed(projectDir),
    checkStackTestActive(projectDir),
  ]);

  return {
    rtkAvailable,
    jcodemunchIndexed,
    stackTestActive,
    detectedAt: Date.now(),
  };
}

/**
 * Get environment state, using cache if fresh.
 * Returns cached result if less than CACHE_TTL has passed.
 */
export async function getEnvironment(
  projectDir: string,
  options: { force?: boolean } = {}
): Promise<Environment> {
  if (options.force) {
    cachedEnvironment = null;
  }

  if (cachedEnvironment) {
    const age = Date.now() - cachedEnvironment.detectedAt;
    if (age < CACHE_TTL) {
      return cachedEnvironment;
    }
  }

  cachedEnvironment = await detectEnvironment(projectDir);
  return cachedEnvironment;
}

/**
 * Clear the environment cache.
 * Call this when the environment may have changed (e.g., after installing RTK).
 */
export function clearEnvironmentCache(): void {
  cachedEnvironment = null;
}

/**
 * Format environment as a human-readable summary.
 */
export function formatEnvironment(env: Environment): string {
  const parts: string[] = [];

  if (env.rtkAvailable) parts.push('RTK available');
  if (env.jcodemunchIndexed) parts.push('jcodemunch indexed');
  if (env.stackTestActive) parts.push('stack test active');

  if (parts.length === 0) {
    return 'Base environment (no optimization tools detected)';
  }

  return parts.join(', ');
}
