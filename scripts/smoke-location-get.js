const { getLocation } = require('../src/handlers/location');

async function run() {
  const mockEvent = { pathParameters: { busId: 'bus_001' } };
  try {
    const res = await getLocation(mockEvent);
    console.log('Handler returned:', res);
  } catch (err) {
    console.error('Handler threw:', err);
  }
}

run();