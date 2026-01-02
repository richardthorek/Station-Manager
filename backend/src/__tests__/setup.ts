/**
 * Test Setup and Global Configuration
 * 
 * Sets up the testing environment before running tests.
 * Configures environment variables and global test utilities.
 */

// Set NODE_ENV to test to ensure we use in-memory database
process.env.NODE_ENV = 'test';

// Increase timeout for async operations
jest.setTimeout(10000);

// Mock uuid module
jest.mock('uuid');

// Mock console methods to reduce test output noise (optional)
// Uncomment if you want cleaner test output
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
