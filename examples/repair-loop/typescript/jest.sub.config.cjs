/**
 * Runs the reproduction and regression tests inside a workspace against a deployed
 * candidate. The loop passes --rootDir pointing at the workspace.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/repro/*.repro.test.ts', '**/tests/regression/*.regression.test.ts'],
  testTimeout: 60000,
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'CommonJS', esModuleInterop: true, strict: true, target: 'ES2022', types: ['jest', 'node'] }, diagnostics: false }] },
};
