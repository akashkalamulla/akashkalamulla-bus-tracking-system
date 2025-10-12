const jwt = require('jsonwebtoken');
const {
  error: logError, warn: logWarn, info: logInfo, debug: logDebug,
} = require('../utils/logger');

// JWT Secret or Public Key - use environment variable for production
const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_PUBLIC_KEY || 'dev-secret-key-change-in-production';

// Role definitions
const ROLES = {
  NTC: 'NTC', // National Transport Commission - highest authority
  BUS_OPERATOR: 'BUS_OPERATOR', // Bus operators/drivers - can update locations
  COMMUTER: 'COMMUTER', // Regular commuters - read-only access
};

// Endpoint-to-role mapping for authorization decisions
const ROLE_PERMISSIONS = [
  // =============================================================================
  // PUBLIC ENDPOINTS (COMMUTER ROLE) - Read-only access
  // =============================================================================
  {
    pathPattern: /^/[^/]+/routes$/,
    method: 'GET',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR, ROLES.COMMUTER],
    description: 'Get all routes - all authenticated users',
  },
  {
    pathPattern: /^/[^/]+/routes/[^/]+$/,
    method: 'GET',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR, ROLES.COMMUTER],
    description: 'Get specific route - all authenticated users',
  },
  {
    pathPattern: /^/[^/]+/routes/[^/]+/buses/live$/,
    method: 'GET',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR, ROLES.COMMUTER],
    description: 'Get live buses on route - all authenticated users',
  },

  // =============================================================================
  // OPERATOR ENDPOINTS (BUS_OPERATOR ROLE) - Location updates + read access
  // =============================================================================
  {
    pathPattern: /^/[^/]+/buses/[^/]+$/,
    method: 'GET',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR],
    description: 'Get bus information - operators and NTC only',
  },
  {
    pathPattern: /^/[^/]+/buses/[^/]+$/,
    method: 'PUT',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR],
    description: 'Update bus information - operators and NTC only',
  },
  {
    pathPattern: /^/[^/]+/buses/[^/]+/location$/,
    method: 'GET',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR, ROLES.COMMUTER],
    description: 'Get bus location - all authenticated users',
  },
  {
    pathPattern: /^/[^/]+/buses/[^/]+/location$/,
    method: 'PUT',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR],
    description: 'Update bus location - operators and NTC only',
  },

  // =============================================================================
  // OPERATOR ENDPOINTS (BUS_OPERATOR ROLE) - Bus ownership management
  // =============================================================================
  {
    pathPattern: /^/[^/]+/operator/buses$/,
    method: 'GET',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR],
    description: 'Operator - Get owned buses - operators and NTC only',
  },
  {
    pathPattern: /^/[^/]+/operator/buses$/,
    method: 'POST',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR],
    description: 'Operator - Create new bus - operators and NTC only',
  },
  {
    pathPattern: /^/[^/]+/operator/buses/[^/]+$/,
    method: 'GET',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR],
    description: 'Operator - Get specific bus details - operators and NTC only',
  },
  {
    pathPattern: /^/[^/]+/operator/buses/[^/]+$/,
    method: 'PUT',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR],
    description: 'Operator - Update bus details - operators and NTC only',
  },
  {
    pathPattern: /^/[^/]+/operator/buses/[^/]+$/,
    method: 'DELETE',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR],
    description: 'Operator - Delete bus - operators and NTC only',
  },
  {
    pathPattern: /^/[^/]+/operator/buses/[^/]+/location$/,
    method: 'GET',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR],
    description: 'Operator - Get bus location - operators and NTC only',
  },
  {
    pathPattern: /^/[^/]+/operator/buses/[^/]+/location$/,
    method: 'PUT',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR],
    description: 'Operator - Update bus location - operators and NTC only',
  },

  // =============================================================================
  // ADMIN ENDPOINTS (NTC ROLE) - Full administrative access
  // =============================================================================
  // Admin Routes Management
  {
    pathPattern: /^/[^/]+/admin/routes$/,
    method: 'GET',
    allowedRoles: [ROLES.NTC],
    description: 'Admin - Get all routes with full details - NTC only',
  },
  {
    pathPattern: /^/[^/]+/admin/routes$/,
    method: 'POST',
    allowedRoles: [ROLES.NTC],
    description: 'Admin - Create new route - NTC only',
  },
  {
    pathPattern: /^/[^/]+/admin/routes/[^/]+$/,
    method: 'PUT',
    allowedRoles: [ROLES.NTC],
    description: 'Admin - Update route - NTC only',
  },
  {
    pathPattern: /^/[^/]+/admin/routes/[^/]+$/,
    method: 'DELETE',
    allowedRoles: [ROLES.NTC],
    description: 'Admin - Delete route - NTC only',
  },

  // Admin Buses Management
  {
    pathPattern: /^/[^/]+/admin/buses$/,
    method: 'GET',
    allowedRoles: [ROLES.NTC],
    description: 'Admin - Get all buses with full details - NTC only',
  },
  {
    pathPattern: /^/[^/]+/admin/buses$/,
    method: 'POST',
    allowedRoles: [ROLES.NTC],
    description: 'Admin - Create new bus - NTC only',
  },
  {
    pathPattern: /^/[^/]+/admin/buses/[^/]+$/,
    method: 'PUT',
    allowedRoles: [ROLES.NTC],
    description: 'Admin - Update bus - NTC only',
  },
  {
    pathPattern: /^/[^/]+/admin/buses/[^/]+$/,
    method: 'DELETE',
    allowedRoles: [ROLES.NTC],
    description: 'Admin - Delete bus - NTC only',
  },

  // Admin History and Analytics
  {
    pathPattern: /^/[^/]+/admin/history$/,
    method: 'GET',
    allowedRoles: [ROLES.NTC],
    description: 'Admin - Get location history and analytics - NTC only',
  },
  {
    pathPattern: /^/[^/]+/admin/history/[^/]+$/,
    method: 'GET',
    allowedRoles: [ROLES.NTC],
    description: 'Admin - Get specific bus location history - NTC only',
  },

  // =============================================================================
  // UTILITY ENDPOINTS (NO AUTH REQUIRED)
  // =============================================================================
  {
    pathPattern: /^/[^/]+/status/ping$/,
    method: 'GET',
    allowedRoles: [ROLES.NTC, ROLES.BUS_OPERATOR, ROLES.COMMUTER],
    description: 'Health check - all authenticated users',
  },
];

