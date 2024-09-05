export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/__mocks__/styleMock.ts',
    '^uuid$': require.resolve('uuid'), // Add this line to handle ESM module
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  testMatch: [
    '**/__tests__/server/**/*.test.[jt]s?(x)',
    '**/__tests__/component/**/*.test.[jt]s?(x)',
    '**/__tests__/site/**/*.test.[jt]s?(x)'
  ],
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 84,
      lines: 85,
      functions: 85,
    },
  },
};
