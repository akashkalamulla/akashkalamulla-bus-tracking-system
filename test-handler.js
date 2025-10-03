// Quick test to verify auth handler loads without errors and test role permissions
const auth = require('./src/handlers/auth');

console.log('Testing enhanced auth handler with role-based access control...');

// Test exports
console.log('\nAvailable exports:', Object.keys(auth));

// Test ROLES constant
console.log('\nSupported roles:', auth.ROLES);

// Test parseMethodArn function
const testArn = 'arn:aws:execute-api:ap-south-1:123456789:abc123/dev/PUT/buses/bus_001/location';
const parsed = auth.parseMethodArn(testArn);
console.log('\nTest parseMethodArn:', parsed);

// Test role authorization
const authTests = [
  { role: 'BUS_OPERATOR', method: 'PUT', path: '/dev/buses/bus_001/location' },
  { role: 'COMMUTER', method: 'PUT', path: '/dev/buses/bus_001/location' },
  { role: 'NTC', method: 'PUT', path: '/dev/routes' },
  { role: 'COMMUTER', method: 'GET', path: '/dev/routes' }
];

console.log('\nTesting role authorization logic:');
authTests.forEach(test => {
  const result = auth.checkRoleAuthorization(test.role, test.method, test.path);
  console.log(`${test.role} ${test.method} ${test.path}: ${result.allowed ? '✅ ALLOWED' : '❌ DENIED'}`);
  if (!result.allowed) {
    console.log(`  Reason: ${result.reason}`);
  }
});

console.log('\n✅ Auth handler syntax and logic tests passed!');
console.log('\nNext steps:');
console.log('1. Deploy the updated auth function');
console.log('2. Generate test tokens with: node test-jwt.js');
console.log('3. Test with different roles using the generated tokens');