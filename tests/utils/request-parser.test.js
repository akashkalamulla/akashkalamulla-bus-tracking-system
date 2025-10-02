const { parseRequestBody, validateRequiredFields, parseAndValidateBody } = require('../../src/utils/request-parser');
const { HTTP_STATUS } = require('../../src/config/constants');

describe('Request Parser Utility', () => {
  describe('parseRequestBody', () => {
    it('should parse valid JSON string body', () => {
      const event = {
        body: '{"latitude": 40.7128, "longitude": -74.0060}',
      };

      const result = parseRequestBody(event);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        latitude: 40.7128,
        longitude: -74.0060,
      });
    });

    it('should handle body that is already an object', () => {
      const event = {
        body: {
          latitude: 40.7128,
          longitude: -74.0060,
        },
      };

      const result = parseRequestBody(event);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        latitude: 40.7128,
        longitude: -74.0060,
      });
    });

    it('should return error for invalid JSON', () => {
      const event = {
        body: 'invalid json {',
      };

      const result = parseRequestBody(event);

      expect(result.success).toBe(false);
      expect(result.error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const errorBody = JSON.parse(result.error.body);
      expect(errorBody.error.message).toContain('Invalid JSON format');
    });

    it('should return error for empty body', () => {
      const event = {
        body: null,
      };

      const result = parseRequestBody(event);

      expect(result.success).toBe(false);
      expect(result.error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should return error for empty string body', () => {
      const event = {
        body: '   ',
      };

      const result = parseRequestBody(event);

      expect(result.success).toBe(false);
      expect(result.error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should handle malformed JSON starting with "i"', () => {
      const event = {
        body: 'invalid',
      };

      const result = parseRequestBody(event);

      expect(result.success).toBe(false);
      expect(result.error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const errorBody = JSON.parse(result.error.body);
      expect(errorBody.error.message).toContain('Invalid JSON format');
    });

    it('should handle unsupported body types', () => {
      const event = {
        body: 12345,
      };

      const result = parseRequestBody(event);

      expect(result.success).toBe(false);
      expect(result.error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    });
  });

  describe('validateRequiredFields', () => {
    it('should validate when all required fields are present', () => {
      const body = {
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: '2025-10-02T10:00:00Z',
      };

      const result = validateRequiredFields(body, ['latitude', 'longitude']);

      expect(result.valid).toBe(true);
    });

    it('should return error when required fields are missing', () => {
      const body = {
        latitude: 40.7128,
      };

      const result = validateRequiredFields(body, ['latitude', 'longitude']);

      expect(result.valid).toBe(false);
      expect(result.error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const errorBody = JSON.parse(result.error.body);
      expect(errorBody.error.message).toContain('longitude');
    });

    it('should handle empty required fields array', () => {
      const body = {
        latitude: 40.7128,
      };

      const result = validateRequiredFields(body, []);

      expect(result.valid).toBe(true);
    });
  });

  describe('parseAndValidateBody', () => {
    it('should parse and validate successfully', () => {
      const event = {
        body: '{"latitude": 40.7128, "longitude": -74.0060}',
      };

      const result = parseAndValidateBody(event, ['latitude', 'longitude']);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        latitude: 40.7128,
        longitude: -74.0060,
      });
    });

    it('should return parse error if JSON is invalid', () => {
      const event = {
        body: 'invalid json',
      };

      const result = parseAndValidateBody(event, ['latitude', 'longitude']);

      expect(result.success).toBe(false);
      expect(result.error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should return validation error if required fields missing', () => {
      const event = {
        body: '{"latitude": 40.7128}',
      };

      const result = parseAndValidateBody(event, ['latitude', 'longitude']);

      expect(result.success).toBe(false);
      expect(result.error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const errorBody = JSON.parse(result.error.body);
      expect(errorBody.error.message).toContain('longitude');
    });

    it('should work without required fields validation', () => {
      const event = {
        body: '{"latitude": 40.7128}',
      };

      const result = parseAndValidateBody(event);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ latitude: 40.7128 });
    });
  });
});
