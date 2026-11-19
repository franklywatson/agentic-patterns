/**
 * StackTestUtils - Minimal utilities for stack testing
 *
 * Demonstrates:
 * - Dynamic port allocation
 * - Unique container naming
 * - Per-test compose file generation
 * - Aggressive cleanup that reports failures
 */

import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import axios, { type AxiosInstance } from 'axios';
import { readFileSync, unlinkSync, writeFileSync, existsSync } from 'fs';

export interface StackConfig {
  composeFile: string;
  ports: {
    app: number;
    postgres: number;
    redis: number;
  };
  baseUrl: string;
}

export class StackTestUtils {
  private composeFile: string | null = null;
  private projectName = '';
  private ports!: StackConfig['ports'];
  private baseUrl!: string;
  private httpClient!: AxiosInstance;

  /**
   * Initialize the stack with a unique compose file
   */
  async initialize(templateComposeFile: string): Promise<StackConfig> {
    // Allocate dynamic ports
    const [appPort, postgresPort, redisPort] = await this.allocatePorts(3);
    this.ports = { app: appPort, postgres: postgresPort, redis: redisPort };
    this.baseUrl = `http://localhost:${appPort}`;

    // Generate unique compose file
    const testId = `${process.pid}-${randomBytes(4).toString('hex')}`;
    // Unique compose project name: networks and volumes are scoped per test run.
    this.projectName = `stack-test-${testId}`;
    this.composeFile = `docker-compose-stack-test-${testId}-${Date.now()}.yml`;

    // Read template and substitute values
    const template = readFileSync(templateComposeFile, 'utf-8');
    const composeContent = template
      .replace(/\$\{APP_PORT:-3000\}/g, String(appPort))
      .replace(/\$\{POSTGRES_PORT:-5432\}/g, String(postgresPort))
      .replace(/\$\{REDIS_PORT:-6379\}/g, String(redisPort));

    writeFileSync(this.composeFile, composeContent);

    // Start the stack
    console.log(`Starting stack with compose file: ${this.composeFile}`);
    execSync(`docker compose -p "${this.projectName}" -f "${this.composeFile}" up -d --build`, {
      stdio: 'inherit',
    });

    // Configure HTTP client
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      validateStatus: () => true, // Don't throw on any status
      timeout: 30000,
    });

    return {
      composeFile: this.composeFile,
      ports: this.ports,
      baseUrl: this.baseUrl,
    };
  }

  /**
   * Remove the stack's containers, volumes, networks and orphans, then delete the
   * generated compose file. The file is deleted even when `docker compose down`
   * fails; every failure is reported in one error so a leaked stack fails the run.
   * After a failed `down` the project name is kept, so a second call retries
   * `docker compose -p <name> down` without the file.
   */
  async cleanup(): Promise<void> {
    const name = this.projectName;
    const failures: string[] = [];
    if (name) {
      const file = this.composeFile !== null && existsSync(this.composeFile) ? this.composeFile : null;
      console.log(`Cleaning up stack: ${name}`);
      try {
        const fileOption = file === null ? '' : ` -f "${file}"`;
        execSync(`docker compose -p "${name}"${fileOption} down -v --remove-orphans`, { stdio: 'inherit' });
        this.projectName = '';
      } catch (error) {
        failures.push(`docker compose down: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (this.composeFile !== null) {
      try {
        if (existsSync(this.composeFile)) unlinkSync(this.composeFile);
        this.composeFile = null;
      } catch (error) {
        failures.push(`remove ${this.composeFile}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (failures.length > 0) {
      throw new Error(`Cleanup of stack ${name} failed; containers or volumes may remain: ${failures.join('; ')}`);
    }
  }

  /**
   * Make HTTP requests to the app
   */
  async makeRequest(
    method: string,
    path: string,
    data?: unknown,
    headers?: Record<string, string>,
  ) {
    if (!this.httpClient) {
      throw new Error('Stack not initialized. Call initialize() first.');
    }
    return this.httpClient.request({
      method,
      url: path,
      data,
      headers,
    });
  }

  /**
   * Wait for the app to be ready
   */
  async waitForReady(timeoutMs: number = 120000): Promise<void> {
    const startTime = Date.now();
    const interval = 2000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await this.makeRequest('GET', '/health');
        if (response.status === 200) {
          console.log('Stack is ready');
          return;
        }
      } catch {
        // Ignore connection errors
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    throw new Error(`Stack not ready after ${timeoutMs}ms`);
  }

  /**
   * Allocate available ports
   */
  private async allocatePorts(count: number): Promise<number[]> {
    const ports: number[] = [];
    const minPort = 10000;
    const maxPort = 65535;
    const maxAttempts = 100;

    for (let i = 0; i < count; i++) {
      let allocated = false;
      let attempts = 0;

      while (!allocated && attempts < maxAttempts) {
        const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
        if (!ports.includes(port) && (await this.isPortAvailable(port))) {
          ports.push(port);
          allocated = true;
        }
        attempts++;
      }

      if (!allocated) {
        throw new Error(`Could not allocate ${count} ports`);
      }
    }

    return ports;
  }

  /**
   * Check if a port is available
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    try {
      execSync(
        process.platform === 'darwin'
          ? `lsof -i :${port} >/dev/null 2>&1 && exit 1 || exit 0`
          : `ss -tlnp | grep -q ":${port}" && exit 1 || exit 0`,
        { stdio: 'ignore' }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get container logs for debugging
   */
  getLogs(service: string): string {
    if (!this.composeFile) {
      throw new Error('Stack not initialized');
    }
    return execSync(`docker compose -p "${this.projectName}" -f "${this.composeFile}" logs ${service}`, {
      encoding: 'utf-8',
    });
  }
}
