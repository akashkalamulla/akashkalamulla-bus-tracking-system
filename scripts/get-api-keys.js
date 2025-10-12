#!/usr/bin/env node

/**
 * Script to retrieve API Gateway API Keys for rate limiting
 * Usage: node scripts/get-api-keys.js [stage] [region]
 *
 * This script helps developers and clients get the API keys needed
 * to access rate-limited public endpoints.
 */

const AWS = require('aws-sdk');

// Default values
const stage = process.argv[2] || 'dev';
const region = process.argv[3] || 'ap-south-1';
const serviceName = 'bus-tracking-system';

// Configure AWS
AWS.config.update({ region });

const apigateway = new AWS.APIGateway();
const cloudformation = new AWS.CloudFormation();

async function getApiKeys() {
  try {
    console.log(`🔍 Retrieving API keys for ${serviceName}-${stage} in ${region}...`);
    console.log('='.repeat(60));

    // Get stack name
    const stackName = `${serviceName}-${stage}`;

    // Get stack outputs
    const stackResult = await cloudformation.describeStacks({
      StackName: stackName,
    }).promise();

    if (!stackResult.Stacks || stackResult.Stacks.length === 0) {
      throw new Error(`Stack ${stackName} not found`);
    }

    const outputs = stackResult.Stacks[0].Outputs || [];

    // Find API key outputs
    const publicApiKeyOutput = outputs.find((o) => o.OutputKey === 'PublicApiKey');
    const authApiKeyOutput = outputs.find((o) => o.OutputKey === 'AuthenticatedApiKey');
    const apiGatewayOutput = outputs.find((o) => o.OutputKey === 'ApiGatewayRestApiId');

    if (!publicApiKeyOutput || !authApiKeyOutput) {
      throw new Error('API Key outputs not found in CloudFormation stack');
    }

    // Get API key details
    const publicKeyId = publicApiKeyOutput.OutputValue;
    const authKeyId = authApiKeyOutput.OutputValue;
    const apiGatewayId = apiGatewayOutput?.OutputValue;

    // Get public API key details
    const publicKeyDetails = await apigateway.getApiKey({
      apiKey: publicKeyId,
      includeValue: true,
    }).promise();

    // Get authenticated API key details
    const authKeyDetails = await apigateway.getApiKey({
      apiKey: authKeyId,
      includeValue: true,
    }).promise();

    // Display results
    console.log('📋 API GATEWAY RATE LIMITING CONFIGURATION');
    console.log('='.repeat(60));
    console.log();

    console.log('🔑 PUBLIC ENDPOINTS API KEY:');
    console.log(`   Name: ${publicKeyDetails.name}`);
    console.log(`   ID: ${publicKeyDetails.id}`);
    console.log(`   Key: ${publicKeyDetails.value}`);
    console.log(`   Status: ${publicKeyDetails.enabled ? 'Enabled' : 'Disabled'}`);
    console.log();

    console.log('🔒 AUTHENTICATED ENDPOINTS API KEY:');
    console.log(`   Name: ${authKeyDetails.name}`);
    console.log(`   ID: ${authKeyDetails.id}`);
    console.log(`   Key: ${authKeyDetails.value}`);
    console.log(`   Status: ${authKeyDetails.enabled ? 'Enabled' : 'Disabled'}`);
    console.log();

    if (apiGatewayId) {
      console.log('🌐 API GATEWAY INFO:');
      console.log(`   API ID: ${apiGatewayId}`);
      console.log(`   Base URL: https://${apiGatewayId}.execute-api.${region}.amazonaws.com/${stage}`);
      console.log();
    }

    console.log('📖 USAGE INSTRUCTIONS:');
    console.log('='.repeat(60));
    console.log('For PUBLIC endpoints (no authentication required):');
    console.log(`   curl -H "X-API-Key: ${publicKeyDetails.value}" \\`);
    console.log(`        https://${apiGatewayId}.execute-api.${region}.amazonaws.com/${stage}/public/routes`);
    console.log();
    console.log('For AUTHENTICATED endpoints (JWT + API Key required):');
    console.log(`   curl -H "X-API-Key: ${authKeyDetails.value}" \\`);
    console.log('        -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
    console.log(`        https://${apiGatewayId}.execute-api.${region}.amazonaws.com/${stage}/buses/YOUR_BUS_ID/location`);
    console.log();

    console.log('⚡ RATE LIMITS:');
    console.log('   Public endpoints: 50 req/sec, 100 burst, 10,000/day');
    console.log('   Authenticated endpoints: 100 req/sec, 200 burst, 50,000/day');
    console.log();

    // Generate environment file
    const envContent = `# API Gateway Configuration for ${serviceName}-${stage}
# Generated on ${new Date().toISOString()}

# Public endpoints API key (no auth required)
PUBLIC_API_KEY=${publicKeyDetails.value}

# Authenticated endpoints API key (JWT required)
AUTHENTICATED_API_KEY=${authKeyDetails.value}

# API Gateway base URL
API_BASE_URL=https://${apiGatewayId}.execute-api.${region}.amazonaws.com/${stage}

# Rate limits
PUBLIC_RATE_LIMIT=50
PUBLIC_BURST_LIMIT=100
PUBLIC_QUOTA_LIMIT=10000

AUTHENTICATED_RATE_LIMIT=100
AUTHENTICATED_BURST_LIMIT=200
AUTHENTICATED_QUOTA_LIMIT=50000
`;

    require('fs').writeFileSync(`.env.api-keys.${stage}`, envContent);
    console.log(`📄 Environment file saved: .env.api-keys.${stage}`);
  } catch (error) {
    console.error('❌ Error retrieving API keys:', error.message);

    if (error.code === 'StackDoesNotExist') {
      console.error(`💡 Stack ${stackName} does not exist. Deploy your application first:`);
      console.error(`   serverless deploy --stage ${stage} --region ${region}`);
    } else if (error.code === 'AccessDenied') {
      console.error('💡 Access denied. Check your AWS credentials and permissions for:');
      console.error('   - cloudformation:DescribeStacks');
      console.error('   - apigateway:GetApiKey');
    }

    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  console.log('🚀 Bus Tracking System API Key Retrieval Tool');
  console.log(`   Stage: ${stage}`);
  console.log(`   Region: ${region}`);
  console.log();

  getApiKeys().catch(console.error);
}

module.exports = { getApiKeys };
