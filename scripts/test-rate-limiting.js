#!/usr/bin/env node

/**
 * Rate Limiting Test Script
 * Tests API Gateway Usage Plans rate limiting functionality
 *
 * Usage: node scripts/test-rate-limiting.js [stage] [region]
 */

const https = require('https');
const { URL } = require('url');

// Configuration
const stage = process.argv[2] || 'dev';
const region = process.argv[3] || 'ap-south-1';

// Test configuration
const tests = {
  publicEndpoint: '/public/routes',
  authenticatedEndpoint: '/routes', // This also requires API key now
  maxRequests: 20,
  concurrentRequests: 5,
  delayBetweenRequests: 100, // milliseconds
};

/**
 * Make HTTP request
 */
function makeRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Rate-Limiting-Test/1.0',
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: data,
          timestamp: new Date().toISOString(),
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Run rate limiting test
 */
async function runRateLimitTest(baseUrl, endpoint, apiKey, testName) {
  console.log(`\n🧪 Testing ${testName}`);
  console.log('='.repeat(50));
  console.log(`Endpoint: ${endpoint}`);
  console.log(`API Key: ${apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT PROVIDED'}`);
  console.log(`Max requests: ${tests.maxRequests}`);
  console.log(`Concurrent: ${tests.concurrentRequests}`);
  console.log();

  const url = baseUrl + endpoint;
  const headers = apiKey ? { 'X-API-Key': apiKey } : {};

  const results = {
    success: 0,
    throttled: 0,
    forbidden: 0,
    errors: 0,
    responses: [],
  };

  // Test 1: Single request to verify basic functionality
  console.log('📋 Test 1: Basic functionality');
  try {
    const response = await makeRequest(url, headers);
    console.log(`   Status: ${response.statusCode} ${response.statusMessage}`);

    if (response.statusCode === 200) {
      console.log('   ✅ Basic request successful');
    } else if (response.statusCode === 403) {
      console.log('   🔒 Forbidden - API key required or invalid');
    } else if (response.statusCode === 429) {
      console.log('   ⚡ Rate limited (unexpected for single request)');
    } else {
      console.log(`   ❓ Unexpected status: ${response.statusCode}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 2: Rapid fire requests to test rate limiting
  console.log('\n📋 Test 2: Rate limiting (rapid requests)');
  const promises = [];

  for (let i = 0; i < tests.maxRequests; i++) {
    const promise = makeRequest(url, headers)
      .then((response) => {
        results.responses.push(response);

        if (response.statusCode === 200) {
          results.success++;
        } else if (response.statusCode === 429) {
          results.throttled++;
        } else if (response.statusCode === 403) {
          results.forbidden++;
        } else {
          results.errors++;
        }

        return response;
      })
      .catch((error) => {
        results.errors++;
        return { error: error.message, timestamp: new Date().toISOString() };
      });

    promises.push(promise);

    // Add small delay between requests
    if (i < tests.maxRequests - 1) {
      await new Promise((resolve) => setTimeout(resolve, tests.delayBetweenRequests));
    }
  }

  console.log('   ⏳ Sending requests...');
  await Promise.all(promises);

  // Display results
  console.log('\n📊 Results:');
  console.log(`   ✅ Successful (200): ${results.success}`);
  console.log(`   ⚡ Throttled (429): ${results.throttled}`);
  console.log(`   🔒 Forbidden (403): ${results.forbidden}`);
  console.log(`   ❌ Errors: ${results.errors}`);
  console.log(`   📊 Total requests: ${results.responses.length}`);

  // Show rate limiting effectiveness
  if (results.throttled > 0) {
    console.log('\n✅ Rate limiting is working! Some requests were throttled.');
  } else if (results.forbidden > 0) {
    console.log('\n🔒 API key authentication is working! Requests were forbidden.');
  } else if (results.success === tests.maxRequests) {
    console.log('\n⚠️  All requests succeeded - rate limiting may not be active or limits are high.');
  }

  return results;
}

/**
 * Main test function
 */
async function main() {
  console.log('🚀 Bus Tracking System - Rate Limiting Test');
  console.log(`   Stage: ${stage}`);
  console.log(`   Region: ${region}`);
  console.log('='.repeat(60));

  // Try to load API keys from environment file
  let publicApiKey; let authApiKey; let
    baseUrl;

  try {
    const envFile = `.env.api-keys.${stage}`;
    const fs = require('fs');

    if (fs.existsSync(envFile)) {
      const envContent = fs.readFileSync(envFile, 'utf8');
      const apiKeyMatch = envContent.match(/PUBLIC_API_KEY=(.+)/);
      const authKeyMatch = envContent.match(/AUTHENTICATED_API_KEY=(.+)/);
      const baseUrlMatch = envContent.match(/API_BASE_URL=(.+)/);

      publicApiKey = apiKeyMatch ? apiKeyMatch[1].trim() : null;
      authApiKey = authKeyMatch ? authKeyMatch[1].trim() : null;
      baseUrl = baseUrlMatch ? baseUrlMatch[1].trim() : null;

      console.log(`📄 Loaded configuration from ${envFile}`);
    }
  } catch (error) {
    console.log('⚠️  Could not load API keys from environment file');
  }

  // Fallback to manual input if no environment file
  if (!baseUrl) {
    console.log('\n❗ API configuration not found. Please:');
    console.log(`1. Deploy your application: serverless deploy --stage ${stage}`);
    console.log(`2. Get API keys: node scripts/get-api-keys.js ${stage}`);
    console.log('3. Re-run this test');
    process.exit(1);
  }

  console.log(`🌐 Base URL: ${baseUrl}`);

  // Test scenarios
  const scenarios = [
    {
      name: 'Public Endpoint WITHOUT API Key',
      endpoint: tests.publicEndpoint,
      apiKey: null,
      expectForbidden: true,
    },
    {
      name: 'Public Endpoint WITH API Key',
      endpoint: tests.publicEndpoint,
      apiKey: publicApiKey,
      expectForbidden: false,
    },
  ];

  if (authApiKey) {
    scenarios.push({
      name: 'Routes Endpoint WITH API Key',
      endpoint: tests.authenticatedEndpoint,
      apiKey: authApiKey,
      expectForbidden: false,
    });
  }

  // Run tests
  for (const scenario of scenarios) {
    await runRateLimitTest(baseUrl, scenario.endpoint, scenario.apiKey, scenario.name);

    // Wait between tests
    if (scenarios.indexOf(scenario) < scenarios.length - 1) {
      console.log('\n⏳ Waiting 5 seconds before next test...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log('\n🎉 Rate limiting tests completed!');
  console.log('\n💡 Tips:');
  console.log('   - Check AWS CloudWatch for API Gateway metrics');
  console.log('   - Monitor Usage Plans in AWS Console for detailed statistics');
  console.log('   - Adjust rate limits in serverless.yml if needed');
}

// Run tests if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runRateLimitTest };
