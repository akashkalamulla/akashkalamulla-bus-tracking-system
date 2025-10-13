const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient, ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

// Test the pagination fix locally
async function testScheduleScan() {
  const client = new DynamoDBClient({ region: 'ap-south-1' });
  const dynamodb = DynamoDBDocumentClient.from(client);
  
  const SCHEDULES_TABLE = 'bus-tracking-system-dev-schedules';
  
  console.log('🧪 Testing DynamoDB Schedule Scan Logic');
  console.log('==========================================');
  
  // Test 1: Original method (with limit)
  console.log('\n📊 Test 1: Scan with Limit=20');
  try {
    const limitedScanParams = {
      TableName: SCHEDULES_TABLE,
      Limit: 20,
    };
    
    const limitedResult = await dynamodb.send(new ScanCommand(limitedScanParams));
    console.log(`✅ Limited scan returned: ${limitedResult.Items?.length || 0} items`);
    console.log(`   Has more data: ${limitedResult.LastEvaluatedKey ? 'Yes' : 'No'}`);
  } catch (error) {
    console.log(`❌ Limited scan failed: ${error.message}`);
  }
  
  // Test 2: Complete scan (our fix)
  console.log('\n📊 Test 2: Complete Scan (All Items)');
  try {
    let allItems = [];
    let lastEvaluatedKey = null;
    let scanCount = 0;
    
    do {
      scanCount++;
      const scanParams = {
        TableName: SCHEDULES_TABLE,
      };
      
      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await dynamodb.send(new ScanCommand(scanParams));
      
      if (result.Items && result.Items.length > 0) {
        allItems = allItems.concat(result.Items);
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
      
      console.log(`   Scan ${scanCount}: ${result.Items?.length || 0} items (Total: ${allItems.length})`);
      
    } while (lastEvaluatedKey);
    
    console.log(`✅ Complete scan returned: ${allItems.length} total items`);
    console.log(`   Required ${scanCount} scan operations`);
    
    // Test pagination
    const limit = 20;
    const page = 1;
    const offset = (page - 1) * limit;
    
    const sortedSchedules = allItems.sort((a, b) => {
      const dateCompare = a.schedule_date.localeCompare(b.schedule_date);
      if (dateCompare !== 0) return dateCompare;
      return a.departure_time.localeCompare(b.departure_time);
    });
    
    const paginatedItems = sortedSchedules.slice(offset, offset + limit);
    const totalCount = sortedSchedules.length;
    const totalPages = Math.ceil(totalCount / limit);
    
    console.log(`\n📋 Pagination Results (Page 1):`);
    console.log(`   Items on page: ${paginatedItems.length}`);
    console.log(`   Total items: ${totalCount}`);
    console.log(`   Total pages: ${totalPages}`);
    console.log(`   Items per page: ${limit}`);
    
  } catch (error) {
    console.log(`❌ Complete scan failed: ${error.message}`);
  }
  
  console.log('\n🎉 Test completed!');
}

// Run the test
testScheduleScan().catch(console.error);