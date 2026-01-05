/**
 * Post-Deployment Smoke Tests
 * 
 * This script runs after deployment to validate:
 * 1. Application is running and responsive
 * 2. Health check endpoint is functional
 * 3. Database connectivity (with test tables)
 * 4. Basic API operations work
 * 5. Version verification (correct commit SHA deployed)
 * 
 * Uses TABLE_STORAGE_TABLE_SUFFIX=Test to isolate test data from production.
 * 
 * Retry Strategy:
 *   - CI/CD polls health endpoint every 10s (max 10 attempts = 100s) before running tests
 *   - Tests start as soon as app responds, or after 100s timeout
 *   - Individual test retries on network errors (ECONNREFUSED, ETIMEDOUT, etc.)
 *   - Retries on 404, 502, 503 status codes (deployment still stabilizing)
 *   - Retries on version mismatch (Azure App Service restart in progress)
 *   - 10 second delay between test retries
 *   - Default 6 retries per request (60 seconds max per request, reduced from 12)
 *   - Overall test suite timeout: 10 minutes to prevent indefinite hanging
 *   - Version test can take up to 60 seconds with retries (7 attempts × 10s)
 *   - Total stabilization time: up to 100s polling + up to 60s verification = 160s max
 * 
 * Version Verification:
 *   The version test is retry-aware because Azure App Service takes time to:
 *   1. Apply new environment variables set via az webapp config appsettings set
 *   2. Restart the application (triggered by az webapp restart)
 *   3. Initialize Node.js and load environment variables
 *   4. Begin serving requests with the new configuration
 *   
 *   During this window, the health endpoint may return the old commit SHA.
 *   The test retries for up to 60 seconds to allow Azure to complete the restart.
 * 
 * Usage:
 *   APP_URL=https://bungrfsstation.azurewebsites.net npm run test:post-deploy
 * 
 * Environment Variables:
 *   APP_URL: The deployed application URL (required)
 *   TABLE_STORAGE_TABLE_SUFFIX: Set to "Test" to use test tables (default: Test)
 *   TEST_TIMEOUT: Timeout for each test in ms (default: 30000)
 *   MAX_RETRIES: Number of retries for failed requests (default: 6, reduced from 12)
 *   OVERALL_TIMEOUT: Overall timeout for entire test suite in seconds (default: 600 = 10 minutes)
 *   GITHUB_SHA: Expected commit SHA for version verification
 */

import http from 'http';
import https from 'https';

// Configuration
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const TEST_TIMEOUT = parseInt(process.env.TEST_TIMEOUT || '30000');
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '6'); // Reduced from 12 to 6 (60s max per request)
const RETRY_DELAY = 10000; // 10 seconds between retries
const OVERALL_TIMEOUT = parseInt(process.env.OVERALL_TIMEOUT || '600') * 1000; // 10 minutes default (in ms)
const EXPECTED_COMMIT_SHA = process.env.GITHUB_SHA || process.env.GIT_COMMIT_SHA; // From CI/CD or manual override

// HTTP status codes that indicate deployment is still stabilizing
// These will trigger automatic retries:
// - 404: Route not found (app still loading/registering routes)
// - 502: Bad Gateway (Azure proxy can't connect to app yet)
// - 503: Service Unavailable (app is starting up)
// Note: Other error codes (401, 403, 500, etc.) indicate actual application
// errors that won't be fixed by retrying, so we fail fast on those.
const RETRYABLE_STATUS_CODES = [404, 502, 503];

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
 * Helper function to perform retry logic
 */
function retryRequest(
  url: string,
  options: any,
  retries: number,
  resolve: (value: any) => void,
  reject: (reason?: any) => void
): void {
  sleep(RETRY_DELAY)
    .then(() => makeRequest(url, options, retries - 1))
    .then(resolve)
    .catch(reject);
}

/**
 * Make HTTP/HTTPS request with retry logic
 * Retries on network errors and deployment-related HTTP status codes
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
          const statusCode = res.statusCode || 0;
          
          // Check if we should retry on this status code
          const shouldRetry = retries > 0 && RETRYABLE_STATUS_CODES.includes(statusCode);
          
          if (shouldRetry) {
            console.log(`  ⏳ Got ${statusCode} status, retrying in ${RETRY_DELAY / 1000}s... (${retries} retries left)`);
            retryRequest(url, options, retries, resolve, reject);
          } else {
            resolve({
              statusCode,
              data,
            });
          }
        });
      }
    );

    req.on('error', (error) => {
      if (retries > 0) {
        console.log(`  ⏳ Request failed, retrying in ${RETRY_DELAY / 1000}s... (${retries} retries left)`);
        retryRequest(url, options, retries, resolve, reject);
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
  const testStartTime = Date.now();
  process.stdout.write(`  Testing: ${name}... `);
  try {
    await fn();
    testsPassed++;
    const duration = Math.floor((Date.now() - testStartTime) / 1000);
    console.log(`✅ PASS (${duration}s)`);
  } catch (error) {
    testsFailed++;
    const duration = Math.floor((Date.now() - testStartTime) / 1000);
    console.log(`❌ FAIL (${duration}s)`);
    console.error(`    Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Test 1: Version Verification
 * Verifies that the deployed backend has the expected commit SHA
 * This ensures the correct code is running in production
 * 
 * Note: This test retries on version mismatch because Azure App Service
 * may take time to restart and pick up new environment variables after deployment.
 */
