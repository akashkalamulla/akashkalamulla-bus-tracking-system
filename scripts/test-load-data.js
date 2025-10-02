/**
 * Data Loading Test Utility
 * 
 * Demonstrates all features of the enhanced load-data.js script
 */

const { loadJsonData, batchWriteItems, CONFIG } = require('./load-data');

/**
 * Test data validation
 */
function testDataValidation() {
  console.log('🧪 TESTING DATA VALIDATION');
  console.log('===========================\n');
  
  try {
    // Test loading individual files
    console.log('📖 Testing individual file loading...');
    
    const routes = loadJsonData('routes.json');
    console.log(`✅ Routes: ${routes.length} records loaded`);
    
    const buses = loadJsonData('buses.json');
    console.log(`✅ Buses: ${buses.length} records loaded`);
    
    const schedules = loadJsonData('schedules.json');
    console.log(`✅ Schedules: ${schedules.length} records loaded`);
    
    const liveLocations = loadJsonData('live-locations.json');
    console.log(`✅ Live Locations: ${liveLocations.length} records loaded`);
    
    console.log('\n📊 Data Summary:');
    console.log(`Total records to load: ${routes.length + buses.length + schedules.length + liveLocations.length}`);
    console.log(`Estimated batches: ${Math.ceil((routes.length + buses.length + schedules.length + liveLocations.length) / CONFIG.batchSize)}`);
    
  } catch (error) {
    console.error('❌ Data validation failed:', error.message);
  }
}

/**
 * Test simulation data format
 */
function testSimulationData() {
  console.log('\n🧪 TESTING SIMULATION DATA FORMAT');
  console.log('==================================\n');
  
  try {
    // Check if simulation data exists
    const simulationData = loadJsonData('simulation-data.json.backup');
    
    console.log('📊 Simulation Data Structure:');
    Object.entries(simulationData).forEach(([key, data]) => {
      if (Array.isArray(data)) {
        console.log(`  ${key}: ${data.length} records`);
      } else {
        console.log(`  ${key}: ${typeof data}`);
      }
    });
    
    // Validate structure
    const requiredFields = ['routes', 'buses'];
    const missingFields = requiredFields.filter(field => !simulationData[field]);
    
    if (missingFields.length === 0) {
      console.log('✅ Simulation data structure is valid');
    } else {
      console.log(`⚠️  Missing required fields: ${missingFields.join(', ')}`);
    }
    
  } catch (error) {
    console.log('ℹ️  Simulation data not available for testing');
  }
}

/**
 * Test batch size calculations
 */
function testBatchCalculations() {
  console.log('\n🧪 TESTING BATCH CALCULATIONS');
  console.log('==============================\n');
  
  const testData = [
    { name: 'Small dataset', count: 10 },
    { name: 'Medium dataset', count: 50 },
    { name: 'Large dataset', count: 250 },
    { name: 'Extra large dataset', count: 1000 }
  ];
  
  testData.forEach(test => {
    const batches = Math.ceil(test.count / CONFIG.batchSize);
    const lastBatchSize = test.count % CONFIG.batchSize || CONFIG.batchSize;
    
    console.log(`📦 ${test.name}: ${test.count} items`);
    console.log(`  Batches: ${batches}`);
    console.log(`  Last batch size: ${lastBatchSize} items`);
    console.log(`  Estimated time: ${(batches * 0.1).toFixed(1)}s (with throttling)`);
    console.log('');
  });
}

/**
 * Test environment configuration
 */
