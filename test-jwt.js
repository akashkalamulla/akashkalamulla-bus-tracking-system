const jwt = require('jsonwebtoken');

// Test JWT token generation for testing purposes
const JWT_SECRET = 'dev-secret-key-change-in-production';

// Generate a test JWT token
const testPayload = {
  sub: 'test-user-123',
  email: 'test@example.com',
  role: 'user',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
};

const testToken = jwt.sign(testPayload, JWT_SECRET);

console.log('Test JWT Token:');
console.log('Bearer ' + testToken);
console.log('\nToken Payload:', testPayload);

// Verify the token works
try {
  const decoded = jwt.verify(testToken, JWT_SECRET);
  console.log('\nToken verification successful:', decoded);
} catch (error) {
  console.error('Token verification failed:', error.message);
}