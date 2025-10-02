// Jest setup file

// Mock the DynamoDB service module for AWS SDK v3
jest.mock('../src/services/dynamodb', () => ({
    putItem: jest.fn().mockResolvedValue({}),
    getItem: jest.fn().mockResolvedValue({
        RouteID: 'route-001',
        RouteName: 'Main Street Route',
        Description: 'Test route description',
    }),
    scanTable: jest.fn().mockResolvedValue([
        { RouteID: 'route-001', RouteName: 'Main Street Route' },
        { RouteID: 'route-002', RouteName: 'Downtown Route' },
    ]),
    queryTable: jest.fn().mockResolvedValue([]),
    updateItem: jest.fn().mockResolvedValue({}),
    deleteItem: jest.fn().mockResolvedValue({}),
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.ROUTES_TABLE = 'test-routes-table';
process.env.BUSES_TABLE = 'test-buses-table';
process.env.LOCATIONS_TABLE = 'test-locations-table';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';