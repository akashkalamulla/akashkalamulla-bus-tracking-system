# PowerShell script to set up API Gateway rate limiting
# Usage: .\setup-rate-limiting.ps1

Write-Host "🚀 Setting up API Gateway Rate Limiting" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green

# Configuration
$serviceName = "bus-tracking-system"
$stage = "dev"
$region = "ap-south-1"
$apiId = "zcmux4xvg0"

Write-Host "API Gateway ID: $apiId" -ForegroundColor Yellow
Write-Host "Stage: $stage" -ForegroundColor Yellow
Write-Host "Region: $region" -ForegroundColor Yellow
Write-Host ""

try {
    # Step 1: Create Public Usage Plan
    Write-Host "📋 Step 1: Creating Public Usage Plan..." -ForegroundColor Cyan
    $publicUsagePlan = aws apigateway create-usage-plan `
        --name "$serviceName-public-api-$stage" `
        --description "Rate limiting for public GET endpoints" `
        --throttle "burstLimit=100,rateLimit=50" `
        --quota "limit=10000,period=DAY" `
        --region $region | ConvertFrom-Json

    $publicUsagePlanId = $publicUsagePlan.id
    Write-Host "✅ Public Usage Plan created: $publicUsagePlanId" -ForegroundColor Green

    # Step 2: Create Authenticated Usage Plan
    Write-Host "📋 Step 2: Creating Authenticated Usage Plan..." -ForegroundColor Cyan
    $authUsagePlan = aws apigateway create-usage-plan `
        --name "$serviceName-authenticated-api-$stage" `
        --description "Rate limiting for authenticated endpoints" `
        --throttle "burstLimit=200,rateLimit=100" `
        --quota "limit=50000,period=DAY" `
        --region $region | ConvertFrom-Json

    $authUsagePlanId = $authUsagePlan.id
    Write-Host "✅ Authenticated Usage Plan created: $authUsagePlanId" -ForegroundColor Green

    # Step 3: Associate Usage Plans with API Gateway Stage
    Write-Host "📋 Step 3: Associating Usage Plans with API Gateway..." -ForegroundColor Cyan
    
    aws apigateway create-usage-plan-key `
        --usage-plan-id $publicUsagePlanId `
        --key-type "API_STAGE" `
        --key-id "$apiId/$stage" `
        --region $region | Out-Null

    aws apigateway create-usage-plan-key `
        --usage-plan-id $authUsagePlanId `
        --key-type "API_STAGE" `
        --key-id "$apiId/$stage" `
        --region $region | Out-Null

    Write-Host "✅ Usage Plans associated with API Gateway" -ForegroundColor Green

    # Step 4: Create API Keys
    Write-Host "📋 Step 4: Creating API Keys..." -ForegroundColor Cyan
    
    $publicApiKey = aws apigateway create-api-key `
        --name "$serviceName-public-key-$stage" `
        --description "API Key for public endpoints rate limiting" `
        --enabled `
        --region $region | ConvertFrom-Json

    $authApiKey = aws apigateway create-api-key `
        --name "$serviceName-auth-key-$stage" `
        --description "API Key for authenticated endpoints rate limiting" `
        --enabled `
        --region $region | ConvertFrom-Json

    Write-Host "✅ API Keys created:" -ForegroundColor Green
    Write-Host "   Public API Key: $($publicApiKey.id)" -ForegroundColor Yellow
    Write-Host "   Auth API Key: $($authApiKey.id)" -ForegroundColor Yellow

    # Step 5: Associate API Keys with Usage Plans
    Write-Host "📋 Step 5: Associating API Keys with Usage Plans..." -ForegroundColor Cyan
    
    aws apigateway create-usage-plan-key `
        --usage-plan-id $publicUsagePlanId `
        --key-type "API_KEY" `
        --key-id $publicApiKey.id `
        --region $region | Out-Null

    aws apigateway create-usage-plan-key `
        --usage-plan-id $authUsagePlanId `
        --key-type "API_KEY" `
        --key-id $authApiKey.id `
        --region $region | Out-Null

    Write-Host "✅ API Keys associated with Usage Plans" -ForegroundColor Green

    # Step 6: Display Results
    Write-Host ""
    Write-Host "🎉 Rate Limiting Setup Complete!" -ForegroundColor Green
    Write-Host "=================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 CONFIGURATION SUMMARY:" -ForegroundColor Cyan
    Write-Host "API Gateway ID: $apiId" -ForegroundColor White
    Write-Host "Base URL: https://$apiId.execute-api.$region.amazonaws.com/$stage" -ForegroundColor White
    Write-Host ""
    Write-Host "🔑 PUBLIC ENDPOINTS:" -ForegroundColor Cyan
    Write-Host "Usage Plan ID: $publicUsagePlanId" -ForegroundColor White
    Write-Host "API Key ID: $($publicApiKey.id)" -ForegroundColor White
    Write-Host "API Key Value: $($publicApiKey.value)" -ForegroundColor Yellow
    Write-Host "Rate Limits: 50 req/sec, 100 burst, 10,000/day" -ForegroundColor White
    Write-Host ""
    Write-Host "🔒 AUTHENTICATED ENDPOINTS:" -ForegroundColor Cyan
    Write-Host "Usage Plan ID: $authUsagePlanId" -ForegroundColor White
    Write-Host "API Key ID: $($authApiKey.id)" -ForegroundColor White
    Write-Host "API Key Value: $($authApiKey.value)" -ForegroundColor Yellow
    Write-Host "Rate Limits: 100 req/sec, 200 burst, 50,000/day" -ForegroundColor White
    Write-Host ""

    # Step 7: Create environment file
    $envContent = @"
# API Gateway Configuration for $serviceName-$stage
# Generated on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# Public endpoints API key (no auth required)
PUBLIC_API_KEY=$($publicApiKey.value)

# Authenticated endpoints API key (JWT required)
AUTHENTICATED_API_KEY=$($authApiKey.value)

# API Gateway base URL
API_BASE_URL=https://$apiId.execute-api.$region.amazonaws.com/$stage

# Usage Plan IDs
PUBLIC_USAGE_PLAN_ID=$publicUsagePlanId
AUTH_USAGE_PLAN_ID=$authUsagePlanId

# Rate limits
PUBLIC_RATE_LIMIT=50
PUBLIC_BURST_LIMIT=100
PUBLIC_QUOTA_LIMIT=10000

AUTHENTICATED_RATE_LIMIT=100
AUTHENTICATED_BURST_LIMIT=200
AUTHENTICATED_QUOTA_LIMIT=50000
"@

    $envFile = ".env.api-keys.$stage"
    $envContent | Out-File -FilePath $envFile -Encoding UTF8
    Write-Host "📄 Environment file saved: $envFile" -ForegroundColor Green
    Write-Host ""

    # Step 8: Usage Instructions
    Write-Host "📖 USAGE INSTRUCTIONS:" -ForegroundColor Cyan
    Write-Host "======================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "For PUBLIC endpoints:" -ForegroundColor Yellow
    Write-Host "curl -H 'X-API-Key: $($publicApiKey.value)' \\" -ForegroundColor White
    Write-Host "     https://$apiId.execute-api.$region.amazonaws.com/$stage/public/routes" -ForegroundColor White
    Write-Host ""
    Write-Host "For AUTHENTICATED endpoints:" -ForegroundColor Yellow
    Write-Host "curl -H 'X-API-Key: $($authApiKey.value)' \\" -ForegroundColor White
    Write-Host "     -H 'Authorization: Bearer YOUR_JWT_TOKEN' \\" -ForegroundColor White
    Write-Host "     https://$apiId.execute-api.$region.amazonaws.com/$stage/buses/BUS123/location" -ForegroundColor White
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Update your client applications to include the X-API-Key header!" -ForegroundColor Red

} catch {
    Write-Host "❌ Error setting up rate limiting: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please check your AWS credentials and permissions." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ Setup completed successfully!" -ForegroundColor Green