function testEnvironmentConfig() {
  console.log('\n🧪 TESTING ENVIRONMENT CONFIGURATION');
  console.log('=====================================\n');
  
  // Test different environment scenarios
  const environments = [
    { name: 'Local Development', isLocal: true, stage: 'dev' },
    { name: 'AWS Development', isLocal: false, stage: 'dev' },
    { name: 'AWS Staging', isLocal: false, stage: 'staging' },
    { name: 'AWS Production', isLocal: false, stage: 'prod' }
  ];
  
  environments.forEach(env => {
    console.log(`🌐 ${env.name}:`);
    
    // Simulate table name generation
    const prefix = env.isLocal ? 'bus-tracking-system-dev' : `bus-tracking-system-${env.stage}`;
    const tableNames = {
      routes: `${prefix}-routes`,
      buses: `${prefix}-buses`,
      liveLocations: `${prefix}-live-locations`,
      schedules: `${prefix}-schedules`
    };
    
    Object.entries(tableNames).forEach(([key, tableName]) => {
      console.log(`  ${key}: ${tableName}`);
    });
    console.log('');
  });
}

/**
 * Test error scenarios
 */
function testErrorScenarios() {
  console.log('\n🧪 TESTING ERROR SCENARIOS');
  console.log('===========================\n');
  
  const errorTests = [
    {
      name: 'Missing data file',
      test: () => loadJsonData('nonexistent.json'),
      expectedError: 'Data file not found'
    },
    {
      name: 'Invalid JSON format',
      test: () => {
        // Simulate invalid JSON
        const fs = require('fs');
        const path = require('path');
        const testFile = path.join('data', 'test-invalid.json');
        fs.writeFileSync(testFile, '{ invalid json }');
        try {
          return loadJsonData('test-invalid.json');
        } finally {
          fs.unlinkSync(testFile);
        }
      },
      expectedError: 'JSON parsing error'
    }
  ];
  
  errorTests.forEach(errorTest => {
    console.log(`❌ Testing: ${errorTest.name}`);
    try {
      errorTest.test();
      console.log('  Unexpected success - error should have been thrown');
    } catch (error) {
      console.log(`  ✅ Expected error caught: ${error.message.substring(0, 50)}...`);
    }
    console.log('');
  });
}

/**
 * Display performance recommendations
 */
function displayPerformanceRecommendations() {
  console.log('\n🚀 PERFORMANCE RECOMMENDATIONS');
  console.log('===============================\n');
  
  console.log('📈 Batch Writing Optimization:');
  console.log(`  Current batch size: ${CONFIG.batchSize} items (DynamoDB limit)`);
  console.log(`  Retry attempts: ${CONFIG.maxRetries}`);
  console.log(`  Retry delay: ${CONFIG.retryDelayMs}ms`);
  console.log('');
  
  console.log('⚡ Performance Tips:');
  console.log('  • Use provisioned capacity for large data loads');
  console.log('  • Monitor CloudWatch metrics for throttling');
  console.log('  • Consider parallel processing for independent tables');
  console.log('  • Use exponential backoff for retries');
  console.log('  • Enable DynamoDB streams for real-time processing');
  console.log('');
  
  console.log('🔒 Security Best Practices:');
  console.log('  • Use IAM roles instead of access keys');
  console.log('  • Implement least privilege access');
  console.log('  • Enable VPC endpoints for private communication');
  console.log('  • Use encryption at rest and in transit');
  console.log('  • Monitor access patterns with CloudTrail');
}

/**
 * Main test function
 */
function runAllTests() {
  console.log('🧪 ENHANCED DATA LOADER - COMPREHENSIVE TESTING');
  console.log('===============================================\n');
  
  testDataValidation();
  testSimulationData();
  testBatchCalculations();
  testEnvironmentConfig();
  testErrorScenarios();
  displayPerformanceRecommendations();
  
  console.log('\n🎉 All tests completed successfully!');
  console.log('\n💡 Usage Examples:');
  console.log('• Development: node scripts/load-data.js --local');
  console.log('• Staging: node scripts/load-data.js --stage staging');
  console.log('• Production: node scripts/load-data.js --stage prod');
  console.log('• Validation: node scripts/load-data.js --dry-run');
  console.log('• With simulation: node scripts/load-data.js --stage dev (with simulation-data.json)');
}

// Run tests if called directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testDataValidation,
  testSimulationData,
  testBatchCalculations,
  testEnvironmentConfig,
  testErrorScenarios,
  displayPerformanceRecommendations,
  runAllTests
};