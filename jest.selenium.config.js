module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/selenium/**/*.test.ts'],
  testTimeout: 30000,
  maxWorkers: 1,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  verbose: true
};