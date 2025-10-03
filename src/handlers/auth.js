const jwt = require('jsonwebtoken');
const { error: logError, warn: logWarn, info: logInfo, debug: logDebug } = require('../utils/logger');

// JWT Secret or Public Key - use environment variable for production
const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_PUBLIC_KEY || 'your-secret-key';

/**
 * Lambda Authorizer function to validate JWT tokens
 * @param {Object} event - API Gateway event
 * @returns {Object} - Policy document with Allow/Deny decision
 */
exports.authorize = async (event) => {
  try {
    logInfo('Authorizer invoked', { methodArn: event.methodArn });
    
    // Extract token from Authorization header
    const token = event.authorizationToken;
    
    if (!token) {
      logWarn('No authorization token provided');
      throw new Error('Unauthorized');
    }
    
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    // Verify JWT token
    const decoded = jwt.verify(cleanToken, JWT_SECRET, { 
      algorithms: ['HS256', 'RS256'] // Support both HMAC and RSA algorithms
    });
    
    logInfo('Token validated successfully', { 
      sub: decoded.sub, 
      iat: decoded.iat,
      exp: decoded.exp 
    });
    
    // Generate Allow policy
    const policy = generatePolicy(decoded.sub, 'Allow', event.methodArn, decoded);
    
    return policy;
    
  } catch (error) {
    logError('Token validation failed', { 
      error: error.message,
      methodArn: event.methodArn 
    });
    
    // Generate Deny policy for any error
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

/**
 * Generate IAM policy document for API Gateway
 * @param {string} principalId - User identifier
 * @param {string} effect - Allow or Deny
 * @param {string} resource - Method ARN
 * @param {Object} context - Additional context to pass to Lambda (optional)
 * @returns {Object} - Policy document
 */
function generatePolicy(principalId, effect, resource, context = {}) {
  const authResponse = {
    principalId: principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    }
  };

  // Add context if provided (will be available in subsequent Lambda functions)
  if (Object.keys(context).length > 0) {
    authResponse.context = {
      userId: context.sub || principalId,
      email: context.email || '',
      role: context.role || 'user',
      // Convert all context values to strings (API Gateway requirement)
      ...Object.keys(context).reduce((acc, key) => {
        acc[key] = String(context[key] || '');
        return acc;
      }, {})
    };
  }

  return authResponse;
}

// Export for testing purposes
module.exports = {
  authorize: exports.authorize,
  generatePolicy
};