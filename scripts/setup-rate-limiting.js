#!/usr/bin/env node

/**
 * Manual API Gateway Usage Plans Setup Script
 * Creates usage plans and API keys using AWS SDK after base deployment
 *
 * Usage: node scripts/setup-rate-limiting.js [stage] [region]
 */

const AWS = require('aws-sdk');

// Configuration
const stage = process.argv[2] || 'dev';
const region = process.argv[3] || 'ap-south-1';
const serviceName = 'bus-tracking-system';

// Configure AWS
AWS.config.update({ region });

const apigateway = new AWS.APIGateway();
const cloudformation = new AWS.CloudFormation();

async function getApiGatewayId() {
  try {
    const stackName = `${serviceName}-${stage}`;
    const stackResult = await cloudformation.describeStacks({
      StackName: stackName,
    }).promise();

    if (!stackResult.Stacks || stackResult.Stacks.length === 0) {
      throw new Error(`Stack ${stackName} not found`);
    }

    // Get stack resources to find the API Gateway
    const resourcesResult = await cloudformation.listStackResources({
      StackName: stackName,
    }).promise();

    const apiGatewayResource = resourcesResult.StackResourceSummaries.find(
      (resource) => resource.ResourceType === 'AWS::ApiGateway::RestApi',
    );

    if (!apiGatewayResource) {
      throw new Error('API Gateway REST API not found in stack resources');
    }

    return apiGatewayResource.PhysicalResourceId;
  } catch (error) {
    console.error('Error getting API Gateway ID:', error.message);
    throw error;
  }
}

async function createUsagePlan(name, description, rateLimit, burstLimit, quotaLimit) {
  try {
    console.log(`📦 Creating usage plan: ${name}`);

    const params = {
      name: name,
      description: description,
      throttle: {
        rateLimit: rateLimit,
        burstLimit: burstLimit,
      },
      quota: {
        limit: quotaLimit,
        period: 'DAY',
      },
    };

    const result = await apigateway.createUsagePlan(params).promise();
    console.log(`   ✅ Created usage plan: ${result.id}`);
    return result.id;
  } catch (error) {
    if (error.code === 'ConflictException') {
      console.log(`   ⚠️  Usage plan ${name} already exists, getting existing plan...`);

      // Get existing usage plan
      const plansResult = await apigateway.getUsagePlans().promise();
      const existingPlan = plansResult.items.find((plan) => plan.name === name);

      if (existingPlan) {
        console.log(`   ✅ Found existing usage plan: ${existingPlan.id}`);
        return existingPlan.id;
      }
    }
    throw error;
  }
}

async function createApiKey(name, description) {
  try {
    console.log(`🔑 Creating API key: ${name}`);

    const params = {
      name: name,
      description: description,
      enabled: true,
    };

    const result = await apigateway.createApiKey(params).promise();
    console.log(`   ✅ Created API key: ${result.id}`);
    console.log(`   🔐 Key value: ${result.value}`);
    return { id: result.id, value: result.value };
  } catch (error) {
    if (error.code === 'ConflictException') {
      console.log(`   ⚠️  API key ${name} already exists, getting existing key...`);

      // Get existing API key
      const keysResult = await apigateway.getApiKeys().promise();
      const existingKey = keysResult.items.find((key) => key.name === name);

      if (existingKey) {
        // Get the key value
        const keyDetails = await apigateway.getApiKey({
          apiKey: existingKey.id,
          includeValue: true,
        }).promise();

        console.log(`   ✅ Found existing API key: ${existingKey.id}`);
        console.log(`   🔐 Key value: ${keyDetails.value}`);
        return { id: existingKey.id, value: keyDetails.value };
      }
    }
    throw error;
  }
}

async function addApiKeyToUsagePlan(usagePlanId, apiKeyId, keyType = 'API_KEY') {
  try {
    console.log('🔗 Linking API key to usage plan...');

    const params = {
      usagePlanId: usagePlanId,
      keyId: apiKeyId,
      keyType: keyType,
    };

    await apigateway.createUsagePlanKey(params).promise();
    console.log('   ✅ Successfully linked API key to usage plan');
  } catch (error) {
    if (error.code === 'ConflictException') {
      console.log('   ⚠️  API key already linked to usage plan');
    } else {
      throw error;
    }
  }
}

async function addApiStageToUsagePlan(usagePlanId, apiId, stage) {
  try {
    console.log('🔗 Adding API stage to usage plan...');

    // Update usage plan to include the API stage
    const params = {
      usagePlanId: usagePlanId,
      patchOps: [
        {
          op: 'add',
          path: '/apiStages',
          value: `${apiId}:${stage}`,
        },
      ],
    };

    await apigateway.updateUsagePlan(params).promise();
    console.log('   ✅ Successfully added API stage to usage plan');
  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      console.log('   ⚠️  API stage already added to usage plan');
    } else {
      throw error;
    }
  }
}

