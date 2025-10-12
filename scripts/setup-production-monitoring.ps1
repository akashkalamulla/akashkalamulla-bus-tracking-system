# Production Monitoring Setup Script
Write-Host "🔍 Setting up Production Monitoring & Logging" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

# Configuration
$serviceName = "bus-tracking-system"
$stage = "production"
$region = "ap-south-1"

Write-Host "📋 Configuration:" -ForegroundColor Cyan
Write-Host "   Service: $serviceName" -ForegroundColor White
Write-Host "   Stage: $stage" -ForegroundColor White
Write-Host "   Region: $region" -ForegroundColor White
Write-Host ""

# Deploy updated serverless configuration with monitoring
Write-Host "🚀 Deploying with enhanced monitoring..." -ForegroundColor Cyan
try {
    npx serverless deploy --config serverless-production.yml --stage $stage --region $region
    Write-Host "✅ Deployment completed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📊 Monitoring Features Enabled:" -ForegroundColor Cyan
Write-Host "   ✅ X-Ray distributed tracing" -ForegroundColor Green
Write-Host "   ✅ CloudWatch logs with 30-day retention" -ForegroundColor Green
Write-Host "   ✅ API Gateway execution logging" -ForegroundColor Green
Write-Host "   ✅ CloudWatch alarms for errors and performance" -ForegroundColor Green
Write-Host "   ✅ CloudWatch dashboard for metrics visualization" -ForegroundColor Green
Write-Host "   ✅ SNS topic for error notifications" -ForegroundColor Green

Write-Host ""
Write-Host "🔔 CloudWatch Alarms Configured:" -ForegroundColor Cyan
Write-Host "   • Lambda error rate (>= 5 errors in 10 minutes)" -ForegroundColor White
Write-Host "   • API Gateway 4xx errors (>= 10 in 5 minutes)" -ForegroundColor White
Write-Host "   • API Gateway 5xx errors (>= 1 in 5 minutes)" -ForegroundColor White
Write-Host "   • Lambda duration (>= 25 seconds average)" -ForegroundColor White
Write-Host "   • DynamoDB throttling (>= 1 throttled request)" -ForegroundColor White

Write-Host ""
Write-Host "📈 Accessing Monitoring Resources:" -ForegroundColor Cyan
Write-Host "   Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=$region#dashboards:name=$serviceName-$stage-monitoring" -ForegroundColor Blue
Write-Host "   Alarms: https://console.aws.amazon.com/cloudwatch/home?region=$region#alarmsV2:" -ForegroundColor Blue
Write-Host "   X-Ray: https://console.aws.amazon.com/xray/home?region=$region#/service-map" -ForegroundColor Blue
Write-Host "   Logs: https://console.aws.amazon.com/cloudwatch/home?region=$region#logsV2:log-groups" -ForegroundColor Blue

Write-Host ""
Write-Host "🧪 Testing Monitoring Setup:" -ForegroundColor Cyan

# Test health endpoint to generate metrics
$prodUrl = "https://s8gu5u156h.execute-api.ap-south-1.amazonaws.com/$stage"
Write-Host "   Testing health endpoint to generate metrics..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$prodUrl/health" -Method GET
    Write-Host "   ✅ Health check successful: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "   This will generate error metrics for monitoring" -ForegroundColor Gray
}

Write-Host ""
Write-Host "📝 Monitoring Best Practices:" -ForegroundColor Cyan
Write-Host "   1. Check the CloudWatch dashboard regularly" -ForegroundColor White
Write-Host "   2. Review X-Ray traces for performance bottlenecks" -ForegroundColor White
Write-Host "   3. Monitor CloudWatch logs for application errors" -ForegroundColor White
Write-Host "   4. Set up SNS email notifications for critical alarms" -ForegroundColor White
Write-Host "   5. Review and adjust alarm thresholds based on usage patterns" -ForegroundColor White

Write-Host ""
Write-Host "🔧 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Subscribe to SNS topic for email alerts:" -ForegroundColor White
Write-Host "      aws sns subscribe --topic-arn 'arn:aws:sns:$region:YOUR_ACCOUNT:$serviceName-$stage-error-alarms' --protocol email --notification-endpoint your-email@domain.com" -ForegroundColor Gray
Write-Host "   2. Customize dashboard widgets based on your needs" -ForegroundColor White
Write-Host "   3. Set up log insights queries for detailed analysis" -ForegroundColor White

Write-Host ""
Write-Host "✅ Production monitoring setup completed!" -ForegroundColor Green