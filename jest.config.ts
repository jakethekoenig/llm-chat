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
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 72,
      branches: 70,
      lines: 72,
      functions: 85,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // Path is correct
};
