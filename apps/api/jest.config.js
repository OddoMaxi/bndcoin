/** Unit tests. Pure domain logic, no database. @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/$1',
  },
  clearMocks: true,
};
