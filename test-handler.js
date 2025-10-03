// Quick test to verify handlers load without errors
const location = require('./src/handlers/location');

console.log('Testing location handler import...');

// Mock event
const mockEvent = {
  pathParameters: { busId: 'bus_001' },
  headers: {},
  body: null
};

console.log('Location handler loaded successfully');
console.log('Available exports:', Object.keys(location));

// Test that functions are callable (won't actually run due to missing AWS resources)
console.log('getLocation function type:', typeof location.getLocation);
console.log('updateLocation function type:', typeof location.updateLocation);

console.log('✅ Handler syntax check passed');