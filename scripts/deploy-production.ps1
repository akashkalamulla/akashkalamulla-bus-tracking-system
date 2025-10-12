# Production Deployment Command
# This will deploy all infrastructure to production

Write-Host "🚀 Deploying Bus Tracking System to Production" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""

# Configuration
$stage = "prod"
$region = "ap-south-1"

Write-Host "📋 Deployment Configuration:" -ForegroundColor Cyan
Write-Host "   Stage: $stage" -ForegroundColor White
Write-Host "   Region: $region" -ForegroundColor White
Write-Host ""

# Check AWS credentials
Write-Host "🔑 Checking AWS credentials..." -ForegroundColor Cyan
try {
    $identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "✅ Connected as: $($identity.Arn)" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS credentials not configured. Run 'aws configure' first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📦 This deployment will create:" -ForegroundColor Cyan
Write-Host "   ✅ All DynamoDB tables with production settings" -ForegroundColor Green
Write-Host "   ✅ Point-in-Time Recovery enabled" -ForegroundColor Green
Write-Host "   ✅ Deletion protection enabled" -ForegroundColor Green
Write-Host "   ✅ Proper indexing and TTL configuration" -ForegroundColor Green
Write-Host "   ✅ Production Lambda functions" -ForegroundColor Green
Write-Host "   ✅ API Gateway endpoints" -ForegroundColor Green
Write-Host ""

# Confirm deployment
Write-Host "⚠️  WARNING: This will deploy to PRODUCTION environment!" -ForegroundColor Yellow
$confirmation = Read-Host "Type 'DEPLOY' to continue or any other key to cancel"

if ($confirmation -ne "DEPLOY") {
    Write-Host "❌ Deployment cancelled." -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🚀 Starting production deployment..." -ForegroundColor Green
Write-Host ""

# Run serverless deploy
try {
    serverless deploy --stage $stage --region $region --verbose
    
    Write-Host ""
    Write-Host "🎉 Production deployment completed successfully!" -ForegroundColor Green
    Write-Host ""
    
    # List created tables
    Write-Host "📋 Verifying created tables..." -ForegroundColor Cyan
    aws dynamodb list-tables --region $region --query "TableNames[?contains(@, 'bus-tracking-system-prod')]" --output table
    
    Write-Host ""
    Write-Host "🔗 Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Set production JWT_SECRET: aws ssm put-parameter --name '/bus-tracking/prod/jwt-secret' --value 'YOUR_SECURE_SECRET' --type 'SecureString'" -ForegroundColor White
    Write-Host "2. Test endpoints with production URLs" -ForegroundColor White
    Write-Host "3. Set up monitoring and alarms" -ForegroundColor White
    Write-Host "4. Configure custom domain (optional)" -ForegroundColor White
    
} catch {
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check AWS credentials and permissions" -ForegroundColor White
    Write-Host "2. Verify serverless framework is installed" -ForegroundColor White
    Write-Host "3. Check for any syntax errors in serverless.yml" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "✅ Production infrastructure is ready!" -ForegroundColor Green