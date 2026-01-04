module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/src/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/__tests__/**',
  ],
  // Coverage thresholds: Set to realistic levels based on current test suite
  // Current coverage: ~15% (3 test files: activities, members, checkins)
  // Future improvement: Add tests for achievements, events, truckChecks, and services
  // to gradually increase coverage toward 70%+ industry standard
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 14,
      lines: 15,
      statements: 14,
    },
  },
  moduleNameMapper: {
    '^uuid$': require.resolve('uuid'),
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
};
