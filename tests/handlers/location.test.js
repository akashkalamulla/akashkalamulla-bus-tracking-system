const { updateLocation } = require('../../src/handlers/location');

describe('Location Handler', () => {
  describe('updateLocation', () => {
    it('should update location successfully with valid data', async () => {
      const event = {
        pathParameters: {
          busId: 'bus-001',
        },
        body: JSON.stringify({
          latitude: 40.7128,
          longitude: -74.0060,
          timestamp: '2025-10-01T10:00:00.000Z',
          speed: 25,
          heading: 90,
        }),
      };

      const result = await updateLocation(event);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.busId).toBe('bus-001');
      expect(body.data.location.latitude).toBe(40.7128);
      expect(body.data.location.longitude).toBe(-74.0060);
    });

    it('should return error when bus ID is missing', async () => {
      const event = {
        pathParameters: {},
        body: JSON.stringify({
          latitude: 40.7128,
          longitude: -74.0060,
        }),
      };

      const result = await updateLocation(event);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Bus ID is required');
    });

    it('should return error when latitude is missing', async () => {
      const event = {
        pathParameters: {
          busId: 'bus-001',
        },
        body: JSON.stringify({
          longitude: -74.0060,
        }),
      };

      const result = await updateLocation(event);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('latitude');
    });

    it('should return error when coordinates are invalid', async () => {
      const event = {
        pathParameters: {
          busId: 'bus-001',
        },
        body: JSON.stringify({
          latitude: 95, // Invalid latitude > 90
          longitude: -74.0060,
        }),
      };

      const result = await updateLocation(event);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Latitude must be between -90 and 90');
    });

    it('should handle invalid JSON in request body', async () => {
      const event = {
        pathParameters: {
          busId: 'bus-001',
        },
        body: 'invalid json',
      };

      const result = await updateLocation(event);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Invalid JSON format in request body');
    });
  });
});
