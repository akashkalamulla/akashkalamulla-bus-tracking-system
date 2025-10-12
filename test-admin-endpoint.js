#!/usr/bin/env node

const { getAllRoutes } = require('./src/handlers/admin/routes');

// Mock admin event
const mockAdminEvent = {
  requestContext: {
    authorizer: {
      userId: 'admin-001',
      role: 'NTC',
      email: 'admin@ntc.lk',
    },
  },
  headers: {
    'User-Agent': 'Test-Client/1.0',
  },
};

async function testAdminEndpoint() {
  console.log('🧪 Testing Admin Routes Handler locally...\n');

  try {
    console.log('Testing getAllRoutes function...');
    const result = await getAllRoutes(mockAdminEvent);
    console.log('✅ SUCCESS:', result.statusCode);
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAdminEndpoint();
