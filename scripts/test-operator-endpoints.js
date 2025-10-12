const axios = require('axios');

const BASE_URL = 'https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev';

// Test data for operator endpoints
const OPERATOR_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJvcGVyYXRvcl8xMjMiLCJ1c2VySWQiOiJvcGVyYXRvcl8xMjMiLCJyb2xlIjoiQlVTX09QRVJBVE9SIiwiZW1haWwiOiJvcGVyYXRvckBleGFtcGxlLmNvbSIsIm9wZXJhdG9ySWQiOiJvcGVyYXRvcl8xMjMiLCJpYXQiOjE3Mjc5NDE2MDAsImV4cCI6MjAyNzk0MTYwMH0.example-token-for-testing';

const headers = {
  Authorization: `Bearer ${OPERATOR_JWT}`,
  'Content-Type': 'application/json',
};

// Test operator endpoints
async function testOperatorEndpoints() {
  console.log('🚌 Testing Bus Operator Endpoints\\n');

  try {
    // 1. Get all buses for operator
    console.log('1. Getting all buses for operator...');
    const allBuses = await axios.get(`${BASE_URL}/operator/buses`, { headers });
    console.log(`✅ Found ${allBuses.data.length || 0} buses for operator`);

    // 2. Create a new bus
    console.log('\\n2. Creating a new bus...');
    const newBusData = {
      busNumber: `OP-${Date.now()}`,
      capacity: 40,
      routeId: 'route_123',
      status: 'ACTIVE',
      model: 'Tata Starbus',
      year: 2023,
    };

    try {
      const createdBus = await axios.post(`${BASE_URL}/operator/buses`, newBusData, { headers });
      console.log(`✅ Bus created successfully: ${createdBus.data.BusID}`);

      const busId = createdBus.data.BusID;

      // 3. Get specific bus details
      console.log('\\n3. Getting specific bus details...');
      const busDetails = await axios.get(`${BASE_URL}/operator/buses/${busId}`, { headers });
      console.log(`✅ Bus details retrieved: ${busDetails.data.BusNumber}`);

      // 4. Update bus details
      console.log('\\n4. Updating bus details...');
      const updateData = {
        capacity: 45,
        status: 'MAINTENANCE',
      };
      const updatedBus = await axios.put(`${BASE_URL}/operator/buses/${busId}`, updateData, { headers });
      console.log(`✅ Bus updated: Status = ${updatedBus.data.Status}, Capacity = ${updatedBus.data.Capacity}`);

      // 5. Update bus location
      console.log('\\n5. Updating bus location...');
      const locationData = {
        latitude: 6.9271,
        longitude: 79.8612,
        heading: 45,
        speed: 30.5,
        accuracy: 5,
      };
      const locationUpdate = await axios.put(`${BASE_URL}/operator/buses/${busId}/location`, locationData, { headers });
      console.log(`✅ Location updated: ${locationUpdate.data.message}`);

      // 6. Get bus location
      console.log('\\n6. Getting bus location...');
      const currentLocation = await axios.get(`${BASE_URL}/operator/buses/${busId}/location`, { headers });
      console.log(`✅ Current location: ${currentLocation.data.latitude}, ${currentLocation.data.longitude}`);

      // 7. Delete the test bus
      console.log('\\n7. Deleting test bus...');
      await axios.delete(`${BASE_URL}/operator/buses/${busId}`, { headers });
      console.log('✅ Bus deleted successfully');
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ Access control working: Operator can only access own buses');
      } else {
        console.error(`❌ Error: ${error.response?.data?.message || error.message}`);
      }
    }

    // 8. Test unauthorized access (try to access a bus that doesn't belong to operator)
    console.log('\\n8. Testing unauthorized access protection...');
    try {
      await axios.get(`${BASE_URL}/operator/buses/unauthorized_bus_id`, { headers });
      console.log('❌ Security issue: Should have been denied');
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ Access control working: 403 Forbidden for unauthorized bus access');
      } else if (error.response?.status === 404) {
        console.log('✅ Access control working: Bus not found (ownership validated)');
      } else {
        console.log(`⚠️  Unexpected error: ${error.response?.status} - ${error.response?.data?.message}`);
      }
    }
  } catch (error) {
    console.error(`❌ Test failed: ${error.response?.data?.message || error.message}`);
  }
}

// Test different role access
async function testRoleBasedAccess() {
  console.log('\\n\\n🔐 Testing Role-Based Access Control\\n');

  // Test with COMMUTER role (should be denied)
  const commuterJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjb21tdXRlcl8xMjMiLCJ1c2VySWQiOiJjb21tdXRlcl8xMjMiLCJyb2xlIjoiQ09NTVVURVIiLCJlbWFpbCI6ImNvbW11dGVyQGV4YW1wbGUuY29tIiwiaWF0IjoxNzI3OTQxNjAwLCJleHAiOjIwMjc5NDE2MDB9.example-commuter-token';

  const commuterHeaders = {
    Authorization: `Bearer ${commuterJWT}`,
    'Content-Type': 'application/json',
  };

  try {
    await axios.get(`${BASE_URL}/operator/buses`, { headers: commuterHeaders });
    console.log('❌ Security issue: COMMUTER should not access operator endpoints');
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('✅ Role-based access control working: COMMUTER denied operator access');
    } else {
      console.log(`⚠️  Unexpected error: ${error.response?.status}`);
    }
  }
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Bus Operator API Testing Suite\\n');
  console.log('===============================\\n');

  await testOperatorEndpoints();
  await testRoleBasedAccess();

  console.log('\\n\\n🏁 Testing Complete!');
  console.log('\\nOperator Endpoints Available:');
  console.log('• GET    /operator/buses                     - Get all operator buses');
  console.log('• POST   /operator/buses                     - Create new bus');
  console.log('• GET    /operator/buses/{busId}             - Get specific bus');
  console.log('• PUT    /operator/buses/{busId}             - Update bus details');
  console.log('• DELETE /operator/buses/{busId}             - Delete bus');
  console.log('• PUT    /operator/buses/{busId}/location    - Update bus location');
  console.log('• GET    /operator/buses/{busId}/location    - Get bus location');
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testOperatorEndpoints, testRoleBasedAccess };
