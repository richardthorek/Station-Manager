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
 * Two-Phase Strategy:
 * 
 * PHASE 1: STABILIZATION (up to 20 minutes, configurable)
 *   - Polls health endpoint every 10 seconds
 *   - Validates site is responding AND correct version is deployed
 *   - Retries on network errors, 404/502/503, and version mismatches
 *   - Exits immediately once both conditions met (efficient)
 *   - Maximum: 1200s (20 minutes) by default, configurable via STABILIZATION_TIMEOUT
 * 
 * PHASE 2: FUNCTIONAL TESTS (minimal retries)
 *   - Runs only after stabilization confirms site is ready
 *   - Each test gets 2 quick retries (10s between) for transient issues
 *   - Tests fail fast since we know the site is up and correct version
 *   - Expected completion: 30-60 seconds for all 7 tests
 * 
 * Total Maximum Time: 20 minutes stabilization + 2 minutes tests = 22 minutes
 * 
 * This approach is efficient because:
 *   - Stabilization happens once, upfront
 *   - No duplicate health checks across tests
 *   - Functional tests run fast with minimal retries
 *   - Early exit when site is ready (usually < 5 minutes)
 * 
 * Usage:
 *   APP_URL=https://bungrfsstation.azurewebsites.net npm run test:post-deploy
 * 
 * Environment Variables:
 *   APP_URL: The deployed application URL (required)
 *   TABLE_STORAGE_TABLE_SUFFIX: Set to "Test" to use test tables (default: Test)
 *   STABILIZATION_TIMEOUT: Max time for site stabilization in seconds (default: 1200 = 20 minutes)
 *   FUNCTIONAL_TEST_TIMEOUT: Max time for functional tests in seconds (default: 120 = 2 minutes)
 *   STABILIZATION_INTERVAL: Seconds between stabilization checks (default: 10)
 *   FUNCTIONAL_TEST_RETRIES: Retries per functional test (default: 2)
 *   REQUEST_TIMEOUT: Timeout for individual HTTP requests in ms (default: 10000 = 10s)
 *   GITHUB_SHA: Expected commit SHA for version verification
 */

import http from 'http';
import https from 'https';

// Configuration - Two-Phase Approach
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Phase 1: Stabilization (site up + correct version)
const STABILIZATION_TIMEOUT = parseInt(process.env.STABILIZATION_TIMEOUT || '1200') * 1000; // 20 minutes in ms
const STABILIZATION_INTERVAL = parseInt(process.env.STABILIZATION_INTERVAL || '10') * 1000; // 10 seconds in ms
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '10000'); // 10 seconds for HTTP requests

// Phase 2: Functional tests (after stabilization)
const FUNCTIONAL_TEST_TIMEOUT = parseInt(process.env.FUNCTIONAL_TEST_TIMEOUT || '120') * 1000; // 2 minutes in ms
const FUNCTIONAL_TEST_RETRIES = parseInt(process.env.FUNCTIONAL_TEST_RETRIES || '2'); // Only 2 retries since site is stable
const FUNCTIONAL_TEST_RETRY_DELAY = 5000; // 5 seconds between retries (faster since site is up)

const EXPECTED_COMMIT_SHA = process.env.GITHUB_SHA || process.env.GIT_COMMIT_SHA; // From CI/CD or manual override

// HTTP status codes that indicate deployment is still stabilizing
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
 * Make a simple HTTP/HTTPS request
 * Returns response data and status code
 * Throws on network errors
 */
