const jwt = require('jsonwebtoken');

// Test JWT token generation for role-based testing
const JWT_SECRET = 'dev-secret-key-change-in-production';

// Available roles in the system
const ROLES = {
  NTC: 'NTC',                    // National Transport Commission - highest authority
  BUS_OPERATOR: 'BUS_OPERATOR', // Bus operators/drivers - can update locations
  COMMUTER: 'COMMUTER'           // Regular commuters - read-only access
};

// Generate test JWT tokens for different roles
function generateTestTokens() {
  const baseTime = Math.floor(Date.now() / 1000);
  const expirationTime = baseTime + (60 * 60); // 1 hour

  const tokens = {};

  // Generate token for each role
  Object.entries(ROLES).forEach(([roleName, roleValue]) => {
    const payload = {
      sub: `test-user-${roleName.toLowerCase()}`,
      userId: `user-${roleName.toLowerCase()}-123`,
      email: `${roleName.toLowerCase()}@bustrack.lk`,
      role: roleValue,
      name: `Test ${roleName} User`,
      iat: baseTime,
      exp: expirationTime,
      iss: 'bus-tracking-system',
      aud: 'bus-tracking-api'
    };

    const token = jwt.sign(payload, JWT_SECRET);
    tokens[roleName] = {
      role: roleValue,
      token: `Bearer ${token}`,
      payload: payload,
      rawToken: token
    };
  });

  return tokens;
}

// Generate and display tokens
console.log('='.repeat(80));
console.log('ROLE-BASED JWT TEST TOKENS');
console.log('='.repeat(80));

const testTokens = generateTestTokens();

Object.entries(testTokens).forEach(([roleName, tokenData]) => {
  console.log(`\n${roleName} (${tokenData.role}):`);
  console.log('-'.repeat(40));
  console.log('Authorization Header:');
  console.log(tokenData.token);
  console.log('\nUser Info:');
  console.log(`- User ID: ${tokenData.payload.sub}`);
  console.log(`- Email: ${tokenData.payload.email}`);
  console.log(`- Role: ${tokenData.payload.role}`);
  console.log(`- Expires: ${new Date(tokenData.payload.exp * 1000).toISOString()}`);
});

console.log('\n' + '='.repeat(80));
console.log('ROLE PERMISSIONS SUMMARY');
console.log('='.repeat(80));

console.log('\nNTC (National Transport Commission):');
console.log('- Can access ALL endpoints');
console.log('- Can create/update/delete routes');
console.log('- Can update bus locations');
console.log('- Full administrative access');

console.log('\nBUS_OPERATOR (Bus Operators/Drivers):');
console.log('- Can update bus locations (PUT /buses/{busId}/location)');
console.log('- Can read bus locations and routes');
console.log('- Cannot manage routes');

console.log('\nCOMMUTER (Regular Users):');
console.log('- Read-only access');
console.log('- Can view bus locations and routes');
console.log('- Cannot update anything');

console.log('\n' + '='.repeat(80));
console.log('QUICK TEST COMMANDS');
console.log('='.repeat(80));

const apiBase = 'https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev';

console.log('\n# Test BUS_OPERATOR updating location (should work):');
console.log(`Invoke-RestMethod -Uri "${apiBase}/buses/bus_001/location" -Method PUT \\`);
console.log(`  -Headers @{'Authorization'='${testTokens.BUS_OPERATOR.token}'; 'Content-Type'='application/json'} \\`);
console.log(`  -Body '{"latitude":6.9271,"longitude":79.8612,"speed":25}'`);

console.log('\n# Test COMMUTER updating location (should fail with 403):');
console.log(`Invoke-RestMethod -Uri "${apiBase}/buses/bus_001/location" -Method PUT \\`);
console.log(`  -Headers @{'Authorization'='${testTokens.COMMUTER.token}'; 'Content-Type'='application/json'} \\`);
console.log(`  -Body '{"latitude":6.9271,"longitude":79.8612,"speed":25}'`);

console.log('\n# Test COMMUTER reading location (should work):');
console.log(`Invoke-RestMethod -Uri "${apiBase}/buses/bus_001/location" -Method GET \\`);
console.log(`  -Headers @{'Authorization'='${testTokens.COMMUTER.token}'}`);

console.log('\n# Test without token (should fail with 401):');
console.log(`Invoke-RestMethod -Uri "${apiBase}/buses/bus_001/location" -Method PUT`);

// Verify tokens work
console.log('\n' + '='.repeat(80));
console.log('TOKEN VERIFICATION TEST');
console.log('='.repeat(80));

Object.entries(testTokens).forEach(([roleName, tokenData]) => {
  try {
    const decoded = jwt.verify(tokenData.rawToken, JWT_SECRET);
    console.log(`✅ ${roleName} token verified successfully`);
  } catch (error) {
    console.log(`❌ ${roleName} token verification failed: ${error.message}`);
  }
});

console.log('\nAll tokens generated and verified! 🎉');
console.log('Copy the Authorization headers above to test different role permissions.');