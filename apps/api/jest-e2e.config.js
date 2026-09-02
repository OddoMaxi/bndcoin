module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'test',
  testRegex: '.*\\.e2e-spec\\.ts$',
  testTimeout: 90_000,
  clearMocks: true,
  setupFiles: ['<rootDir>/helpers/env.ts'],
  globalSetup: '<rootDir>/helpers/global-setup.ts',
};
