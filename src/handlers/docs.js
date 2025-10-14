const fs = require('fs');
const path = require('path');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Serve OpenAPI specification
 * GET /docs/openapi.yaml
 */
exports.getOpenAPISpec = async () => {
  try {
    logger.info('Serving OpenAPI specification');

    const openApiPath = path.join(__dirname, '../../openapi.yaml');
    
    if (!fs.existsSync(openApiPath)) {
      logger.error('OpenAPI spec file not found');
      return errorResponse(404, 'OpenAPI specification not found');
    }

    const openApiContent = fs.readFileSync(openApiPath, 'utf8');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/x-yaml',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
      body: openApiContent,
    };
  } catch (error) {
    logger.error('Error serving OpenAPI spec:', error);
    return errorResponse(500, 'Failed to serve OpenAPI specification');
  }
};

/**
 * Serve OpenAPI specification as JSON
 * GET /docs/openapi.json
 */
exports.getOpenAPISpecJSON = async () => {
  try {
    logger.info('Serving OpenAPI specification as JSON');

    const openApiPath = path.join(__dirname, '../../openapi.yaml');
    
    if (!fs.existsSync(openApiPath)) {
      logger.error('OpenAPI spec file not found');
      return errorResponse(404, 'OpenAPI specification not found');
    }

    const yaml = require('yaml');
    const openApiContent = fs.readFileSync(openApiPath, 'utf8');
    const openApiJSON = yaml.parse(openApiContent);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
      body: JSON.stringify(openApiJSON, null, 2),
    };
  } catch (error) {
    logger.error('Error serving OpenAPI spec JSON:', error);
    return errorResponse(500, 'Failed to serve OpenAPI specification as JSON');
  }
};

/**
 * Serve Swagger UI HTML page
 * GET /docs/swagger
 */
exports.getSwaggerUI = async (event) => {
  try {
    logger.info('Serving Swagger UI');

    // Get the base URL from the request
    const baseUrl = `https://${event.headers.Host}/${event.requestContext.stage}`;
    const openApiUrl = `${baseUrl}/docs/openapi.json`;

    const swaggerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Bus Tracking System API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
    <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5.9.0/favicon-32x32.png" sizes="32x32" />
    <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5.9.0/favicon-16x16.png" sizes="16x16" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin: 0;
            background: #fafafa;
        }
        .swagger-ui .topbar {
            background-color: #1e88e5;
        }
        .swagger-ui .topbar .download-url-wrapper {
            display: none;
        }
        .header-info {
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            margin-bottom: 20px;
        }
        .header-info h1 {
            margin: 0 0 10px 0;
            font-size: 2.5em;
        }
        .header-info p {
            margin: 5px 0;
            font-size: 1.1em;
        }
        .student-info {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="header-info">
        <h1>🚌 Bus Tracking System API</h1>
        <p>Real-time bus tracking and route management system</p>
        <div class="student-info">
            <p><strong>Student:</strong> AKASH | <strong>Index:</strong> COBSCCOMP4Y241P-008</p>
            <p><strong>Coventry ID:</strong> 15386593 | <strong>Module:</strong> NB6007CEM</p>
        </div>
        <p>Serverless Architecture with AWS Lambda, DynamoDB & API Gateway</p>
    </div>
    
    <div id="swagger-ui"></div>

    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js" charset="UTF-8"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '${openApiUrl}',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                tryItOutEnabled: true,
                requestInterceptor: function(request) {
                    // Add any custom headers or authentication here
                    return request;
                },
                responseInterceptor: function(response) {
                    return response;
                }
            });
        };
    </script>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
      body: swaggerHTML,
    };
  } catch (error) {
    logger.error('Error serving Swagger UI:', error);
    return errorResponse(500, 'Failed to serve Swagger UI');
  }
};

/**
 * Serve ReDoc HTML page
 * GET /docs/redoc
 */
exports.getReDoc = async (event) => {
  try {
    logger.info('Serving ReDoc');

    // Get the base URL from the request
    const baseUrl = `https://${event.headers.Host}/${event.requestContext.stage}`;
    const openApiUrl = `${baseUrl}/docs/openapi.json`;

    const redocHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Bus Tracking System API Documentation</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Roboto', sans-serif;
        }
        .header-info {
            padding: 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
        }
        .header-info h1 {
            margin: 0 0 15px 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header-info p {
            margin: 8px 0;
            font-size: 1.1em;
        }
        .student-info {
            background: rgba(255,255,255,0.15);
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            backdrop-filter: blur(10px);
        }
        .student-info p {
            margin: 5px 0;
            font-weight: 400;
        }
        #redoc-container {
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="header-info">
        <h1>🚌 Bus Tracking System API</h1>
        <p>Comprehensive API Documentation</p>
        <div class="student-info">
            <p><strong>Student:</strong> AKASH | <strong>Index:</strong> COBSCCOMP4Y241P-008</p>
            <p><strong>Coventry University ID:</strong> 15386593</p>
            <p><strong>Module:</strong> NB6007CEM - Cloud Computing</p>
        </div>
        <p>Built with AWS Serverless Architecture</p>
    </div>
    
    <div id="redoc-container"></div>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    <script>
        Redoc.init('${openApiUrl}', {
            scrollYOffset: 0,
            theme: {
                colors: {
                    primary: {
                        main: '#667eea'
                    }
                },
                typography: {
                    fontSize: '14px',
                    lineHeight: '1.5em',
                    code: {
                        fontSize: '13px',
                        fontFamily: 'Courier, monospace'
                    },
                    headings: {
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: '400'
                    }
                }
            }
        }, document.getElementById('redoc-container'));
    </script>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
      body: redocHTML,
    };
  } catch (error) {
    logger.error('Error serving ReDoc:', error);
    return errorResponse(500, 'Failed to serve ReDoc');
  }
};

