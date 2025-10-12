/**
 * Script to load schedule data into DynamoDB for the bus tracking system
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  region: 'ap-south-1',
  schedulesTable: 'bus-tracking-system-dev-schedules',
  batchSize: 25
};

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: config.region });
const docClient = DynamoDBDocumentClient.from(client);

async function loadScheduleData() {
  try {
    console.log('📅 Loading Bus Schedule Data to DynamoDB');
    console.log('========================================\n');
    
    // Read schedules data
    const schedulesPath = path.join(__dirname, '..', 'data', 'schedules.json');
    console.log(`📖 Reading schedules from: ${schedulesPath}`);
    
    if (!fs.existsSync(schedulesPath)) {
      throw new Error(`Schedules file not found: ${schedulesPath}`);
    }
    
    const schedulesData = JSON.parse(fs.readFileSync(schedulesPath, 'utf8'));
    console.log(`✅ Loaded ${schedulesData.length} schedule records\n`);
    
    // Process in batches
    const batches = [];
    for (let i = 0; i < schedulesData.length; i += config.batchSize) {
      batches.push(schedulesData.slice(i, i + config.batchSize));
    }
    
    console.log(`📦 Processing ${batches.length} batches of ${config.batchSize} items each`);
    
    let totalProcessed = 0;
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      // Prepare batch write request
      const putRequests = batch.map(schedule => ({
        PutRequest: {
          Item: schedule
        }
      }));
      
      const params = {
        RequestItems: {
          [config.schedulesTable]: putRequests
        }
      };
      
      // Execute batch write
      const command = new BatchWriteCommand(params);
      await docClient.send(command);
      
      totalProcessed += batch.length;
      const percentage = ((batchIndex + 1) / batches.length * 100).toFixed(1);
      
      console.log(`  ✅ Batch ${batchIndex + 1}/${batches.length} (${percentage}%) - ${totalProcessed}/${schedulesData.length} schedules loaded`);
      
      // Small delay to avoid throttling
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n🎉 Successfully loaded ${totalProcessed} schedules to ${config.schedulesTable}`);
    console.log('\n📊 Schedule Data Summary:');
    
    // Show some statistics
    const routes = [...new Set(schedulesData.map(s => s.route_id))];
    const dates = [...new Set(schedulesData.map(s => s.schedule_date))];
    const buses = [...new Set(schedulesData.map(s => s.BusID))];
    
    console.log(`  • Routes covered: ${routes.length} (${routes.slice(0, 5).join(', ')}...)`);
    console.log(`  • Date range: ${dates.length} dates (${Math.min(...dates)} to ${Math.max(...dates)})`);
    console.log(`  • Buses scheduled: ${buses.length}`);
    console.log(`  • Total trips: ${schedulesData.length}`);
    
  } catch (error) {
    console.error('❌ Failed to load schedule data:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  loadScheduleData();
}

module.exports = { loadScheduleData };