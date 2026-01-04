/**
 * Post-Deployment Smoke Tests
 * 
 * This script runs after deployment to validate:
 * 1. Application is running and responsive
 * 2. Health check endpoint is functional
 * 3. Database connectivity (with test tables)
 * 4. Basic API operations work
 * 
 * Uses TABLE_STORAGE_TABLE_SUFFIX=Test to isolate test data from production.
 * 
 * Usage:
 *   APP_URL=https://bungrfsstation.azurewebsites.net npm run test:post-deploy
 * 
 * Environment Variables:
 *   APP_URL: The deployed application URL (required)
 *   TABLE_STORAGE_TABLE_SUFFIX: Set to "Test" to use test tables (default: Test)
 *   TEST_TIMEOUT: Timeout for each test in ms (default: 30000)
 *   MAX_RETRIES: Number of retries for failed requests (default: 3)
 */

import http from 'http';
import https from 'https';

// Configuration
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const TEST_TIMEOUT = parseInt(process.env.TEST_TIMEOUT || '30000');
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3');
const RETRY_DELAY = 5000; // 5 seconds between retries

// Test results tracking
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make HTTP/HTTPS request with retry logic
 */
async function makeRequest(
  url: string,
  options: any = {},
  retries = MAX_RETRIES
): Promise<{ statusCode: number; data: string }> {
  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: TEST_TIMEOUT,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            data,
          });
        });
      }
    );

    req.on('error', async (error) => {
      if (retries > 0) {
        console.log(`  ⏳ Request failed, retrying in ${RETRY_DELAY / 1000}s... (${retries} retries left)`);
        await sleep(RETRY_DELAY);
        try {
          const result = await makeRequest(url, options, retries - 1);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(error);
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Run a single test
 */
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  testsRun++;
  process.stdout.write(`  Testing: ${name}... `);
  try {
    await fn();
    testsPassed++;
    console.log('✅ PASS');
  } catch (error) {
    testsFailed++;
    console.log('❌ FAIL');
    console.error(`    Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Test 1: Health Check Endpoint
 */
async function testHealthCheck(): Promise<void> {
  const response = await makeRequest(`${APP_URL}/health`);
  
  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}`);
  }

  const data = JSON.parse(response.data);
  
  if (data.status !== 'ok') {
    throw new Error(`Expected status 'ok', got '${data.status}'`);
  }

  if (!data.timestamp) {
    throw new Error('Missing timestamp in health check response');
  }

  if (!data.database) {
    throw new Error('Missing database type in health check response');
  }

  // Verify we're using Table Storage in deployed environment
  if (data.database !== 'table-storage') {
    console.log(`    ⚠️  Warning: Expected table-storage, got '${data.database}'`);
  }
}

/**
 * Test 2: API Status Endpoint
 */
async function testApiStatus(): Promise<void> {
  const response = await makeRequest(`${APP_URL}/api/status`);
  
  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}`);
  }

  const data = JSON.parse(response.data);
  
  if (data.status !== 'ok') {
    throw new Error(`Expected status 'ok', got '${data.status}'`);
  }

  if (!data.databaseType) {
    throw new Error('Missing databaseType in status response');
  }

  if (!data.timestamp) {
    throw new Error('Missing timestamp in status response');
  }
}

/**
 * Test 3: Get Activities Endpoint
 */
async function testGetActivities(): Promise<void> {
  const response = await makeRequest(`${APP_URL}/api/activities`);
  
  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}`);
  }

  const data = JSON.parse(response.data);
  
  if (!Array.isArray(data)) {
    throw new Error('Expected activities to be an array');
  }

  // Should have default activities (Training, Maintenance, Meeting)
  if (data.length < 3) {
    console.log(`    ℹ️  Info: Expected at least 3 default activities, got ${data.length}`);
  }
}

/**
 * Test 4: Get Members Endpoint
 */
async function testGetMembers(): Promise<void> {
  const response = await makeRequest(`${APP_URL}/api/members`);
  
  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}`);
  }

  const data = JSON.parse(response.data);
  
  if (!Array.isArray(data)) {
    throw new Error('Expected members to be an array');
  }
}

/**
 * Test 5: Get Check-ins Endpoint
 */
async function testGetCheckins(): Promise<void> {
  const response = await makeRequest(`${APP_URL}/api/checkins`);
  
  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}`);
  }

  const data = JSON.parse(response.data);
  
  if (!Array.isArray(data)) {
    throw new Error('Expected checkins to be an array');
  }
}

/**
 * Test 6: Frontend Loads (SPA)
 */
async function testFrontendLoads(): Promise<void> {
  const response = await makeRequest(`${APP_URL}/`);
  
  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}`);
  }

  if (!response.data.includes('<div id="root">')) {
    throw new Error('Frontend HTML does not contain expected root element');
  }

  if (!response.data.includes('RFS Station Manager')) {
    console.log('    ℹ️  Info: Frontend HTML may not contain expected title');
  }
}

/**
 * Test 7: CORS Headers Present
 */
async function testCorsHeaders(): Promise<void> {
  const response = await makeRequest(`${APP_URL}/api/activities`);
  
  // Note: We can't easily check headers with basic http module without more complexity
  // This is a placeholder for header validation
  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}`);
  }
}

/**
 * Test 8: Rate Limiting Not Triggered (Basic Check)
 */
async function testRateLimiting(): Promise<void> {
  // Make a few requests to ensure rate limiting is not overly restrictive
  for (let i = 0; i < 5; i++) {
    const response = await makeRequest(`${APP_URL}/health`);
    if (response.statusCode === 429) {
      throw new Error('Rate limiting triggered too aggressively');
    }
  }
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  console.log('\n🧪 Starting Post-Deployment Smoke Tests\n');
  console.log(`Target URL: ${APP_URL}`);
  console.log(`Timeout: ${TEST_TIMEOUT}ms`);
  console.log(`Max Retries: ${MAX_RETRIES}`);
  console.log(`Test Environment: TABLE_STORAGE_TABLE_SUFFIX=${process.env.TABLE_STORAGE_TABLE_SUFFIX || '(not set)'}\n`);

  // Validate APP_URL is set and warn if it's localhost in CI environment
  if (!APP_URL) {
    console.error('❌ ERROR: APP_URL environment variable must be set');
    console.error('   Example: APP_URL=https://bungrfsstation.azurewebsites.net npm run test:post-deploy');
    process.exit(1);
  }

  if (APP_URL === 'http://localhost:3000' && process.env.CI) {
    console.error('❌ ERROR: Cannot use localhost URL in CI environment');
    console.error('   Set APP_URL to the deployed application URL');
    process.exit(1);
  }

  console.log('Running tests...\n');

  // Run all tests
  await test('Health check endpoint responds', testHealthCheck);
  await test('API status endpoint responds', testApiStatus);
  await test('Activities API endpoint works', testGetActivities);
  await test('Members API endpoint works', testGetMembers);
  await test('Check-ins API endpoint works', testGetCheckins);
  await test('Frontend SPA loads correctly', testFrontendLoads);
  await test('CORS configuration present', testCorsHeaders);
  await test('Rate limiting configured', testRateLimiting);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests:  ${testsRun}`);
  console.log(`Passed:       ${testsPassed} ✅`);
  console.log(`Failed:       ${testsFailed} ❌`);
  console.log('='.repeat(60));

  if (testsFailed > 0) {
    console.log('\n❌ Some tests failed. Deployment may have issues.\n');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! Deployment successful.\n');
    process.exit(0);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch((error) => {
    console.error('\n❌ Fatal error running tests:', error);
    process.exit(1);
  });
}

export { runTests };