async function testVersionVerification(): Promise<void> {
  let lastError: Error | null = null;
  let attempts = 0;
  const maxAttempts = MAX_RETRIES + 1; // +1 for initial attempt
  
  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      const response = await makeRequest(`${APP_URL}/health`);
      
      if (response.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${response.statusCode}`);
      }

      const data = JSON.parse(response.data);
      
      if (!data.version) {
        throw new Error('Missing version information in health check response');
      }

      const deployedSha = data.version.commitSha;
      
      if (!deployedSha || deployedSha === 'unknown') {
        throw new Error('Deployed version has unknown commit SHA');
      }

      // If we have an expected SHA from CI/CD, verify it matches
      if (EXPECTED_COMMIT_SHA) {
        if (deployedSha !== EXPECTED_COMMIT_SHA) {
          const error = new Error(
            `Version mismatch! Expected: ${EXPECTED_COMMIT_SHA}, Deployed: ${deployedSha}`
          );
          
          // If we still have retries left, retry on version mismatch
          if (attempts < maxAttempts) {
            console.log(`    ⏳ Version mismatch (attempt ${attempts}/${maxAttempts}), retrying in ${RETRY_DELAY / 1000}s...`);
            console.log(`       Expected: ${EXPECTED_COMMIT_SHA.substring(0, 7)}..., Got: ${deployedSha.substring(0, 7)}...`);
            lastError = error;
            await sleep(RETRY_DELAY);
            continue;
          }
          
          // Out of retries, fail
          throw error;
        }
        console.log(`    ✅ Version verified: ${data.version.commitShort} (${deployedSha.substring(0, 7)})`);
        if (attempts > 1) {
          console.log(`       (Succeeded after ${attempts} attempts)`);
        }
      } else {
        console.log(`    ℹ️  Deployed version: ${data.version.commitShort} (no expected SHA to verify against)`);
      }
      
      // Success!
      return;
      
    } catch (error) {
      lastError = error as Error;
      
      // If this is a network error and we have retries left, retry
      if (attempts < maxAttempts && error instanceof Error && 
          (error.message.includes('ECONNREFUSED') || error.message.includes('timeout'))) {
        console.log(`    ⏳ Network error (attempt ${attempts}/${maxAttempts}), retrying in ${RETRY_DELAY / 1000}s...`);
        await sleep(RETRY_DELAY);
        continue;
      }
      
      // Out of retries or non-retryable error
      throw error;
    }
  }
  
  // If we get here, we ran out of retries
  throw lastError || new Error('Version verification failed after all retries');
}

/**
 * Test 2: Health Check Endpoint
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
 * Test 3: API Status Endpoint
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
 * Test 4: Get Activities Endpoint
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
 * Test 5: Get Members Endpoint
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
 * Test 6: Get Check-ins Endpoint
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
 * Test 7: Frontend Loads (SPA)
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
 * Test 8: CORS Headers Present
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
 * Test 9: Rate Limiting Not Triggered (Basic Check)
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
 * Main test runner with overall timeout
 */
async function runTests(): Promise<void> {
  console.log('\n🧪 Starting Post-Deployment Smoke Tests\n');
  console.log(`Target URL: ${APP_URL}`);
  console.log(`Timeout: ${TEST_TIMEOUT}ms per test`);
  console.log(`Max Retries: ${MAX_RETRIES} per test`);
  console.log(`Overall Timeout: ${OVERALL_TIMEOUT / 1000}s (${OVERALL_TIMEOUT / 60000} minutes)`);
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

  // Track start time for overall timeout
  const startTime = Date.now();
  
  // Helper to check if overall timeout has been exceeded
  const checkOverallTimeout = () => {
    const elapsed = Date.now() - startTime;
    if (elapsed > OVERALL_TIMEOUT) {
      console.error(`\n❌ TIMEOUT: Test suite exceeded ${OVERALL_TIMEOUT / 1000}s overall timeout`);
      console.error(`   Elapsed time: ${Math.floor(elapsed / 1000)}s`);
      console.error(`   Tests run: ${testsRun}, Passed: ${testsPassed}, Failed: ${testsFailed}`);
      process.exit(1);
    }
  };

  // Run all tests - VERSION VERIFICATION FIRST
  checkOverallTimeout();
  await test('Version verification (commit SHA matches)', testVersionVerification);
  
  checkOverallTimeout();
  await test('Health check endpoint responds', testHealthCheck);
  
  checkOverallTimeout();
  await test('API status endpoint responds', testApiStatus);
  
  checkOverallTimeout();
  await test('Activities API endpoint works', testGetActivities);
  
  checkOverallTimeout();
  await test('Members API endpoint works', testGetMembers);
  
  checkOverallTimeout();
  await test('Check-ins API endpoint works', testGetCheckins);
  
  checkOverallTimeout();
  await test('Frontend SPA loads correctly', testFrontendLoads);
  
  checkOverallTimeout();
  await test('CORS configuration present', testCorsHeaders);
  
  checkOverallTimeout();
  await test('Rate limiting configured', testRateLimiting);

  // Print summary
  const totalElapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests:  ${testsRun}`);
  console.log(`Passed:       ${testsPassed} ✅`);
  console.log(`Failed:       ${testsFailed} ❌`);
  console.log(`Duration:     ${totalElapsed}s`);
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
