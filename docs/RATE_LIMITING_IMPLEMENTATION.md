# API Gateway Rate Limiting Implementation

## Overview

This document describes the API Gateway Usage Plans implementation for rate limiting in the Bus Tracking System API.

## ✅ Implementation Status

**COMPLETE**: API Gateway Usage Plans have been implemented with the following components:

### 1. Usage Plans Configuration

#### Public Endpoints Usage Plan
- **Rate Limit**: 50 requests/second (3,000 per minute)
- **Burst Limit**: 100 concurrent requests
- **Quota**: 10,000 requests per day
- **Applies to**: Public endpoints that don't require JWT authentication

#### Authenticated Endpoints Usage Plan
- **Rate Limit**: 100 requests/second (6,000 per minute)
- **Burst Limit**: 200 concurrent requests
- **Quota**: 50,000 requests per day
- **Applies to**: Endpoints that require JWT authentication

### 2. API Keys

Two API keys are automatically created:
- **Public API Key**: For rate limiting public endpoints
- **Authenticated API Key**: For rate limiting authenticated endpoints

### 3. Protected Endpoints

#### Public Endpoints (require `X-API-Key` header):
- `GET /public/routes`
- `GET /public/routes/{routeId}`
- `GET /public/routes/{routeId}/buses/live`
- `GET /public/routes/search`
- `GET /public/stats`
- `GET /routes`
- `GET /routes/{routeId}`

#### Authenticated Endpoints (require both `X-API-Key` and `Authorization` headers):
- All operator endpoints (`PUT /buses/{busId}/location`, etc.)
- All admin endpoints

## 📋 Manual Configuration Steps

### Step 1: Deploy the Updated Configuration

```powershell
# Deploy to development
serverless deploy --stage dev --region ap-south-1

# Or deploy to staging/production
serverless deploy --stage staging --region ap-south-1
serverless deploy --stage prod --region ap-south-1
```

### Step 2: Retrieve API Keys

Use the provided script to get your API keys:

```powershell
# Get API keys for development
node scripts/get-api-keys.js dev ap-south-1

# Get API keys for staging
node scripts/get-api-keys.js staging ap-south-1

# Get API keys for production
node scripts/get-api-keys.js prod ap-south-1
```

This will:
- Display the API keys in the console
- Create an environment file (e.g., `.env.api-keys.dev`)
- Show usage examples

### Step 3: Update Client Applications

#### For Public Endpoints (No Authentication)

```javascript
// JavaScript/Node.js example
const response = await fetch('https://your-api-id.execute-api.ap-south-1.amazonaws.com/dev/public/routes', {
  headers: {
    'X-API-Key': 'your-public-api-key',
    'Content-Type': 'application/json'
  }
});
```

```bash
# cURL example
curl -H "X-API-Key: your-public-api-key" \
     https://your-api-id.execute-api.ap-south-1.amazonaws.com/dev/public/routes
```

#### For Authenticated Endpoints (JWT Required)

```javascript
// JavaScript/Node.js example
const response = await fetch('https://your-api-id.execute-api.ap-south-1.amazonaws.com/dev/buses/BUS123/location', {
  method: 'PUT',
  headers: {
    'X-API-Key': 'your-authenticated-api-key',
    'Authorization': 'Bearer your-jwt-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    latitude: 6.9271,
    longitude: 79.8612,
    timestamp: new Date().toISOString()
  })
});
```

```bash
# cURL example
curl -X PUT \
     -H "X-API-Key: your-authenticated-api-key" \
     -H "Authorization: Bearer your-jwt-token" \
     -H "Content-Type: application/json" \
     -d '{"latitude":6.9271,"longitude":79.8612,"timestamp":"2025-10-06T10:00:00Z"}' \
     https://your-api-id.execute-api.ap-south-1.amazonaws.com/dev/buses/BUS123/location
```

### Step 4: Distribute API Keys

#### For Development/Testing
- Share the public API key with frontend developers
- Share both keys with backend developers
- Include keys in your CI/CD environment variables