/**
 * Serve documentation index page
 * GET /docs
 */
exports.getDocsIndex = async (event) => {
  try {
    logger.info('Serving documentation index');

    // Get the base URL from the request
    const baseUrl = `https://${event.headers.Host}/${event.requestContext.stage}`;

    const indexHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bus Tracking System - API Documentation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        .header {
            text-align: center;
            color: white;
            margin-bottom: 50px;
        }
        .header h1 {
            font-size: 3.5em;
            margin-bottom: 20px;
            font-weight: 300;
        }
        .header p {
            font-size: 1.3em;
            margin-bottom: 10px;
        }
        .student-info {
            background: rgba(255,255,255,0.1);
            padding: 25px;
            border-radius: 15px;
            margin: 30px 0;
            backdrop-filter: blur(10px);
        }
        .student-info h3 {
            margin-bottom: 15px;
            font-size: 1.5em;
        }
        .student-info p {
            margin: 8px 0;
            font-size: 1.1em;
        }
        .docs-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-top: 40px;
        }
        .doc-card {
            background: rgba(255,255,255,0.95);
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            text-align: center;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .doc-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.2);
        }
        .doc-card h3 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.5em;
        }
        .doc-card p {
            color: #666;
            margin-bottom: 20px;
        }
        .btn {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 25px;
            transition: all 0.3s ease;
            font-weight: 500;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        .features {
            background: rgba(255,255,255,0.1);
            padding: 30px;
            border-radius: 15px;
            margin: 40px 0;
            backdrop-filter: blur(10px);
        }
        .features h3 {
            color: white;
            margin-bottom: 20px;
            text-align: center;
            font-size: 1.8em;
        }
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        .feature-item {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 10px;
            color: white;
        }
        .feature-item h4 {
            margin-bottom: 10px;
            color: #fff;
        }
        .api-info {
            background: rgba(255,255,255,0.1);
            padding: 25px;
            border-radius: 15px;
            margin: 30px 0;
            backdrop-filter: blur(10px);
            color: white;
        }
        .api-info h3 {
            margin-bottom: 15px;
            font-size: 1.5em;
        }
        .api-endpoints {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .endpoint {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚌 Bus Tracking System</h1>
            <p>Real-time Bus Tracking & Route Management API</p>
            
            <div class="student-info">
                <h3>Academic Project Information</h3>
                <p><strong>Student Name:</strong> AKASH</p>
                <p><strong>Index Number:</strong> COBSCCOMP4Y241P-008</p>
                <p><strong>Coventry University ID:</strong> 15386593</p>
                <p><strong>Module:</strong> NB6007CEM - Cloud Computing and Advanced Web Development</p>
                <p><strong>Academic Year:</strong> 2024-2025</p>
            </div>
        </div>

        <div class="api-info">
            <h3>🌐 API Endpoints</h3>
            <p><strong>Development:</strong> ${baseUrl}</p>
            <p><strong>Production:</strong> https://s8gu5u156h.execute-api.ap-south-1.amazonaws.com/production</p>
            
            <div class="api-endpoints">
                <div class="endpoint">GET /public/routes</div>
                <div class="endpoint">GET /public/buses</div>
                <div class="endpoint">GET /public/schedules</div>
                <div class="endpoint">GET /public/location/{busId}</div>
                <div class="endpoint">GET /health</div>
            </div>
        </div>

        <div class="docs-grid">
            <div class="doc-card">
                <h3>📋 Swagger UI</h3>
                <p>Interactive API documentation with live testing capabilities. Try out API endpoints directly from the browser.</p>
                <a href="${baseUrl}/docs/swagger" class="btn" target="_blank">Open Swagger UI</a>
            </div>

            <div class="doc-card">
                <h3>📖 ReDoc</h3>
                <p>Beautiful, responsive API documentation with detailed schemas and examples.</p>
                <a href="${baseUrl}/docs/redoc" class="btn" target="_blank">Open ReDoc</a>
            </div>

            <div class="doc-card">
                <h3>📄 OpenAPI Spec</h3>
                <p>Download the raw OpenAPI 3.0 specification file for integration with other tools.</p>
                <a href="${baseUrl}/docs/openapi.json" class="btn" target="_blank">Download JSON</a>
            </div>
        </div>

        <div class="features">
            <h3>🚀 System Features</h3>
            <div class="features-grid">
                <div class="feature-item">
                    <h4>🏗️ Serverless Architecture</h4>
                    <p>AWS Lambda functions with auto-scaling and cost optimization</p>
                </div>
                <div class="feature-item">
                    <h4>🔄 Real-time Tracking</h4>
                    <p>Live bus location updates with DynamoDB and caching</p>
                </div>
                <div class="feature-item">
                    <h4>🔐 Secure Authentication</h4>
                    <p>JWT-based authentication with role-based access control</p>
                </div>
                <div class="feature-item">
                    <h4>📊 Comprehensive API</h4>
                    <p>24+ endpoints covering public, operator, and admin functions</p>
                </div>
                <div class="feature-item">
                    <h4>⚡ High Performance</h4>
                    <p>Optimized DynamoDB queries with intelligent caching</p>
                </div>
                <div class="feature-item">
                    <h4>🌍 Production Ready</h4>
                    <p>CI/CD pipeline with automated testing and deployment</p>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
      body: indexHTML,
    };
  } catch (error) {
    logger.error('Error serving docs index:', error);
    return errorResponse(500, 'Failed to serve documentation index');
  }
};