/**
 * Check if a role is authorized for a specific endpoint and method
 * @param {string} role - User role from JWT
 * @param {string} method - HTTP method
 * @param {string} resourcePath - API Gateway resource path
 * @returns {Object} - Authorization result with allowed status and rule info
 */
function checkRoleAuthorization(role, method, resourcePath) {
  // Find matching permission rule
  const matchingRule = ROLE_PERMISSIONS.find((rule) => rule.method.toLowerCase() === method.toLowerCase()
           && rule.pathPattern.test(resourcePath));

  if (!matchingRule) {
    // No specific rule found - default behavior (could be allow or deny based on your security model)
    logWarn('No authorization rule found for endpoint', {
      role,
      method,
      resourcePath,
    });

    // Default to deny for security (change to true if you want permissive default)
    return {
      allowed: false,
      rule: null,
      reason: 'No authorization rule defined for this endpoint',
    };
  }

  const allowed = matchingRule.allowedRoles.includes(role);

  logInfo('Authorization check result', {
    role,
    method,
    resourcePath,
    allowed,
    allowedRoles: matchingRule.allowedRoles,
    description: matchingRule.description,
  });

  return {
    allowed,
    rule: matchingRule,
    reason: allowed ? 'Role authorized' : `Role '${role}' not in allowed roles: ${matchingRule.allowedRoles.join(', ')}`,
  };
}

/**
 * Extract HTTP method and resource path from method ARN
 * @param {string} methodArn - API Gateway method ARN
 * @returns {Object} - Parsed method and resource path
 */
function parseMethodArn(methodArn) {
  // methodArn format: arn:aws:execute-api:region:account:apiId/stage/METHOD/resource/path
  try {
    const arnParts = methodArn.split(':');
    const resourcePart = arnParts[arnParts.length - 1]; // apiId/stage/METHOD/resource/path
    const resourceParts = resourcePart.split('/');

    if (resourceParts.length < 3) {
      throw new Error('Invalid method ARN format');
    }

    const method = resourceParts[2]; // The HTTP method (GET, POST, PUT, etc.)

    // Reconstruct the resource path without the method
    // Example: zcmux4xvg0/dev/PUT/buses/bus_001/location -> /dev/buses/bus_001/location
    const pathParts = resourceParts.slice(1); // Remove apiId
    pathParts.splice(1, 1); // Remove method from position 1 (after stage)
    const resourcePath = `/${pathParts.join('/')}`;

    logDebug('Parsed method ARN', {
      methodArn,
      method,
      resourcePath,
      resourceParts,
    });

    return { method, resourcePath };
  } catch (error) {
    logError('Failed to parse method ARN', { methodArn, error: error.message });
    return { method: 'UNKNOWN', resourcePath: '/unknown' };
  }
}

/**
 * Lambda Authorizer function that validates JWT tokens and implements role-based access control
 * @param {Object} event - API Gateway event
 * @returns {Object} - Policy document with Allow/Deny decision and user context
 */
