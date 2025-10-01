// Jest setup file
const AWSMock = require('aws-sdk-mock');

// Mock AWS SDK before tests run
beforeAll(() => {
  // Mock DynamoDB
  AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
    callback(null, { Item: { id: 'test-id', name: 'test-item' } });
  });

  AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
    callback(null, {});
  });

  AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
    callback(null, { Items: [], Count: 0 });
  });

  AWSMock.mock('DynamoDB.DocumentClient', 'scan', (params, callback) => {
    callback(null, { Items: [], Count: 0 });
  });
});

// Restore AWS SDK after tests
afterAll(() => {
  AWSMock.restore();
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.ROUTES_TABLE = 'test-routes-table';
process.env.BUSES_TABLE = 'test-buses-table';
process.env.LOCATIONS_TABLE = 'test-locations-table';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
