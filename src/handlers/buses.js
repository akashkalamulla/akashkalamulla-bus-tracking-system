const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { error: logError, warn: logWarn, info: logInfo } = require('../utils/logger');
const { successResponse, errorResponse, notFoundResponse } = require('../utils/response');
const { getUserContext } = require('./auth');
const { withRateLimit } = require('../utils/rate-limiter');

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

/**
 * Get bus information by ID
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.getBus = async (event) => {
  try {
    logInfo('Get bus request received', { busId: event.pathParameters?.busId });

    const busId = event.pathParameters?.busId;
    if (!busId) {
      return errorResponse('Bus ID is required', 400);
    }

    // Get user context from authorizer
    const userContext = getUserContext(event);
    
    const params = {
      TableName: process.env.BUSES_TABLE,
      Key: { BusID: busId }
    };

    const result = await dynamodb.send(new GetCommand(params));

    if (!result.Item) {
      return notFoundResponse(`Bus ${busId} not found`);
    }

    logInfo('Bus retrieved successfully', { 
      busId, 
      user: userContext.userId,
      role: userContext.role 
    });

    return successResponse({
      message: 'Bus information retrieved successfully',
      busId,
      bus: result.Item,
      requestedBy: {
        userId: userContext.userId,
        role: userContext.role
      }
    });

  } catch (error) {
    logError('Error retrieving bus information', { 
      error: error.message,
      busId: event.pathParameters?.busId,
      stack: error.stack
    });
    
    return errorResponse('Failed to retrieve bus information', 500);
  }
};

/**
 * Update bus information
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.updateBus = async (event) => {
  try {
    logInfo('Update bus request received', { busId: event.pathParameters?.busId });

    const busId = event.pathParameters?.busId;
    if (!busId) {
      return errorResponse('Bus ID is required', 400);
    }

    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return errorResponse('Invalid JSON in request body', 400);
    }

    // Get user context from authorizer
    const userContext = getUserContext(event);

    // Validate required fields for bus update
    const allowedFields = ['RouteID', 'capacity', 'license_plate', 'status', 'operator_id', 'model', 'year'];
    const updateData = {};
    
    // Only include allowed fields in update
    Object.keys(requestBody).forEach(key => {
      if (allowedFields.includes(key) && requestBody[key] !== undefined) {
        updateData[key] = requestBody[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return errorResponse('No valid fields to update', 400);
    }

    // Add metadata
    updateData.updated_at = new Date().toISOString();
    updateData.updated_by = userContext.userId;

    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(updateData).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    });

    const params = {
      TableName: process.env.BUSES_TABLE,
      Key: { BusID: busId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(BusID)', // Ensure bus exists
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));

    logInfo('Bus updated successfully', { 
      busId,
      updatedFields: Object.keys(updateData),
      user: userContext.userId,
      role: userContext.role
    });

    return successResponse({
      message: 'Bus information updated successfully',
      busId,
      bus: result.Attributes,
      updatedFields: Object.keys(updateData),
      updatedBy: {
        userId: userContext.userId,
        role: userContext.role,
        timestamp: updateData.updated_at
      }
    });

  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return notFoundResponse(`Bus ${event.pathParameters?.busId} not found`);
    }

    logError('Error updating bus information', { 
      error: error.message,
      busId: event.pathParameters?.busId,
      stack: error.stack
    });
    
    return errorResponse('Failed to update bus information', 500);
  }
};

// Wrap exports with rate limiting
const originalGetBus = exports.getBus;
const originalUpdateBus = exports.updateBus;

exports.getBus = withRateLimit(originalGetBus, 'OPERATOR');
exports.updateBus = withRateLimit(originalUpdateBus, 'OPERATOR');