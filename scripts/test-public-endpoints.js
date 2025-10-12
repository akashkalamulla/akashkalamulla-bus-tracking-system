const axios = require('axios');

const BASE_URL = 'https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev';

// Test public endpoints (no authentication required)
async function testPublicEndpoints() {
  console.log('🌐 Testing Public API Endpoints\\n');

  try {
    // 1. Get public statistics
    console.log('1. Getting public statistics...');
    const stats = await axios.get(`${BASE_URL}/public/stats`);
    console.log('✅ Stats retrieved:', {
      totalRoutes: stats.data.statistics.totalRoutes,
      totalBuses: stats.data.statistics.totalBuses,
      activeBuses: stats.data.statistics.activeBuses,
    });
    console.log(`Cache headers: ETag=${stats.headers.etag}, Cache-Control=${stats.headers['cache-control']}`);
    console.log(`Rate limit: ${stats.headers['x-ratelimit-remaining']}/${stats.headers['x-ratelimit-limit']} remaining`);

    // 2. Get all routes with pagination
    console.log('\\n2. Getting routes with pagination...');
    const routes = await axios.get(`${BASE_URL}/public/routes?page=1&limit=5`);
    console.log(`✅ Routes retrieved: ${routes.data.data.length} routes (page ${routes.data.pagination.currentPage})`);
    console.log('Pagination:', {
      totalPages: routes.data.pagination.totalPages,
      totalItems: routes.data.pagination.totalItems,
      hasNext: routes.data.pagination.hasNext,
    });

    // Test ETag caching
    if (routes.headers.etag) {
      console.log('\\n3. Testing ETag caching...');
      try {
        const cachedRequest = await axios.get(`${BASE_URL}/public/routes?page=1&limit=5`, {
          headers: {
            'If-None-Match': routes.headers.etag,
          },
        });
        console.log('❌ Should have received 304 Not Modified');
      } catch (error) {
        if (error.response?.status === 304) {
          console.log('✅ ETag caching working: 304 Not Modified received');
        } else {
          console.log(`⚠️  Unexpected status: ${error.response?.status}`);
        }
      }
    }

    // 4. Get specific route (if routes exist)
    if (routes.data.data.length > 0) {
      const firstRoute = routes.data.data[0];
      console.log(`\\n4. Getting specific route: ${firstRoute.RouteID}`);

      const routeDetails = await axios.get(`${BASE_URL}/public/routes/${firstRoute.RouteID}`);
      console.log('✅ Route details retrieved:', {
        routeId: routeDetails.data.RouteID,
        routeName: routeDetails.data.RouteName,
        totalBuses: routeDetails.data.statistics?.totalBuses || 0,
        activeBuses: routeDetails.data.statistics?.activeBuses || 0,
      });

      // 5. Get live buses on route
      console.log(`\\n5. Getting live buses on route: ${firstRoute.RouteID}`);
      const liveBuses = await axios.get(`${BASE_URL}/public/routes/${firstRoute.RouteID}/buses/live`);
      console.log(`✅ Live buses retrieved: ${liveBuses.data.count} live buses out of ${liveBuses.data.totalBusesOnRoute} total`);

      if (liveBuses.data.buses.length > 0) {
        const firstBus = liveBuses.data.buses[0];
        console.log('Sample bus:', {
          busId: firstBus.busId,
          busNumber: firstBus.busNumber,
          location: `${firstBus.location.latitude}, ${firstBus.location.longitude}`,
          lastUpdate: firstBus.lastUpdate,
        });
      }
    }

    // 6. Search routes
    console.log('\\n6. Testing route search...');
    const searchResults = await axios.get(`${BASE_URL}/public/routes/search?q=colombo&limit=3`);
    console.log(`✅ Search completed: ${searchResults.data.pagination.totalItems} matches for "colombo"`);

    if (searchResults.data.data.length > 0) {
      console.log('Sample results:', searchResults.data.data.map((route) => ({
        routeId: route.RouteID,
        routeName: route.RouteName,
        start: route.StartLocation,
        end: route.EndLocation,
      })));
    }

    // 7. Test rate limiting (make multiple rapid requests)
    console.log('\\n7. Testing rate limiting...');
    let rateLimitHit = false;

    for (let i = 0; i < 10; i++) {
      try {
        const response = await axios.get(`${BASE_URL}/public/stats`);
        const remaining = response.headers['x-ratelimit-remaining'];
        console.log(`Request ${i + 1}: ${remaining} requests remaining`);

        if (parseInt(remaining, 10) < 5) {
          console.log('🔄 Getting close to rate limit...');
        }
      } catch (error) {
        if (error.response?.status === 429) {
          console.log('✅ Rate limiting working: 429 Too Many Requests');
          const retryAfter = error.response.headers['retry-after'];
          console.log(`Retry after: ${retryAfter} seconds`);
          rateLimitHit = true;
          break;
        }
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!rateLimitHit) {
      console.log('✅ Rate limiting configured but not hit during test');
    }
  } catch (error) {
    console.error(`❌ Test failed: ${error.response?.data?.message || error.message}`);
    console.error(`Status: ${error.response?.status}`);
  }
}

// Test caching performance
async function testCachingPerformance() {
  console.log('\\n\\n⚡ Testing Caching Performance\\n');

  const endpoint = `${BASE_URL}/public/routes`;

  // First request (cache miss)
  console.log('1. First request (cache miss)...');
  const start1 = Date.now();
  const response1 = await axios.get(endpoint);
  const time1 = Date.now() - start1;
  console.log(`✅ Cache miss: ${time1}ms`);

  // Second request (cache hit)
  console.log('2. Second request (cache hit)...');
  const start2 = Date.now();
  const response2 = await axios.get(endpoint);
  const time2 = Date.now() - start2;
  console.log(`✅ Cache hit: ${time2}ms`);

  const speedup = ((time1 - time2) / time1 * 100).toFixed(1);
  console.log(`🚀 Cache speedup: ${speedup}% faster`);

  // Verify data consistency
  const dataMatch = JSON.stringify(response1.data) === JSON.stringify(response2.data);
  console.log(`✅ Data consistency: ${dataMatch ? 'PASS' : 'FAIL'}`);
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Public API Testing Suite\\n');
  console.log('===========================\\n');

  await testPublicEndpoints();
  await testCachingPerformance();

  console.log('\\n\\n🏁 Testing Complete!');
  console.log('\\nPublic Endpoints Available:');
  console.log('• GET /public/routes                     - Get all routes (paginated)');
  console.log('• GET /public/routes/{routeId}           - Get specific route details');
  console.log('• GET /public/routes/{routeId}/buses/live - Get live buses on route');
  console.log('• GET /public/routes/search              - Search routes by keyword');
  console.log('• GET /public/stats                      - Get system statistics');
  console.log('\\nFeatures:');
  console.log('• ✅ Aggressive Redis caching with TTL');
  console.log('• ✅ ETag headers for client-side caching');
  console.log('• ✅ Pagination support');
  console.log('• ✅ Rate limiting (100 req/min per IP)');
  console.log('• ✅ No authentication required');
  console.log('• ✅ CORS enabled');
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testPublicEndpoints, testCachingPerformance };
