const response = require('../../src/utils/response');

describe('Response Utility', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('successResponse', () => {
        it('should return success response with data', () => {
            const data = { message: 'Success', data: { id: 1 } };

            const result = response.successResponse(data);

            expect(result.statusCode).toBe(200);
            expect(result.headers['Content-Type']).toBe('application/json');
            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(body.message).toBe('Success');
            expect(body.data).toEqual({ id: 1 });
        });

        it('should return success response with custom status code', () => {
            const data = { message: 'Created' };

            const result = response.successResponse(data, 201);

            expect(result.statusCode).toBe(201);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
        });
    });

    describe('errorResponse', () => {
        it('should return error response', () => {
            const statusCode = 400;
            const message = 'Bad Request';
            const errorData = { field: 'required' };

            const result = response.errorResponse(statusCode, message, errorData);

            expect(result.statusCode).toBe(400);
            expect(result.headers['Content-Type']).toBe('application/json');
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.message).toBe('Bad Request');
            expect(body.error).toEqual({ field: 'required' });
        });
    });
});

describe('Response Utility', () => {
    describe('successResponse', () => {
        it('should create successful response', () => {
            const data = { key: 'value' };
            const message = 'Success message';

            const result = response.successResponse(data, message);

            expect(result.statusCode).toBe(200);
            expect(result.headers['Content-Type']).toBe('application/json');

            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(body.data).toEqual(data);
            expect(body.message).toBe(message);
        });

        it('should handle response without message', () => {
            const data = { key: 'value' };

            const result = response.successResponse(data);

            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(body.data).toEqual(data);
        });
    });

    describe('errorResponse', () => {
        it('should create error response', () => {
            const statusCode = 400;
            const message = 'Error message';

            const result = response.errorResponse(statusCode, message);

            expect(result.statusCode).toBe(statusCode);
            expect(result.headers['Content-Type']).toBe('application/json');

            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe(message);
        });

        it('should include error details when provided', () => {
            const statusCode = 500;
            const message = 'Server error';
            const details = { code: 'INTERNAL_ERROR' };

            const result = response.errorResponse(statusCode, message, details);

            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe(message);
            expect(body.details).toEqual(details);
        });
    });
});