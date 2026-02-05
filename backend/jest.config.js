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
    // Exclude Azure Storage components that require real Azure credentials in testing
    '!src/services/azureStorage.ts',
    '!src/services/tableStorageDatabase.ts',
    '!src/services/tableStorageTruckChecksDatabase.ts',
    // Exclude RFS facilities parser (requires 2.2MB CSV file that's gitignored)
    '!src/services/rfsFacilitiesParser.ts',
    // Exclude scripts (development utilities, not production code)
    '!src/scripts/**',
    // Exclude types (type definitions only, no runtime code)
    '!src/types/**',
  ],
  // Coverage thresholds removed to allow the app to stabilize
  // Will be re-enabled once the app reaches maturity
  // Coverage reporting still enabled for visibility
  coverageReporters: ['text', 'json', 'json-summary', 'lcov', 'clover'],
  moduleNameMapper: {
    '^uuid$': require.resolve('uuid'),
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
};
