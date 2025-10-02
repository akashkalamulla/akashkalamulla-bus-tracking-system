/**
 * Enhanced Data Loading Script for Bus Tracking System
 * 
 * This script loads generated data into DynamoDB tables with:
 * - AWS SDK v3 support
 * - Enhanced error handling and retry logic
 * - Progress reporting and performance metrics
 * - Environment variable configuration
 * - Batch writing optimization
 * 
 * Usage: 
 * - Local: node scripts/load-data.js --local
 * - AWS: node scripts/load-data.js --stage dev|staging|prod
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  BatchWriteCommand
} = require('@aws-sdk/lib-dynamodb');
const fs = require('fs');
const path = require('path');

// Enhanced Configuration
const CONFIG = {
  dataDir: 'data',
  batchSize: 25, // DynamoDB batch write limit
  maxRetries: 3,
  retryDelayMs: 1000,
  progressInterval: 5, // Show progress every N batches
  region: process.env.AWS_REGION || 'ap-south-1',
  
  // Data file mappings
  dataFiles: {
    routes: 'routes.json',
    buses: 'buses.json',
    schedules: 'schedules.json',
    liveLocations: 'live-locations.json',
    simulationData: 'simulation-data.json'
  }
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Initialize DynamoDB client with enhanced configuration
 */
function initializeDynamoDB(isLocal = false) {
  const clientConfig = {
    region: CONFIG.region,
    maxAttempts: CONFIG.maxRetries
  };
  
  if (isLocal) {
    clientConfig.endpoint = 'http://localhost:8000';
    clientConfig.credentials = {
      accessKeyId: 'fake',
      secretAccessKey: 'fake'
    };
    console.log('🔧 Using local DynamoDB endpoint');
  } else {
    console.log(`🌐 Using AWS DynamoDB in region: ${CONFIG.region}`);
  }
  
  const client = new DynamoDBClient(clientConfig);
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: true
    }
  });
}

/**
 * Get table names from environment variables or construct them
 */
function getTableNames(stage = 'dev', isLocal = false) {
  // Try to get from environment variables first
  const envTables = {
    routes: process.env.ROUTES_TABLE,
    buses: process.env.BUSES_TABLE,
    liveLocations: process.env.LIVE_LOCATIONS_TABLE,
    schedules: process.env.SCHEDULES_TABLE
  };
  
  // If environment variables are set, use them
  if (envTables.routes && envTables.buses && envTables.liveLocations) {
    console.log('📋 Using table names from environment variables');
    return envTables;
  }
  
  // Fallback to constructed names
  console.log('📋 Constructing table names from stage');
  const prefix = `bus-tracking-system-${stage}`;
  return {
    routes: `${prefix}-routes`,
    buses: `${prefix}-buses`,
    liveLocations: `${prefix}-live-locations`,
    schedules: `${prefix}-schedules`
  };
}

/**
 * Load JSON data from file with error handling
 */
