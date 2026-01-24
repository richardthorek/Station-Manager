/**
 * Test Setup and Global Configuration
 * 
 * Sets up the testing environment before running tests.
 * Configures environment variables and global test utilities.
 * 
 * Note: This file runs via jest.config.js setupFilesAfterEnv,
 * which ensures it executes before any test files are loaded.
 * 
 * When using Azure Table Storage for tests:
 * - Tables are suffixed with 'Test' (e.g., MembersTest, ActivitiesTest)
 * - Test data should be seeded before running tests via `npm run seed:test`
 * - Test data is isolated from dev and prod environments
 */

import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

// Load environment variables from common locations for tests (no overrides)
const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env.local'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env.local'),
  path.resolve(__dirname, '../../../.env'),
];

candidateEnvPaths.forEach(envPath => {
  dotenv.config({ path: envPath, override: false });
});

// Set NODE_ENV to test to use test-specific Table Storage tables (suffixed with 'Test')
// This is safe here because setupFilesAfterEnv runs before test files
process.env.NODE_ENV = 'test';

// Create test CSV file for RFS facilities parser tests
// This file is gitignored in production but needed for testing
const testCsvPath = path.join(__dirname, '../data/rfs-facilities.csv');
const testCsvDir = path.dirname(testCsvPath);

if (!fs.existsSync(testCsvDir)) {
  fs.mkdirSync(testCsvDir, { recursive: true });
}

if (!fs.existsSync(testCsvPath)) {
  const testCsvContent = `X,Y,comment_,objectid,featuretype,descripton,class,facility_name,facility_operationalstatus,facility_address,abs_suburb,facility_state,abs_postcode,facility_lga,facility_district,facility_zone,facility_area,facility_region,facility_subdistrict,area_name,district_name,zone_name,region_name,sub_dist_name,extra_field
151.3409,-34.0142,,1,RFS Station,Rural Fire Service Station,Fire and Emergency,Bulli,Operational,Princess Highway,BULLI,NSW,2516,WOLLONGONG,ILLAWARRA,SOUTH COAST,,,ILLAWARRA DISTRICT,ILLAWARRA,ILLAWARRA DISTRICT,SOUTH COAST,,ILLAWARRA DISTRICT,
151.2093,-33.8688,,2,RFS Station,Rural Fire Service Station,Fire and Emergency,Sydney City,Operational,George Street,SYDNEY,NSW,2000,SYDNEY,SYDNEY METRO,METRO,,,SYDNEY DISTRICT,SYDNEY METRO,SYDNEY DISTRICT,METRO,,SYDNEY DISTRICT,
151.1234,-33.9567,,3,RFS Station,Rural Fire Service Station,Fire and Emergency,Engadine,Operational,Station Street,ENGADINE,NSW,2233,SUTHERLAND,SYDNEY METRO,METRO,,,SYDNEY SOUTH DISTRICT,SYDNEY METRO,SYDNEY SOUTH DISTRICT,METRO,,SYDNEY SOUTH DISTRICT,
150.8944,-34.4258,,4,RFS Station,Rural Fire Service Station,Fire and Emergency,Wollongong Central,Operational,Harbour Street,WOLLONGONG,NSW,2500,WOLLONGONG,ILLAWARRA,SOUTH COAST,,,ILLAWARRA DISTRICT,ILLAWARRA,ILLAWARRA DISTRICT,SOUTH COAST,,ILLAWARRA DISTRICT,
151.2500,-33.7500,,5,RFS Station,Rural Fire Service Station,Fire and Emergency,North Sydney Station,Operational,Miller Street,NORTH SYDNEY,NSW,2060,NORTH SYDNEY,SYDNEY METRO,METRO,,,SYDNEY NORTH DISTRICT,SYDNEY METRO,SYDNEY NORTH DISTRICT,METRO,,SYDNEY NORTH DISTRICT,
144.9631,-37.8136,,6,CFA Station,Country Fire Authority Station,Fire and Emergency,Melbourne Central,Operational,Collins Street,MELBOURNE,VIC,3000,MELBOURNE,MELBOURNE METRO,METRO,,,MELBOURNE DISTRICT,MELBOURNE METRO,MELBOURNE DISTRICT,METRO,,MELBOURNE DISTRICT,
153.0251,-27.4698,,7,QFES Station,Queensland Fire and Emergency Services,Fire and Emergency,Brisbane Central,Operational,Queen Street,BRISBANE,QLD,4000,BRISBANE,BRISBANE METRO,METRO,,,BRISBANE DISTRICT,BRISBANE METRO,BRISBANE DISTRICT,METRO,,BRISBANE DISTRICT,
138.6007,-34.9285,,8,CFS Station,Country Fire Service Station,Fire and Emergency,Adelaide Central,Operational,King William Street,ADELAIDE,SA,5000,ADELAIDE,ADELAIDE METRO,METRO,,,ADELAIDE DISTRICT,ADELAIDE METRO,ADELAIDE DISTRICT,METRO,,ADELAIDE DISTRICT,
115.8605,-31.9505,,9,DFES Station,Department of Fire and Emergency Services,Fire and Emergency,Perth Central,Operational,Murray Street,PERTH,WA,6000,PERTH,PERTH METRO,METRO,,,PERTH DISTRICT,PERTH METRO,PERTH DISTRICT,METRO,,PERTH DISTRICT,
147.3272,-42.8821,,10,TFS Station,Tasmania Fire Service,Fire and Emergency,Hobart Central,Operational,Macquarie Street,HOBART,TAS,7000,HOBART,HOBART METRO,METRO,,,HOBART DISTRICT,HOBART METRO,HOBART DISTRICT,METRO,,HOBART DISTRICT,`;
  
  fs.writeFileSync(testCsvPath, testCsvContent, 'utf-8');
}

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
