/** Three Jest projects: unit, eval and stack. Workers are capped at one so stack tests run in sequence. */
const common = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/.workspaces/', '<rootDir>/app/'],
};

module.exports = {
  projects: [
    { ...common, displayName: 'unit', testMatch: ['<rootDir>/tests/unit/**/*.test.ts'] },
    { ...common, displayName: 'eval', testMatch: ['<rootDir>/tests/eval/**/*.test.ts'] },
    {
      ...common,
      displayName: 'stack',
      testMatch: ['<rootDir>/tests/stack/**/*.stack.test.ts'],
    },
  ],
  maxWorkers: 1,
  verbose: true,
};