function loadJsonData(filename) {
  const filePath = path.join(CONFIG.dataDir, filename);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Data file not found: ${filePath}`);
  }
  
  console.log(`📖 Reading data from ${filePath}`);
  const data = fs.readFileSync(filePath, 'utf8');
  const parsedData = JSON.parse(data);
  console.log(`✅ Loaded ${parsedData.length} records from ${filename}`);
  return parsedData;
}

/**
 * Enhanced batch write with retry logic and progress reporting
 */
async function batchWriteItems(docClient, tableName, items, dataType = 'items') {
  if (!items || items.length === 0) {
    console.log(`⚠️  No ${dataType} to write to ${tableName}`);
    return;
  }
  
  const batches = [];
  const startTime = Date.now();
  
  // Split items into batches of 25 (DynamoDB limit)
  for (let i = 0; i < items.length; i += CONFIG.batchSize) {
    batches.push(items.slice(i, i + CONFIG.batchSize));
  }
  
  console.log(`📦 Writing ${items.length} ${dataType} in ${batches.length} batches to ${tableName}...`);
  
  let successfulBatches = 0;
  let totalItemsWritten = 0;
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    let retryCount = 0;
    let success = false;
    
    while (retryCount < CONFIG.maxRetries && !success) {
      try {
        const requestItems = {
          [tableName]: batch.map(item => ({
            PutRequest: {
              Item: item
            }
          }))
        };
        
        const command = new BatchWriteCommand({
          RequestItems: requestItems
        });
        
        const result = await docClient.send(command);
        
        // Handle unprocessed items
        if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
          const unprocessedCount = result.UnprocessedItems[tableName]?.length || 0;
          console.log(`⚠️  Batch ${i + 1}: ${unprocessedCount} unprocessed items, retrying...`);
          
          if (unprocessedCount > 0) {
            // Retry unprocessed items after a delay
            await sleep(CONFIG.retryDelayMs * (retryCount + 1));
            retryCount++;
            continue;
          }
        }
        
        success = true;
        successfulBatches++;
        totalItemsWritten += batch.length;
        
        // Progress reporting
        if ((i + 1) % CONFIG.progressInterval === 0 || i === batches.length - 1) {
          const progress = ((i + 1) / batches.length * 100).toFixed(1);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`  📊 Progress: ${i + 1}/${batches.length} batches (${progress}%) - ${totalItemsWritten} items written - ${elapsed}s elapsed`);
        }
        
        // Small delay to avoid throttling
        if (i < batches.length - 1) {
          await sleep(100);
        }
        
      } catch (error) {
        retryCount++;
        const isLastAttempt = retryCount >= CONFIG.maxRetries;
        
        console.error(`❌ Batch ${i + 1} attempt ${retryCount} failed: ${error.message}`);
        
        if (isLastAttempt) {
          console.error(`💥 Batch ${i + 1} failed permanently after ${CONFIG.maxRetries} attempts`);
          throw new Error(`Failed to write batch ${i + 1} to ${tableName}: ${error.message}`);
        } else {
          const delay = CONFIG.retryDelayMs * Math.pow(2, retryCount - 1); // Exponential backoff
          console.log(`🔄 Retrying batch ${i + 1} in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const itemsPerSecond = (totalItemsWritten / (totalTime)).toFixed(1);
  
  console.log(`✅ Successfully wrote ${totalItemsWritten}/${items.length} ${dataType} to ${tableName}`);
  console.log(`⏱️  Total time: ${totalTime}s (${itemsPerSecond} items/sec)`);
  
  if (successfulBatches < batches.length) {
    console.warn(`⚠️  Warning: Only ${successfulBatches}/${batches.length} batches completed successfully`);
  }
}

/**
 * Load simulation data if available
 */
async function loadSimulationData(docClient, tableNames) {
  try {
    const simulationData = loadJsonData(CONFIG.dataFiles.simulationData);
    
    if (simulationData.routes) {
      console.log('\n📍 Loading simulation routes data...');
      await batchWriteItems(docClient, tableNames.routes, simulationData.routes, 'routes');
    }
    
    if (simulationData.buses) {
      console.log('\n🚐 Loading simulation buses data...');
      await batchWriteItems(docClient, tableNames.buses, simulationData.buses, 'buses');
    }
    
    if (simulationData.schedules) {
      console.log('\n📅 Loading simulation schedules data...');
      await batchWriteItems(docClient, tableNames.schedules, simulationData.schedules, 'schedules');
    }
    
    if (simulationData.liveLocations) {
      console.log('\n📍 Loading simulation live locations data...');
      await batchWriteItems(docClient, tableNames.liveLocations, simulationData.liveLocations, 'live locations');
    }
    
    return true;
  } catch (error) {
    if (error.message.includes('not found')) {
      console.log('ℹ️  simulation-data.json not found, loading individual files...');
      return false;
    }
    throw error;
  }
}

/**
 * Load individual data files
 */