async function setupRateLimiting() {
  try {
    console.log('🚀 Setting up API Gateway Rate Limiting');
    console.log(`   Stage: ${stage}`);
    console.log(`   Region: ${region}`);
    console.log('='.repeat(60));

    // Step 1: Get API Gateway ID
    console.log('\n📍 Step 1: Getting API Gateway ID...');
    const apiGatewayId = await getApiGatewayId();
    console.log(`   ✅ API Gateway ID: ${apiGatewayId}`);

    // Step 2: Create usage plans
    console.log('\n📍 Step 2: Creating Usage Plans...');

    const publicUsagePlanId = await createUsagePlan(
      `${serviceName}-public-api-${stage}`,
      'Rate limiting for public GET endpoints (routes and live buses)',
      50, // 50 requests per second
      100, // 100 burst limit
      10000, // 10,000 per day
    );

    const authUsagePlanId = await createUsagePlan(
      `${serviceName}-authenticated-api-${stage}`,
      'Rate limiting for authenticated endpoints (higher limits)',
      100, // 100 requests per second
      200, // 200 burst limit
      50000, // 50,000 per day
    );

    // Step 3: Create API keys
    console.log('\n📍 Step 3: Creating API Keys...');

    const publicApiKey = await createApiKey(
      `${serviceName}-public-key-${stage}`,
      'API Key for rate limiting public endpoints',
    );

    const authApiKey = await createApiKey(
      `${serviceName}-auth-key-${stage}`,
      'API Key for rate limiting authenticated endpoints',
    );

    // Step 4: Link API keys to usage plans
    console.log('\n📍 Step 4: Linking API Keys to Usage Plans...');

    await addApiKeyToUsagePlan(publicUsagePlanId, publicApiKey.id);
    await addApiKeyToUsagePlan(authUsagePlanId, authApiKey.id);

    // Step 5: Add API stages to usage plans
    console.log('\n📍 Step 5: Adding API Stages to Usage Plans...');

    await addApiStageToUsagePlan(publicUsagePlanId, apiGatewayId, stage);
    await addApiStageToUsagePlan(authUsagePlanId, apiGatewayId, stage);

    // Step 6: Generate configuration file
    console.log('\n📍 Step 6: Generating Configuration...');

    const baseUrl = `https://${apiGatewayId}.execute-api.${region}.amazonaws.com/${stage}`;

    const envContent = `# API Gateway Rate Limiting Configuration for ${serviceName}-${stage}
# Generated on ${new Date().toISOString()}

# Public endpoints API key (no auth required)
PUBLIC_API_KEY=${publicApiKey.value}

# Authenticated endpoints API key (JWT required)
AUTHENTICATED_API_KEY=${authApiKey.value}

# API Gateway information
API_GATEWAY_ID=${apiGatewayId}
API_BASE_URL=${baseUrl}

# Usage Plan IDs
PUBLIC_USAGE_PLAN_ID=${publicUsagePlanId}
AUTHENTICATED_USAGE_PLAN_ID=${authUsagePlanId}

# Rate limits
PUBLIC_RATE_LIMIT=50
PUBLIC_BURST_LIMIT=100
PUBLIC_QUOTA_LIMIT=10000

AUTHENTICATED_RATE_LIMIT=100
AUTHENTICATED_BURST_LIMIT=200
AUTHENTICATED_QUOTA_LIMIT=50000
`;

    require('fs').writeFileSync(`.env.api-keys.${stage}`, envContent);
    console.log(`   ✅ Configuration saved to: .env.api-keys.${stage}`);

    // Step 7: Display summary
    console.log('\n🎉 Rate Limiting Setup Complete!');
    console.log('='.repeat(60));
    console.log();
    console.log('📋 CONFIGURATION SUMMARY:');
    console.log(`   API Gateway ID: ${apiGatewayId}`);
    console.log(`   Base URL: ${baseUrl}`);
    console.log();
    console.log('🔑 API KEYS:');
    console.log(`   Public: ${publicApiKey.value}`);
    console.log(`   Authenticated: ${authApiKey.value}`);
    console.log();
    console.log('⚡ RATE LIMITS:');
    console.log('   Public: 50 req/sec, 100 burst, 10,000/day');
    console.log('   Authenticated: 100 req/sec, 200 burst, 50,000/day');
    console.log();
    console.log('📖 NEXT STEPS:');
    console.log('1. Update your client applications to include X-API-Key header');
    console.log('2. Test the rate limiting with: npm run test:rate-limiting:dev');
    console.log('3. Update serverless.yml to add private: true to endpoints');
    console.log('4. Redeploy to enforce API key requirements');
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('1. Ensure you have deployed the base stack first');
    console.error('2. Check your AWS credentials and permissions');
    console.error('3. Verify API Gateway permissions for your user/role');
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  setupRateLimiting().catch(console.error);
}

module.exports = { setupRateLimiting };
