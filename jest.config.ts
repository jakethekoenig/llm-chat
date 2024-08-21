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
      branches: 93, // Update to match the current coverage
      functions: 93,
      lines: 93,
      statements: 93,
    },
  },
  moduleNameMapper: {
    '\\.(css|less)$': 'identity-obj-proxy',
  },
};