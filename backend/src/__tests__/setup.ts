/**
 * Test Setup and Global Configuration
 * 
 * Sets up the testing environment before running tests.
 * Configures environment variables and global test utilities.
 * 
 * When using Azure Table Storage for tests:
 * - Tables are suffixed with 'Test' (e.g., MembersTest, ActivitiesTest)
 * - Test data should be seeded before running tests via `npm run seed:test`
 * - Test data is isolated from dev and prod environments
 */

// Set NODE_ENV to test to use test-specific Table Storage tables (suffixed with 'Test')
process.env.NODE_ENV = 'test';

// Increase timeout for async operations (especially when using real Azure Table Storage)
jest.setTimeout(30000);

// Mock uuid module
jest.mock('uuid');

// Note: Test data seeding is handled by `npm run seed:test` command
// This should be run before tests in CI/CD pipeline

// Clean up after all tests (optional - keeps test data for debugging)
// Uncomment to clean test data after every test run
/*
afterAll(async () => {
  const { ensureDatabase } = require('../services/dbFactory');
  
  try {
    const db = await ensureDatabase();
    await db.clearAllActiveCheckIns();
    console.log('✅ Test cleanup completed');
  } catch (error) {
    console.warn('⚠️  Test cleanup failed:', error);
  }
});
*/

// Mock console methods to reduce test output noise (optional)
// Uncomment if you want cleaner test output
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
