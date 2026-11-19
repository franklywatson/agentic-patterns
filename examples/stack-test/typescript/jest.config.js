/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['**/*.stack.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/app/', '/tests/stack/browser/'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  testTimeout: 300000, // 5 minutes for stack operations
  maxWorkers: 1, // Run tests sequentially (runInBand)
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};
