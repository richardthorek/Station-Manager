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
    // Azure Storage: require live credentials not available in CI
    '!src/services/azureStorage.ts',
    '!src/services/tableStorageDatabase.ts',
    '!src/services/tableStorageTruckChecksDatabase.ts',
    '!src/services/tableStorageAdminUserDatabase.ts',
    '!src/services/tableStorageOrganizationDatabase.ts',
    // Azure App Insights: requires live Azure connection
    '!src/services/appInsights.ts',
    // RFS facilities parser: requires 2.2MB CSV that is gitignored
    '!src/services/rfsFacilitiesParser.ts',
    // Auth middleware: requires real JWT tokens / Azure AD — not mockable at unit level
    '!src/middleware/auth.ts',
    '!src/middleware/flexibleAuth.ts',
    // Request logging: winston I/O wrapper, no testable business logic
    '!src/middleware/requestLogging.ts',
    // Kiosk-mode middleware: stateful session cookie parsing, no CI test infra
    '!src/middleware/kioskModeMiddleware.ts',
    // Scripts: one-off admin/seed utilities, not production code paths
    '!src/scripts/**',
    // Types: type definitions only, no runtime code
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      statements: 73,
      branches: 64,
      functions: 75,
      lines: 73,
    },
  },
  coverageReporters: ['text', 'json', 'json-summary', 'lcov', 'clover'],
  moduleNameMapper: {
    '^uuid$': require.resolve('uuid'),
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
};
