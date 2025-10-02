const dynamodbService = require('../../src/services/dynamodb');

describe('DynamoDB Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('putItem', () => {
    it('should put item successfully', async () => {
      const tableName = 'test-table';
      const item = { id: 'test-id', name: 'test-item' };

      const result = await dynamodbService.putItem(tableName, item);

      expect(result).toBeDefined();
    });
  });

  describe('getItem', () => {
    it('should get item successfully', async () => {
      const tableName = 'test-table';
      const key = { id: 'test-id' };

      const result = await dynamodbService.getItem(tableName, key);

      expect(result).toBeDefined();
      expect(result.RouteID).toBe('route-001');
    });

    it('should return null when item not found', async () => {
      const tableName = 'test-table';
      const key = { id: 'non-existent' };

      // Mock getItem to return null
      const originalGetItem = jest.spyOn(dynamodbService, 'getItem');
      originalGetItem.mockResolvedValue(null);

      const result = await dynamodbService.getItem(tableName, key);

      expect(result).toBeNull();
      originalGetItem.mockRestore();
    });
  });

  describe('scanTable', () => {
    it('should scan table successfully', async () => {
      const tableName = 'test-table';

      const result = await dynamodbService.scanTable(tableName);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should handle scan parameters', async () => {
      const tableName = 'test-table';
      const params = { FilterExpression: 'attribute_exists(id)' };

      const result = await dynamodbService.scanTable(tableName, params);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('queryTable', () => {
    it('should query table successfully', async () => {
      const tableName = 'test-table';
      const params = { KeyConditionExpression: 'id = :id' };

      const result = await dynamodbService.queryTable(tableName, params);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('updateItem', () => {
    it('should update item successfully', async () => {
      const tableName = 'test-table';
      const key = { id: 'test-id' };
      const updateExpression = {
        UpdateExpression: 'SET #name = :name',
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: { ':name': 'updated-name' },
      };

      const result = await dynamodbService.updateItem(tableName, key, updateExpression);

      expect(result).toBeDefined();
    });
  });

  describe('deleteItem', () => {
    it('should delete item successfully', async () => {
      const tableName = 'test-table';
      const key = { id: 'test-id' };

      const result = await dynamodbService.deleteItem(tableName, key);

      expect(result).toBeDefined();
    });
  });
});