async function loadIndividualFiles(docClient, tableNames) {
  // Load routes data
  try {
    console.log('\n� Loading routes data...');
    const routes = loadJsonData(CONFIG.dataFiles.routes);
    await batchWriteItems(docClient, tableNames.routes, routes, 'routes');
  } catch (error) {
    console.error(`❌ Failed to load routes: ${error.message}`);
  }
  
  // Load buses data
  try {
    console.log('\n🚐 Loading buses data...');
    const buses = loadJsonData(CONFIG.dataFiles.buses);
    await batchWriteItems(docClient, tableNames.buses, buses, 'buses');
  } catch (error) {
    console.error(`❌ Failed to load buses: ${error.message}`);
  }
  
  // Load schedules data (if available)
  try {
    console.log('\n📅 Loading schedules data...');
    const schedules = loadJsonData(CONFIG.dataFiles.schedules);
    if (tableNames.schedules) {
      await batchWriteItems(docClient, tableNames.schedules, schedules, 'schedules');
    }
  } catch (error) {
    console.log(`ℹ️  Schedules data not loaded: ${error.message}`);
  }
  
  // Load live locations data
  try {
    console.log('\n📍 Loading live locations data...');
    const liveLocations = loadJsonData(CONFIG.dataFiles.liveLocations);
    await batchWriteItems(docClient, tableNames.liveLocations, liveLocations, 'live locations');
  } catch (error) {
    console.error(`❌ Failed to load live locations: ${error.message}`);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const isLocal = args.includes('--local');
  const isDryRun = args.includes('--dry-run');
  
  let stage = 'dev';
  const stageIndex = args.findIndex(arg => arg === '--stage');
  if (stageIndex !== -1 && args[stageIndex + 1]) {
    stage = args[stageIndex + 1];
  }
  
  return { isLocal, stage, isDryRun };
}

/**
 * Display environment information
 */
function displayEnvironmentInfo(isLocal, stage, tableNames) {
  console.log('🌟 ENVIRONMENT CONFIGURATION');
  console.log('============================');
  console.log(`Environment: ${isLocal ? 'Local DynamoDB' : `AWS (${stage})`}`);
  console.log(`Region: ${CONFIG.region}`);
  console.log(`Batch Size: ${CONFIG.batchSize} items`);
  console.log(`Max Retries: ${CONFIG.maxRetries}`);
  console.log(`Retry Delay: ${CONFIG.retryDelayMs}ms`);
  console.log('');
  console.log('📋 Table Configuration:');
  Object.entries(tableNames).forEach(([key, tableName]) => {
    if (tableName) {
      console.log(`  ${key}: ${tableName}`);
    }
  });
  console.log('');
}

/**
 * Main function with comprehensive error handling
 */
async function main() {
  console.log('🚌 ENHANCED BUS TRACKING DATA LOADER');
  console.log('====================================\n');
  
  const startTime = Date.now();
  
  try {
    const { isLocal, stage, isDryRun } = parseArgs();
    
    // Initialize DynamoDB client
    const docClient = initializeDynamoDB(isLocal);
    const tableNames = getTableNames(stage, isLocal);
    
    // Display configuration
    displayEnvironmentInfo(isLocal, stage, tableNames);
    
    if (isDryRun) {
      console.log('🧪 DRY RUN MODE - No data will be written');
      console.log('Configuration verified successfully');
      return;
    }
    
    // Try to load simulation data first, fallback to individual files
    const simulationLoaded = await loadSimulationData(docClient, tableNames);
    
    if (!simulationLoaded) {
      await loadIndividualFiles(docClient, tableNames);
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Data loading completed successfully in ${totalTime}s!`);
    
  } catch (error) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\n❌ Data loading failed after ${totalTime}s:`, error.message);
    console.error('\n🔍 Troubleshooting checklist:');
    console.error('1. ✓ Data files exist (run generate-data.js first)');
    console.error('2. ✓ DynamoDB tables are created (check serverless.yml)');
    console.error('3. ✓ AWS credentials are configured (for non-local)');
    console.error('4. ✓ Local DynamoDB is running (for --local flag)');
    console.error('5. ✓ Network connectivity to AWS (for cloud deployment)');
    console.error('6. ✓ IAM permissions for DynamoDB operations');
    
    console.error('\n💡 Quick fixes:');
    console.error('• Local testing: npm run dynamodb:start && node scripts/load-data.js --local');
    console.error('• AWS deployment: aws configure && node scripts/load-data.js --stage dev');
    console.error('• Dry run test: node scripts/load-data.js --dry-run');
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  initializeDynamoDB,
  getTableNames,
  loadJsonData,
  batchWriteItems,
  loadSimulationData,
  loadIndividualFiles,
  CONFIG
};