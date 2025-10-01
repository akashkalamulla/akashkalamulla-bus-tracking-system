const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    ScanCommand,
    QueryCommand,
    UpdateCommand,
    DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');

// Create DynamoDB client
const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
});

// Create DynamoDB Document client
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * DynamoDB service for bus tracking system
 */
class DynamoDBService {
    /**
     * Put item in DynamoDB table
     * @param {string} tableName - Table name
     * @param {Object} item - Item to put
     * @returns {Promise<Object>} Result
     */
    async putItem(tableName, item) {
        try {
            const command = new PutCommand({
                TableName: tableName,
                Item: item,
            });

            const result = await docClient.send(command);
            return result;
        } catch (error) {
            throw new Error(`Failed to put item: ${error.message}`);
        }
    }

    /**
     * Get item from DynamoDB table
     * @param {string} tableName - Table name
     * @param {Object} key - Primary key
     * @returns {Promise<Object>} Item
     */
    async getItem(tableName, key) {
        try {
            const command = new GetCommand({
                TableName: tableName,
                Key: key,
            });

            const result = await docClient.send(command);
            return result.Item;
        } catch (error) {
            throw new Error(`Failed to get item: ${error.message}`);
        }
    }

    /**
     * Scan DynamoDB table
     * @param {string} tableName - Table name
     * @param {Object} params - Additional scan parameters
     * @returns {Promise<Array>} Items
     */
    async scanTable(tableName, params = {}) {
        try {
            const command = new ScanCommand({
                TableName: tableName,
                ...params,
            });

            const result = await docClient.send(command);
            return result.Items || [];
        } catch (error) {
            throw new Error(`Failed to scan table: ${error.message}`);
        }
    }

    /**
     * Query DynamoDB table
     * @param {string} tableName - Table name
     * @param {Object} params - Query parameters
     * @returns {Promise<Array>} Items
     */
    async queryTable(tableName, params) {
        try {
            const command = new QueryCommand({
                TableName: tableName,
                ...params,
            });

            const result = await docClient.send(command);
            return result.Items || [];
        } catch (error) {
            throw new Error(`Failed to query table: ${error.message}`);
        }
    }

    /**
     * Update item in DynamoDB table
     * @param {string} tableName - Table name
     * @param {Object} key - Primary key
     * @param {Object} updateExpression - Update expression and values
     * @returns {Promise<Object>} Updated item
     */
    async updateItem(tableName, key, updateExpression) {
        try {
            const command = new UpdateCommand({
                TableName: tableName,
                Key: key,
                ...updateExpression,
                ReturnValues: 'ALL_NEW',
            });

            const result = await docClient.send(command);
            return result.Attributes;
        } catch (error) {
            throw new Error(`Failed to update item: ${error.message}`);
        }
    }

    /**
     * Delete item from DynamoDB table
     * @param {string} tableName - Table name
     * @param {Object} key - Primary key
     * @returns {Promise<Object>} Result
     */
    async deleteItem(tableName, key) {
        try {
            const command = new DeleteCommand({
                TableName: tableName,
                Key: key,
            });

            const result = await docClient.send(command);
            return result;
        } catch (error) {
            throw new Error(`Failed to delete item: ${error.message}`);
        }
    }
}

module.exports = new DynamoDBService();