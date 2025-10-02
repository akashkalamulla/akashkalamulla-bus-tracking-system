const { ping } = require('../../src/handlers/health');

describe('Health Handler', () => {
    describe('ping', () => {
        it('should return successful health check', async() => {
            const event = {};

            const result = await ping(event);

            expect(result.statusCode).toBe(200);
            expect(result.headers['Content-Type']).toBe('application/json');

            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(body.message).toBe('Service is healthy');
            expect(body.data).toBeDefined();
            expect(body.data.timestamp).toBeDefined();
            expect(body.data.uptime).toBeDefined();
        });

        it('should handle different request methods', async() => {
            const event = {
                httpMethod: 'GET',
                requestContext: {
                    requestId: 'test-request-id',
                },
            };

            const result = await ping(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
        });
    });
});