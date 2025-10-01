const { getRoutes, getRoute } = require('../../src/handlers/routes');

describe('Routes Handler', () => {
  describe('getRoutes', () => {
    it('should return all routes successfully', async () => {
      const event = {};

      const result = await getRoutes(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getRoute', () => {
    it('should return a specific route successfully', async () => {
      const event = {
        pathParameters: {
          routeId: 'route-001',
        },
      };

      const result = await getRoute(event);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('RouteID');
      expect(body.data.RouteID).toBe('route-001');
    });

    it('should return error when route ID is missing', async () => {
      const event = {
        pathParameters: {},
      };

      const result = await getRoute(event);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Route ID is required');
    });

    it('should handle missing pathParameters', async () => {
      const event = {};

      const result = await getRoute(event);

      expect(result.statusCode).toBe(400);
    });
  });
});
