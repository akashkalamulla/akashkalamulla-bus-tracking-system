# Enhanced Data Loading Script Documentation

## Overview

The enhanced `scripts/load-data.js` script provides robust, production-ready data loading capabilities for the bus tracking system with comprehensive error handling, retry logic, and performance optimizations.

## Features

### ✅ **Core Functionality**
- **AWS SDK v3 Support**: Latest AWS SDK with improved performance
- **Batch Writing**: Efficient DynamoDB batch operations (25 items per batch)
- **Multi-Environment Support**: Local DynamoDB and AWS stages
- **Flexible Data Sources**: Individual files or consolidated simulation data

### ✅ **Enhanced Error Handling**
- **Retry Logic**: Configurable retry attempts with exponential backoff
- **Unprocessed Items**: Automatic handling of DynamoDB unprocessed items
- **Comprehensive Logging**: Detailed error messages and troubleshooting guidance
- **Graceful Degradation**: Continues processing even if some operations fail

### ✅ **Performance Features**
- **Progress Reporting**: Real-time progress updates during large operations
- **Performance Metrics**: Timing and throughput statistics
- **Throttling Protection**: Built-in delays to prevent API throttling
- **Memory Optimization**: Efficient data processing and cleanup

### ✅ **Configuration Management**
- **Environment Variables**: Table names from environment or auto-generation
- **Stage-Based Configuration**: Different settings for dev/staging/prod
- **Dry Run Mode**: Test configuration without writing data
- **Flexible Parameters**: Command-line argument parsing

## Usage Examples

### Basic Usage

```bash
# Local development with DynamoDB Local
node scripts/load-data.js --local

# AWS development environment
node scripts/load-data.js --stage dev

# AWS staging environment
node scripts/load-data.js --stage staging

# AWS production environment
node scripts/load-data.js --stage prod
```

### Advanced Usage

```bash
# Dry run to test configuration
node scripts/load-data.js --dry-run

# Dry run for specific stage
node scripts/load-data.js --stage prod --dry-run

# Local development with validation
node scripts/load-data.js --local --dry-run
```

## Environment Variables

The script supports the following environment variables:

```bash
# Table names (if not set, auto-generated from stage)
ROUTES_TABLE=bus-tracking-system-dev-routes
BUSES_TABLE=bus-tracking-system-dev-buses
LIVE_LOCATIONS_TABLE=bus-tracking-system-dev-live-locations
SCHEDULES_TABLE=bus-tracking-system-dev-schedules

# AWS configuration
AWS_REGION=ap-south-1
```

## Data Sources

### Primary: simulation-data.json
```json
{
  "routes": [...],
  "buses": [...],
  "schedules": [...],
  "liveLocations": [...]
}
```

### Fallback: Individual Files
- `routes.json`
- `buses.json`
- `schedules.json`
- `live-locations.json`

## Configuration Options

```javascript
const CONFIG = {
  dataDir: 'data',           // Data files directory
  batchSize: 25,             // DynamoDB batch limit
  maxRetries: 3,             // Maximum retry attempts
  retryDelayMs: 1000,        // Base retry delay
  progressInterval: 5,       // Progress reporting frequency
  region: 'ap-south-1'       // Default AWS region
};
```

## Error Handling

### Automatic Retry Scenarios
- Network timeouts
- Throttling errors
- Temporary service unavailability
- Unprocessed items

### Permanent Failure Scenarios
- Invalid credentials
- Missing tables
- Malformed data
- Permission errors

### Troubleshooting

The script provides comprehensive troubleshooting guidance:

1. **Data Files**: Verify files exist in `data/` directory
2. **Tables**: Ensure DynamoDB tables are created
3. **Credentials**: Configure AWS credentials properly
4. **Local DynamoDB**: Start local service for `--local` flag
5. **Network**: Check connectivity to AWS
6. **Permissions**: Verify IAM permissions for DynamoDB

## Performance Optimization

### Batch Processing
- **Optimal Batch Size**: 25 items (DynamoDB limit)
- **Parallel Processing**: Independent table operations
- **Memory Management**: Efficient data chunking

### Throttling Prevention
- **Request Spacing**: 100ms delays between batches
- **Exponential Backoff**: Progressive retry delays
- **Unprocessed Items**: Automatic retry handling

### Monitoring
- **Progress Tracking**: Real-time batch completion status
- **Performance Metrics**: Items/second throughput
- **Error Rates**: Failed vs successful operations

## Security Best Practices

### Credential Management
- Use IAM roles instead of access keys
- Implement least privilege access
- Rotate credentials regularly

### Network Security
- Enable VPC endpoints for private communication
- Use encryption at rest and in transit
- Monitor access patterns with CloudTrail

### Data Protection
- Validate data before writing
- Use DynamoDB backup and restore
- Implement point-in-time recovery

## Integration Examples

### Serverless Framework
```yaml
environment:
  ROUTES_TABLE: !Ref RoutesTable
  BUSES_TABLE: !Ref BusesTable
  LIVE_LOCATIONS_TABLE: !Ref LiveLocationsTable
```

### CI/CD Pipeline
```bash
# Deploy infrastructure
npm run deploy:dev

# Load test data
node scripts/load-data.js --stage dev

# Verify data
npm run test:integration
```

### Development Workflow
```bash
# Generate fresh data
node scripts/generate-data.js

# Start local DynamoDB
npm run dynamodb:start

# Load data locally
node scripts/load-data.js --local

# Test application
npm run dev
```

## Testing

### Unit Tests
```bash
# Test data validation
node scripts/test-load-data.js

# Test specific scenarios
node scripts/test-load-data.js testDataValidation
```

### Integration Tests
```bash
# Dry run validation
node scripts/load-data.js --dry-run

# Local integration test
node scripts/load-data.js --local --dry-run
```

## Monitoring and Logging

### Console Output
- **Environment Configuration**: Table names and settings
- **Progress Updates**: Batch completion status
- **Performance Metrics**: Timing and throughput data
- **Error Details**: Comprehensive error information

### CloudWatch Integration
- **DynamoDB Metrics**: Read/write capacity utilization
- **Error Rates**: Failed request monitoring
- **Performance Tracking**: Latency and throughput metrics

## Production Considerations

### Capacity Planning
- **Provisioned Mode**: Use for predictable workloads
- **On-Demand Mode**: Use for variable workloads
- **Auto Scaling**: Configure for dynamic capacity

### Monitoring
- **CloudWatch Alarms**: Set up for throttling and errors
- **Performance Baselines**: Establish normal operation metrics
- **Capacity Monitoring**: Track utilization patterns

### Backup Strategy
- **Point-in-Time Recovery**: Enable for production tables
- **Regular Backups**: Schedule automated backups
- **Cross-Region Replication**: Consider for disaster recovery

## Troubleshooting Guide

### Common Issues

1. **Connection Errors**
   ```bash
   # Check AWS credentials
   aws sts get-caller-identity
   
   # Test DynamoDB access
   aws dynamodb list-tables --region ap-south-1
   ```

2. **Permission Errors**
   ```bash
   # Verify IAM permissions
   aws iam simulate-principal-policy --policy-source-arn <role-arn> --action-names dynamodb:BatchWriteItem
   ```

3. **Local DynamoDB Issues**
   ```bash
   # Start local DynamoDB
   npm run dynamodb:start
   
   # Verify local connection
   aws dynamodb list-tables --endpoint-url http://localhost:8000
   ```

### Support and Maintenance

- **Logs**: Check console output for detailed error information
- **Documentation**: Refer to AWS DynamoDB documentation
- **Community**: Search AWS forums for similar issues
- **Support**: Contact AWS support for production issues