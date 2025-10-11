const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { successResponse, errorResponse } = require('../utils/response');
const { error: logError, info: logInfo } = require('../utils/logger');

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const dynamodb = DynamoDBDocumentClient.from(client);
const USERS_TABLE = process.env.USERS_TABLE || 'Users';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * User Registration
 * POST /auth/register
 */
exports.register = async (event) => {
  try {
    const { username, password, email, role, name } = JSON.parse(event.body);

    // Validation
    if (!username || !password || !email || !role || !name) {
      return errorResponse('Missing required fields: username, password, email, role, name', 400);
    }

    if (password.length < 8) {
      return errorResponse('Password must be at least 8 characters long', 400);
    }

    if (!['NTC', 'BUS_OPERATOR', 'COMMUTER'].includes(role)) {
      return errorResponse('Invalid role. Must be NTC, BUS_OPERATOR, or COMMUTER', 400);
    }

    // Check if user already exists
    const existingUser = await dynamodb.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { username }
    }));

    if (existingUser.Item) {
      return errorResponse('Username already exists', 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = {
      userId: uuidv4(),
      username,
      email,
      password: hashedPassword,
      role,
      name,
      createdAt: new Date().toISOString(),
      isActive: true
    };

    // Add operator-specific fields
    if (role === 'BUS_OPERATOR') {
      user.operatorId = `OP${Date.now()}`;
    }

    await dynamodb.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: user
    }));

    logInfo('User registered successfully', { userId: user.userId, username, role });

    // Return user info (without password)
    const { password: _, ...userResponse } = user;
    return successResponse({
      message: 'User registered successfully',
      user: userResponse
    }, 201);

  } catch (error) {
    logError('Registration error:', error);
    return errorResponse('Registration failed', 500);
  }
};

/**
 * User Login
 * POST /auth/login
 */
exports.login = async (event) => {
  try {
    const { username, password } = JSON.parse(event.body);

    if (!username || !password) {
      return errorResponse('Username and password are required', 400);
    }

    // Get user from database
    const result = await dynamodb.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { username }
    }));

    if (!result.Item) {
      return errorResponse('Invalid username or password', 401);
    }

    const user = result.Item;

    // Check if user is active
    if (!user.isActive) {
      return errorResponse('Account is disabled', 401);
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return errorResponse('Invalid username or password', 401);
    }

    // Generate JWT token
    const tokenPayload = {
      userId: user.userId,
      username: user.username,
      role: user.role,
      name: user.name
    };

    // Add operator ID if applicable
    if (user.role === 'BUS_OPERATOR' && user.operatorId) {
      tokenPayload.operatorId = user.operatorId;
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Update last login
    await dynamodb.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { username },
      UpdateExpression: 'SET lastLoginAt = :now',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString()
      }
    }));

    logInfo('User logged in successfully', { userId: user.userId, username, role: user.role });

    return successResponse({
      message: 'Login successful',
      token,
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name,
        operatorId: user.operatorId
      }
    });

  } catch (error) {
    logError('Login error:', error);
    return errorResponse('Login failed', 500);
  }
};

/**
 * Refresh Token
 * POST /auth/refresh
 */
exports.refresh = async (event) => {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('No token provided', 401);
    }

    const token = authHeader.substring(7);
    
    // Verify current token (even if expired)
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    } catch (error) {
      return errorResponse('Invalid token', 401);
    }

    // Get fresh user data
    const result = await dynamodb.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { username: decoded.username }
    }));

    if (!result.Item || !result.Item.isActive) {
      return errorResponse('User not found or inactive', 401);
    }

    const user = result.Item;

    // Generate new token
    const tokenPayload = {
      userId: user.userId,
      username: user.username,
      role: user.role,
      name: user.name
    };

    if (user.role === 'BUS_OPERATOR' && user.operatorId) {
      tokenPayload.operatorId = user.operatorId;
    }

    const newToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return successResponse({
      message: 'Token refreshed successfully',
      token: newToken
    });

  } catch (error) {
    logError('Token refresh error:', error);
    return errorResponse('Token refresh failed', 500);
  }
};

/**
 * Get Current User Profile
 * GET /auth/profile
 */
exports.getProfile = async (event) => {
  try {
    const userContext = event.requestContext.authorizer;
    
    if (!userContext || !userContext.username) {
      return errorResponse('User context not found', 401);
    }

    // Get fresh user data
    const result = await dynamodb.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { username: userContext.username }
    }));

    if (!result.Item) {
      return errorResponse('User not found', 404);
    }

    const { password, ...userProfile } = result.Item;

    return successResponse({
      user: userProfile
    });

  } catch (error) {
    logError('Get profile error:', error);
    return errorResponse('Failed to get user profile', 500);
  }
};

/**
 * Logout (Optional - for token blacklisting)
 * POST /auth/logout
 */
exports.logout = async (event) => {
  try {
    // In a production system, you might want to blacklist the token
    // For now, we'll just return success since JWT is stateless
    
    logInfo('User logged out');

    return successResponse({
      message: 'Logged out successfully'
    });

  } catch (error) {
    logError('Logout error:', error);
    return errorResponse('Logout failed', 500);
  }
};