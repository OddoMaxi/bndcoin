/** E2E tests. Requires docker-compose.test.yml infra to be up. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'test',
  testRegex: '.*\\.e2e-spec\\.ts$',
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/../src/$1',
  },
  testTimeout: 60_000,
  clearMocks: true,
  setupFiles: ['<rootDir>/helpers/env.ts'],
  globalSetup: '<rootDir>/helpers/global-setup.ts',
};
