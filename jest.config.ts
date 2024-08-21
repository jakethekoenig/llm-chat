export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  coverageThreshold: {
    global: {
      branches: 85, // Update to match the current coverage
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
};