async function makeRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: any } = {}
): Promise<{ statusCode: number; data: string }> {
  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: REQUEST_TIMEOUT,
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

    req.on('error', (error) => {
      reject(error);
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
 * PHASE 1: Wait for site to stabilize (up and correct version)
 * 
 * This function polls the health endpoint until:
 * 1. The site responds with 200 status
 * 2. The deployed version matches the expected commit SHA
 * 
 * Exits immediately when both conditions are met (efficient).
 * Retries on network errors, 404/502/503, and version mismatches.
 * 
 * Returns: Time taken in seconds
 * Throws: If stabilization timeout exceeded
 */
async function waitForStabilization(): Promise<number> {
  const startTime = Date.now();
  const maxAttempts = Math.floor(STABILIZATION_TIMEOUT / STABILIZATION_INTERVAL);
  const timeoutSeconds = STABILIZATION_TIMEOUT / 1000; // Calculate once for reuse
  const intervalSeconds = STABILIZATION_INTERVAL / 1000;
  let attempt = 0;

  console.log('\n🔄 PHASE 1: Waiting for deployment to stabilize...');
  console.log(`   Max time: ${timeoutSeconds}s (${STABILIZATION_TIMEOUT / 60000} minutes)`);
  console.log(`   Checking every: ${intervalSeconds}s`);
  console.log(`   Max attempts: ${maxAttempts}\n`);

  while (true) {
    attempt++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    
    // Check if we've exceeded the wall clock timeout
    if (elapsed >= STABILIZATION_TIMEOUT / 1000) {
      throw new Error(`Stabilization timeout exceeded after ${elapsed}s (max: ${STABILIZATION_TIMEOUT / 1000}s)`);
    }

    // Check if we've exceeded the timeout before making another request
    if (elapsed >= timeoutSeconds) {
      throw new Error(`Stabilization timeout exceeded after ${elapsed}s (max: ${timeoutSeconds}s)`);
    }

    try {
      console.log(`Attempt ${attempt} (${elapsed}s elapsed, ${Math.floor(STABILIZATION_TIMEOUT / 1000 - elapsed)}s remaining): Checking health endpoint...`);
      
      const response = await makeRequest(`${APP_URL}/health`);

      // Check if site is responding
      if (response.statusCode === 200) {
        try {
          const data = JSON.parse(response.data);

          // Check if version info exists
          if (!data.version || !data.version.commitSha) {
            console.log(`   ⚠️  Site is up but missing version info, retrying...`);
            await sleep(STABILIZATION_INTERVAL);
            continue;
          }

          const deployedSha = data.version.commitSha;

          // If we have an expected SHA, verify it matches
          if (EXPECTED_COMMIT_SHA) {
            if (deployedSha === EXPECTED_COMMIT_SHA) {
              const duration = Math.floor((Date.now() - startTime) / 1000);
              console.log(`\n✅ Site stabilized! (${duration}s)`);
              console.log(`   Version: ${data.version.commitShort}`);
              console.log(`   Commit: ${deployedSha.substring(0, 7)}...`);
              console.log(`   Database: ${data.database || 'unknown'}\n`);
              return duration;
            } else {
              console.log(`   ⚠️  Version mismatch:`);
              console.log(`       Expected: ${EXPECTED_COMMIT_SHA.substring(0, 7)}...`);
              console.log(`       Deployed: ${deployedSha.substring(0, 7)}...`);
              console.log(`   Retrying...`);
            }
          } else {
            // No expected SHA, just verify site is up
            const duration = Math.floor((Date.now() - startTime) / 1000);
            console.log(`\n✅ Site is up! (${duration}s)`);
            console.log(`   Version: ${data.version.commitShort}`);
            console.log(`   ℹ️  No expected SHA provided, skipping version verification\n`);
            return duration;
          }
        } catch (parseError) {
          console.log(`   ⚠️  Failed to parse health response, retrying...`);
        }
      } else if (RETRYABLE_STATUS_CODES.includes(response.statusCode)) {
        console.log(`   ⚠️  Got ${response.statusCode} status (site still starting), retrying...`);
      } else {
        console.log(`   ❌ Unexpected status ${response.statusCode}, retrying...`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`   ⚠️  Request failed (${errorMsg}), retrying...`);
    }

    // Wait before next attempt, but check if we'll exceed timeout
    if (attempt < maxAttempts) {
      // Recalculate elapsed time for accuracy
      const currentElapsed = Math.floor((Date.now() - startTime) / 1000);
      const elapsedAfterSleep = currentElapsed + intervalSeconds;
      if (elapsedAfterSleep <= timeoutSeconds) {
        await sleep(STABILIZATION_INTERVAL);
      } else {
        // Would exceed timeout after sleep, exit now
        const duration = Math.floor((Date.now() - startTime) / 1000);
        throw new Error(`Stabilization timeout exceeded after ${duration}s (max: ${timeoutSeconds}s)`);
      }
    }
  }

  // Timeout exceeded
  const duration = Math.floor((Date.now() - startTime) / 1000);
  throw new Error(`Stabilization timeout exceeded after ${duration}s (max: ${timeoutSeconds}s)`);
}

/**
 * PHASE 2: Run a functional test with minimal retries
 * 
 * Since we know the site is up and stable, we only need minimal retries
 * for transient network issues.
 * 
 * Returns: void on success
 * Throws: Error on failure after retries
 */
async function runFunctionalTest(name: string, testFn: () => Promise<void>): Promise<void> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= FUNCTIONAL_TEST_RETRIES; attempt++) {
    try {
      await testFn();
      return; // Success!
    } catch (error) {
      lastError = error as Error;
      
      // If we have retries left, retry on network/transient errors only
      if (attempt < FUNCTIONAL_TEST_RETRIES) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        // Only retry on network errors or retryable status codes, not logic errors
        if (errorMsg.includes('ECONNREFUSED') || 
            errorMsg.includes('timeout') ||
            errorMsg.includes('ETIMEDOUT') ||
            errorMsg.includes('502') ||
            errorMsg.includes('503')) {
          console.log(`      ⏳ Transient error, retrying in ${FUNCTIONAL_TEST_RETRY_DELAY / 1000}s... (${FUNCTIONAL_TEST_RETRIES - attempt} retries left)`);
          await sleep(FUNCTIONAL_TEST_RETRY_DELAY);
          continue;
        }
      }
      
      // Non-retryable error or out of retries
      throw lastError;
    }
  }
  
  throw lastError || new Error('Test failed');
}

/**
 * Wrapper to run a test with tracking and error handling
 */
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  testsRun++;
  const testStartTime = Date.now();
  process.stdout.write(`   ${name}... `);
  try {
    await runFunctionalTest(name, fn);
    testsPassed++;
    const duration = Math.floor((Date.now() - testStartTime) / 1000);
    console.log(`✅ PASS (${duration}s)`);
  } catch (error) {
    testsFailed++;
    const duration = Math.floor((Date.now() - testStartTime) / 1000);
    console.log(`❌ FAIL (${duration}s)`);
    console.error(`      Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Functional Test 1: Health Check Endpoint
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
}

/**
 * Functional Test 2: API Status Endpoint
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
 * Functional Test 3: Get Activities Endpoint
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
}

/**
 * Functional Test 4: Get Members Endpoint
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
 * Functional Test 5: Get Check-ins Endpoint
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
 * Functional Test 6: Frontend Loads (SPA)
 */
async function testFrontendLoads(): Promise<void> {
  const response = await makeRequest(`${APP_URL}/`);
  
  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}`);
  }

  if (!response.data.includes('<div id="root">')) {
    throw new Error('Frontend HTML does not contain expected root element');
  }
}