exports.authorize = async (event) => {
  try {
    logInfo('JWT Lambda Authorizer invoked', {
      methodArn: event.methodArn,
      type: event.type,
    });

    // Extract token from Authorization header
    const token = event.authorizationToken;

    if (!token) {
      logWarn('No authorization token provided');
      throw new Error('Unauthorized - Missing token');
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(cleanToken, JWT_SECRET, {
        algorithms: ['HS256', 'RS256'], // Support both HMAC and RSA algorithms
      });
    } catch (jwtError) {
      logError('JWT verification failed', {
        error: jwtError.message,
        tokenPresent: !!cleanToken,
      });
      throw new Error('Invalid token');
    }

    // Extract user information from token
    const userId = decoded.sub || decoded.userId || 'unknown-user';
    const userRole = decoded.role || 'COMMUTER'; // Default role if not specified
    const userEmail = decoded.email || '';
    const operatorId = decoded.operatorId || (userRole === 'BUS_OPERATOR' ? userId : null);

    // Validate role
    if (!Object.values(ROLES).includes(userRole)) {
      logWarn('Invalid role in token', {
        role: userRole,
        validRoles: Object.values(ROLES),
        userId,
      });
      throw new Error(`Invalid role: ${userRole}`);
    }

    // Parse method ARN to get HTTP method and resource path
    const { method, resourcePath } = parseMethodArn(event.methodArn);

    // Check role-based authorization
    const authResult = checkRoleAuthorization(userRole, method, resourcePath);

    if (!authResult.allowed) {
      logWarn('Role-based authorization failed', {
        userId,
        role: userRole,
        method,
        resourcePath,
        reason: authResult.reason,
      });

      return generatePolicy(userId, 'Deny', event.methodArn, {
        error: 'Insufficient permissions',
        requiredRoles: authResult.rule ? authResult.rule.allowedRoles : [],
        userRole: userRole,
      });
    }

    logInfo('Authorization successful', {
      userId,
      role: userRole,
      method,
      resourcePath,
      ruleDescription: authResult.rule ? authResult.rule.description : 'Default rule',
    });

    // Generate Allow policy with user context
    const userContext = {
      userId,
      role: userRole,
      email: userEmail,
      operatorId,
      authorizedAt: new Date().toISOString(),
      permissions: authResult.rule ? authResult.rule.description : 'Default permissions',
    };

    return generatePolicy(userId, 'Allow', event.methodArn, userContext);
  } catch (error) {
    logError('Authorization failed', {
      error: error.message,
      methodArn: event.methodArn,
      stack: error.stack,
    });

    // Generate Deny policy for any error
    return generatePolicy('user', 'Deny', event.methodArn, {
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Generate IAM policy document for API Gateway with enhanced context
 * @param {string} principalId - User identifier
 * @param {string} effect - Allow or Deny
 * @param {string} resource - Method ARN
 * @param {Object} context - Additional context to pass to Lambda functions
 * @returns {Object} - Policy document with context
 */
function generatePolicy(principalId, effect, resource, context = {}) {
  // Extract the API Gateway ARN base to allow access to all methods in the API
  // Format: arn:aws:execute-api:region:account:apiId/stage/METHOD/resource
  const resourceBase = `${resource.split('/').slice(0, 2).join('/')}/*`;

  const authResponse = {
    principalId: principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resourceBase, // Use wildcard for all methods
        },
      ],
    },
  };

  // Add context if provided (will be available in subsequent Lambda functions via event.requestContext.authorizer)
  if (Object.keys(context).length > 0) {
    // API Gateway requires all context values to be strings
    authResponse.context = {};

    Object.keys(context).forEach((key) => {
      const value = context[key];

      // Convert arrays and objects to JSON strings
      if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
        authResponse.context[key] = JSON.stringify(value);
      } else {
        authResponse.context[key] = String(value || '');
      }
    });

    logDebug('Generated policy with context', {
      principalId,
      effect,
      contextKeys: Object.keys(authResponse.context),
    });
  }

  return authResponse;
}

/**
 * Utility function to get user context from API Gateway event (for use in protected endpoints)
 * @param {Object} event - Lambda event from API Gateway
 * @returns {Object} - Parsed user context from authorizer
 */
function getUserContext(event) {
  try {
    const authorizer = event.requestContext?.authorizer || {};

    return {
      userId: authorizer.userId || authorizer.principalId || 'unknown',
      role: authorizer.role || 'COMMUTER',
      email: authorizer.email || '',
      operatorId: authorizer.operatorId || authorizer.userId || 'unknown', // Use operatorId or fallback to userId
      authorizedAt: authorizer.authorizedAt || '',
      permissions: authorizer.permissions || '',
    };
  } catch (error) {
    logError('Failed to parse user context from event', { error: error.message });
    return {
      userId: 'unknown',
      role: 'COMMUTER',
      email: '',
      operatorId: 'unknown',
      authorizedAt: '',
      permissions: '',
    };
  }
}

// Export everything for use and testing
module.exports = {
  authorize: exports.authorize,
  generatePolicy,
  getUserContext,
  checkRoleAuthorization,
  parseMethodArn,
  ROLES,
  ROLE_PERMISSIONS,
};
