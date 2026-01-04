/**
 * Test Setup and Global Configuration
 * 
 * Sets up the testing environment before running tests.
 * Configures environment variables and global test utilities.
 */

// Set NODE_ENV to test to use test-specific Table Storage tables (suffixed with 'Test')
process.env.NODE_ENV = 'test';

// Increase timeout for async operations (especially when using real Azure Table Storage)
jest.setTimeout(30000);

// Mock uuid module
jest.mock('uuid');

// Clean up test data after all tests complete
afterAll(async () => {
  // Import here to avoid circular dependencies
  const { ensureDatabase } = require('../services/dbFactory');
  const { ensureTruckChecksDatabase } = require('../services/truckChecksDbFactory');
  
  try {
    const db = await ensureDatabase();
    const truckChecksDb = await ensureTruckChecksDatabase();
    
    // Clear test data if using Table Storage
    // This prevents test data accumulation in Azure Table Storage
    if (typeof db.clearAllActiveCheckIns === 'function') {
      await db.clearAllActiveCheckIns();
    }
    
    console.log('✅ Test cleanup completed');
  } catch (error) {
    console.warn('⚠️  Test cleanup failed (this is OK for in-memory database):', error);
  }
});

// Mock console methods to reduce test output noise (optional)
// Uncomment if you want cleaner test output
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
