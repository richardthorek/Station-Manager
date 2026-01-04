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
  // Coverage thresholds: Increased from 15% baseline to 48%+ (121 tests)
  // Progressive improvement toward 70%+ industry standard
  // Current coverage: ~48-49% (statements, branches, functions, lines)
  // Phase 1 Complete: Comprehensive route testing (45 tests → 121 tests)
  // Future improvement: Add tests for Table Storage implementations, Azure Storage service,
  // and database factories to reach 70%+ target
  coverageThreshold: {
    global: {
      branches: 37,
      functions: 50,
      lines: 49,
      statements: 48,
    },
  },
  moduleNameMapper: {
    '^uuid$': require.resolve('uuid'),
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
};
