/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.stack.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/app/', '/tests/stack/browser/'],
  testTimeout: 300000, // 5 minutes for stack operations
  maxWorkers: 1, // Run tests sequentially (runInBand)
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};
