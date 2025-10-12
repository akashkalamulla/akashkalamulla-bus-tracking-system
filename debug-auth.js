const jwt = require('jsonwebtoken');

// Test the JWT token to see what's in it
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwOTk4Zjk4Ni1hNWJkLTQwZDYtODU4OC1hMzExYzhhMzk3MTIiLCJ1c2VybmFtZSI6ImFkbWluX3Rlc3QiLCJyb2xlIjoiTlRDIiwibmFtZSI6IlRlc3QgQWRtaW5pc3RyYXRvciIsImlhdCI6MTc2MDIwMzI5NCwiZXhwIjoxNzYwMjg5Njk0fQ.sHwSRPrJoQZ8Ytv1wkpdCZC1Hk1Fd9lqLMl9uFtWRIE';
const secret = 'dev-secret-key-change-in-production'; // Default secret

console.log('Testing JWT token...');

try {
  const decoded = jwt.verify(token, secret);
  console.log('✅ Token is valid!');
  console.log('Decoded payload:', JSON.stringify(decoded, null, 2));

  // Test the path pattern matching
  const pathPattern = /^/[^/]+/admin/routes$/;
  const testPath = '/dev/admin/routes';

  console.log('\nTesting path pattern...');
  console.log('Pattern:', pathPattern);
  console.log('Test path:', testPath);
  console.log('Matches:', pathPattern.test(testPath));
} catch (error) {
  console.log('❌ Token verification failed:', error.message);
}
