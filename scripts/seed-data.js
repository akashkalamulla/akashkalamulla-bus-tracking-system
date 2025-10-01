/**
 * Seed data script for local development
 * This script populates the local DynamoDB tables with sample data
 */

const AWS = require('aws-sdk');

// Configure AWS for local DynamoDB
const dynamoDbConfig = {
    region: 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
};

const dynamoDB = new AWS.DynamoDB.DocumentClient(dynamoDbConfig);

// Sample data
const sampleRoutes = [{
        RouteID: 'route-001',
        name: 'Downtown Express',
        description: 'Express service to downtown area',
        stops: [
            { id: 'stop-001', name: 'Central Station', coordinates: [40.7128, -74.0060] },
            { id: 'stop-002', name: 'Business District', coordinates: [40.7589, -73.9851] },
            { id: 'stop-003', name: 'Shopping Center', coordinates: [40.7505, -73.9934] }
        ],
        schedule: {
            weekdays: '06:00-22:00',
            weekends: '08:00-20:00'
        },
        frequency: '15 minutes',
        active: true,
        createdAt: new Date().toISOString()
    },
    {
        RouteID: 'route-002',
        name: 'Airport Shuttle',
        description: 'Direct service to airport',
        stops: [
            { id: 'stop-004', name: 'Central Station', coordinates: [40.7128, -74.0060] },
            { id: 'stop-005', name: 'Airport Terminal', coordinates: [40.6413, -73.7781] }
        ],
        schedule: {
            weekdays: '05:00-23:30',
            weekends: '06:00-23:00'
        },
        frequency: '30 minutes',
        active: true,
        createdAt: new Date().toISOString()
    }
];

const sampleBuses = [{
        BusID: 'bus-001',
        route_id: 'route-001',
        vehicle_number: 'BT-101',
        capacity: 45,
        type: 'standard',
        driver: {
            id: 'driver-001',
            name: 'John Smith',
            license: 'CDL-12345'
        },
        status: 'active',
        createdAt: new Date().toISOString()
    },
    {
        BusID: 'bus-002',
        route_id: 'route-001',
        vehicle_number: 'BT-102',
        capacity: 45,
        type: 'standard',
        driver: {
            id: 'driver-002',
            name: 'Jane Doe',
            license: 'CDL-67890'
        },
        status: 'active',
        createdAt: new Date().toISOString()
    },
    {
        BusID: 'bus-003',
        route_id: 'route-002',
        vehicle_number: 'BT-201',
        capacity: 55,
        type: 'express',
        driver: {
            id: 'driver-003',
            name: 'Mike Johnson',
            license: 'CDL-54321'
        },
        status: 'active',
        createdAt: new Date().toISOString()
    }
];

const sampleLocations = [{
        BusID: 'bus-001',
        timestamp: new Date().toISOString(),
        route_id: 'route-001',
        latitude: 40.7128,
        longitude: -74.0060,
        speed: 25,
        heading: 90,
        next_stop: 'stop-002',
        ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours TTL
    },
    {
        BusID: 'bus-002',
        timestamp: new Date().toISOString(),
        route_id: 'route-001',
        latitude: 40.7589,
        longitude: -73.9851,
        speed: 0,
        heading: 0,
        next_stop: 'stop-003',
        ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours TTL
    },
    {
        BusID: 'bus-003',
        timestamp: new Date().toISOString(),
        route_id: 'route-002',
        latitude: 40.7128,
        longitude: -74.0060,
        speed: 45,
        heading: 45,
        next_stop: 'stop-005',
        ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours TTL
    }
];

/**
 * Seed a table with sample data
 * @param {string} tableName - Name of the table
 * @param {Array} items - Array of items to insert
 */
async function seedTable(tableName, items) {
    console.log(`Seeding ${tableName} with ${items.length} items...`);

    try {
        for (const item of items) {
            await dynamoDB.put({
                TableName: tableName,
                Item: item
            }).promise();

            console.log(`✓ Added item: ${JSON.stringify(item, null, 2)}`);
        }

        console.log(`✅ Successfully seeded ${tableName}\n`);
    } catch (error) {
        console.error(`❌ Error seeding ${tableName}:`, error);
        throw error;
    }
}

/**
 * Main seeding function
 */
async function seedData() {
    try {
        console.log('🌱 Starting data seeding...\n');

        // Get table names from environment or use defaults
        const ROUTES_TABLE = process.env.ROUTES_TABLE || 'bus-tracking-system-dev-routes';
        const BUSES_TABLE = process.env.BUSES_TABLE || 'bus-tracking-system-dev-buses';
        const LOCATIONS_TABLE = process.env.LOCATIONS_TABLE || 'bus-tracking-system-dev-locations';

        // Seed all tables
        await seedTable(ROUTES_TABLE, sampleRoutes);
        await seedTable(BUSES_TABLE, sampleBuses);
        await seedTable(LOCATIONS_TABLE, sampleLocations);

        console.log('🎉 Data seeding completed successfully!');

    } catch (error) {
        console.error('💥 Data seeding failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    seedData();
}

module.exports = { seedData, seedTable };