# Serverless.yml Configuration Fixes

## Issues Fixed

### 1. **Missing Environment Variables**
- ✅ Added `LIVE_LOCATIONS_TABLE` environment variable
- ✅ Added proper Redis host/port configuration for all stages

### 2. **Incomplete IAM Permissions**
- ✅ Added CloudWatch Logs permissions for Lambda logging
- ✅ Added batch operations for DynamoDB (BatchGetItem, BatchWriteItem)
- ✅ Added permissions for all DynamoDB tables and indexes

### 3. **Missing DynamoDB Tables**
- ✅ Added `LiveLocationsTable` with proper schema and streams
- ✅ Configured streams for both `LocationsTable` and `LiveLocationsTable`

### 4. **Broken Redis Configuration**
- ✅ Fixed Redis endpoint references (removed invalid `!GetAtt` syntax)
- ✅ Added staging environment configuration
- ✅ Added production Redis ElastiCache cluster with VPC

### 5. **Missing VPC Configuration**
- ✅ Added complete VPC setup for production (VPC, subnets, security groups, internet gateway)
- ✅ Added conditional deployment (VPC only for production)
- ✅ Configured Lambda functions to use VPC when in production

### 6. **Lambda Function Issues**
- ✅ Fixed DynamoDB stream ARN reference in `cacheInvalidator`
- ✅ Added proper descriptions and starting positions for streams
- ✅ Added memory and timeout configurations

### 7. **GitHub Actions Compatibility**
- ✅ Ensured all environment variables are properly referenced
- ✅ Added staging environment support
- ✅ Made VPC configuration optional for development

## New Resources Added

### DynamoDB Tables:
- `RoutesTable`: Route information storage
- `BusesTable`: Bus information storage
- `LocationsTable`: Historical location data with TTL and GSI
- `LiveLocationsTable`: Real-time location data with streams

### Production Resources (Conditional):
- `RedisCluster`: ElastiCache Redis cluster
- `VPC`: Virtual Private Cloud
- `InternetGateway`: Internet access for VPC
- `PublicSubnet1/2`: Public subnets
- `PrivateSubnet1/2`: Private subnets for Lambda and Redis
- `LambdaSecurityGroup`: Security group for Lambda functions
- `RedisSecurityGroup`: Security group for Redis cluster

## Environment Variables

```yaml
ROUTES_TABLE: bus-tracking-system-{stage}-routes
BUSES_TABLE: bus-tracking-system-{stage}-buses
LOCATIONS_TABLE: bus-tracking-system-{stage}-locations
LIVE_LOCATIONS_TABLE: bus-tracking-system-{stage}-live-locations
REDIS_HOST: localhost (dev/staging) | RedisCluster (prod)
REDIS_PORT: 6379 (dev/staging) | RedisPort (prod)
NODE_ENV: {stage}
```

## Deployment Stages

- **dev**: Local Redis, no VPC, DynamoDB Local
- **staging**: Local Redis, no VPC
- **prod**: ElastiCache Redis, full VPC, production resources

## Lambda Functions

1. **getRoutes**: GET /routes - List all routes
2. **getRoute**: GET /routes/{routeId} - Get specific route
3. **updateLocation**: PUT /buses/{busId}/location - Update bus location
4. **healthCheck**: GET /status/ping - Health check
5. **cacheInvalidator**: DynamoDB stream processor for cache invalidation

## Security Features

- ✅ VPC isolation for production
- ✅ Security groups for Redis and Lambda
- ✅ Minimal IAM permissions (principle of least privilege)
- ✅ Conditional resource deployment
- ✅ Proper CloudWatch logging permissions

## GitHub Actions Integration

The configuration is now fully compatible with GitHub Actions deployment:

- Environment variables properly reference secrets
- Conditional resource deployment prevents dev environment issues
- All required permissions are included in the IAM policy
- VPC configuration is optional for development

## Next Steps

1. **Test locally**: Run `serverless offline` for development
2. **Deploy to dev**: `serverless deploy --stage dev`
3. **Test staging**: `serverless deploy --stage staging`
4. **Deploy to prod**: `serverless deploy --stage prod` (creates VPC and Redis)

## Troubleshooting

### Common Issues:
- **VPC Errors in Dev**: VPC resources only deploy in production
- **Redis Connection**: Use localhost for dev/staging, ElastiCache endpoint for prod
- **IAM Permissions**: Ensure the deployment user has all required permissions
- **Stream Processing**: Check DynamoDB stream configuration and Lambda event sources