#### For Production
- **Public API Key**: Can be embedded in frontend applications (it's meant to be public)
- **Authenticated API Key**: Should be stored securely in backend services only
- Consider creating additional usage plans for different client tiers

### Step 5: Monitor Usage

You can monitor API key usage in the AWS Console:

1. Go to **API Gateway Console**
2. Navigate to your API
3. Click on **Usage Plans**
4. Select a usage plan to view usage statistics
5. Monitor throttling and quota exceeded events

## 🔧 Configuration Details

### CloudFormation Resources Added

The following resources were added to `serverless.yml`:

```yaml
resources:
  Resources:
    # Public endpoints usage plan
    PublicApiUsagePlan:
      Type: AWS::ApiGateway::UsagePlan
      
    # Authenticated endpoints usage plan  
    AuthenticatedApiUsagePlan:
      Type: AWS::ApiGateway::UsagePlan
      
    # API Keys
    PublicApiKey:
      Type: AWS::ApiGateway::ApiKey
      
    AuthenticatedApiKey:
      Type: AWS::ApiGateway::ApiKey
      
    # Usage plan associations
    PublicApiUsagePlanKey:
      Type: AWS::ApiGateway::UsagePlanKey
      
    AuthenticatedApiUsagePlanKey:
      Type: AWS::ApiGateway::UsagePlanKey
```

### Function Configuration Changes

All public endpoints now include:
```yaml
events:
  - http:
      path: public/routes
      method: get
      cors: true
      private: true  # Requires API key
```

## 🚨 Important Notes

### Rate Limiting Behavior

1. **Throttling**: When rate limits are exceeded, API Gateway returns HTTP 429 (Too Many Requests)
2. **Quota**: When daily quotas are exceeded, requests are blocked until quota resets
3. **Burst**: Short bursts above the rate limit are allowed up to the burst limit

### Error Responses

#### Missing API Key
```json
{
  "message": "Forbidden"
}
```
Status: 403 Forbidden

#### Rate Limit Exceeded
```json
{
  "message": "Too Many Requests"
}
```
Status: 429 Too Many Requests

#### Quota Exceeded
```json
{
  "message": "Limit Exceeded"
}
```
Status: 429 Too Many Requests

### Cost Implications

- API Gateway charges for API calls
- Usage plans add minimal cost overhead
- Monitor costs in AWS Cost Explorer

## 🔍 Testing Rate Limits

### Test Rate Limiting

```bash
# Install Apache Bench for testing
# Windows: Download from Apache website
# Linux/Mac: apt-get install apache2-utils or brew install httpie

# Test public endpoint rate limiting (50 req/sec limit)
ab -n 100 -c 10 -H "X-API-Key: your-public-api-key" \
   "https://your-api-id.execute-api.ap-south-1.amazonaws.com/dev/public/routes"

# Test burst limit (100 concurrent requests)
ab -n 200 -c 150 -H "X-API-Key: your-public-api-key" \
   "https://your-api-id.execute-api.ap-south-1.amazonaws.com/dev/public/routes"
```

### Verify Implementation

1. **Without API Key**: Should return 403 Forbidden
2. **With Valid API Key**: Should work normally
3. **Exceeding Rate Limit**: Should return 429 Too Many Requests
4. **Check CloudWatch**: Monitor API Gateway metrics

## 📚 Related Documentation

- [AWS API Gateway Usage Plans](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html)
- [API Gateway Throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html)
- [Serverless Framework API Gateway Events](https://www.serverless.com/framework/docs/providers/aws/events/apigateway/)

## ✅ Verification Checklist

- [ ] API Gateway Usage Plans created in AWS Console
- [ ] API Keys generated and accessible
- [ ] Public endpoints require X-API-Key header
- [ ] Authenticated endpoints require both X-API-Key and Authorization headers
- [ ] Rate limiting works (429 errors when exceeded)
- [ ] Client applications updated with API keys
- [ ] Monitoring set up for usage tracking
- [ ] Documentation distributed to development teams