/**
 * Functional Test 7: Rate Limiting Check
 */
async function testRateLimiting(): Promise<void> {
  // Make a few requests to ensure rate limiting is not overly restrictive
  for (let i = 0; i < 3; i++) {
    const response = await makeRequest(`${APP_URL}/health`);
    if (response.statusCode === 429) {
      throw new Error('Rate limiting triggered too aggressively');
    }
  }
}

/**
 * Main test runner - Two-Phase Approach
 */
async function runTests(): Promise<void> {
  console.log('\n🧪 Post-Deployment Smoke Tests');
  console.log('='.repeat(60));
  console.log(`Target: ${APP_URL}`);
  console.log(`Expected Commit: ${EXPECTED_COMMIT_SHA ? EXPECTED_COMMIT_SHA.substring(0, 7) + '...' : '(not set)'}`);
  console.log(`Test Environment: TABLE_STORAGE_TABLE_SUFFIX=${process.env.TABLE_STORAGE_TABLE_SUFFIX || '(not set)'}`);
  console.log('='.repeat(60));

  // Validate APP_URL is set
  if (!APP_URL) {
    console.error('\n❌ ERROR: APP_URL environment variable must be set');
    console.error('   Example: APP_URL=https://bungrfsstation.azurewebsites.net npm run test:post-deploy');
    process.exit(1);
  }

  if (APP_URL === 'http://localhost:3000' && process.env.CI) {
    console.error('\n❌ ERROR: Cannot use localhost URL in CI environment');
    console.error('   Set APP_URL to the deployed application URL');
    process.exit(1);
  }

  const overallStartTime = Date.now();

  try {
    // PHASE 1: Stabilization (site up + correct version)
    const stabilizationTime = await waitForStabilization();

    // PHASE 2: Functional tests (fast, minimal retries)
    console.log('🧪 PHASE 2: Running functional tests...\n');
    const functionalTestsStart = Date.now();

    // Create timeout for functional tests
    const functionalTestsTimeout = setTimeout(() => {
      const elapsed = Math.floor((Date.now() - functionalTestsStart) / 1000);
      console.error(`\n❌ TIMEOUT: Functional tests exceeded ${FUNCTIONAL_TEST_TIMEOUT / 1000}s timeout`);
      console.error(`   Elapsed: ${elapsed}s`);
      console.error(`   Tests run: ${testsRun}, Passed: ${testsPassed}, Failed: ${testsFailed}`);
      process.exit(1);
    }, FUNCTIONAL_TEST_TIMEOUT);

    // Run all functional tests
    await test('Health check endpoint', testHealthCheck);
    await test('API status endpoint', testApiStatus);
    await test('Activities API', testGetActivities);
    await test('Members API', testGetMembers);
    await test('Check-ins API', testGetCheckins);
    await test('Frontend SPA loads', testFrontendLoads);
    await test('Rate limiting', testRateLimiting);

    clearTimeout(functionalTestsTimeout);

    const functionalTestsDuration = Math.floor((Date.now() - functionalTestsStart) / 1000);
    const totalDuration = Math.floor((Date.now() - overallStartTime) / 1000);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('Test Summary');
    console.log('='.repeat(60));
    console.log(`Phase 1 (Stabilization):  ${stabilizationTime}s`);
    console.log(`Phase 2 (Functional):     ${functionalTestsDuration}s`);
    console.log(`Total Duration:           ${totalDuration}s`);
    console.log('='.repeat(60));
    console.log(`Tests Run:                ${testsRun}`);
    console.log(`Passed:                   ${testsPassed} ✅`);
    console.log(`Failed:                   ${testsFailed} ❌`);
    console.log('='.repeat(60));

    if (testsFailed > 0) {
      console.log('\n❌ Some tests failed. Deployment may have issues.\n');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed! Deployment successful.\n');
      process.exit(0);
    }
  } catch (error) {
    const duration = Math.floor((Date.now() - overallStartTime) / 1000);
    console.error(`\n❌ Fatal error after ${duration}s:`, error instanceof Error ? error.message : String(error));
    console.error(`   Tests run: ${testsRun}, Passed: ${testsPassed}, Failed: ${testsFailed}\n`);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch((error) => {
    console.error('\n❌ Uncaught error:', error);
    process.exit(1);
  });
}

export { runTests };
