# Production Monitoring Validation Script
Write-Host "🔍 Validating Production Monitoring Setup" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

# Configuration
$serviceName = "bus-tracking-system"
$stage = "production"
$region = "ap-south-1"

Write-Host "📋 Checking monitoring components..." -ForegroundColor Cyan
Write-Host ""

# Check if CloudWatch alarms exist
Write-Host "🚨 Validating CloudWatch Alarms:" -ForegroundColor Cyan
$alarmNames = @(
    "$serviceName-$stage-lambda-error-rate",
    "$serviceName-$stage-api-4xx-errors", 
    "$serviceName-$stage-api-5xx-errors",
    "$serviceName-$stage-lambda-duration",
    "$serviceName-$stage-dynamodb-throttles"
)

foreach ($alarmName in $alarmNames) {
    try {
        $alarm = aws cloudwatch describe-alarms --alarm-names $alarmName --region $region --query "MetricAlarms[0].AlarmName" --output text 2>$null
        if ($alarm -eq $alarmName) {
            Write-Host "   ✅ $alarmName" -ForegroundColor Green
        } else {
            Write-Host "   ❌ $alarmName (not found)" -ForegroundColor Red
        }
    } catch {
        Write-Host "   ❌ $alarmName (error checking)" -ForegroundColor Red
    }
}

Write-Host ""

# Check CloudWatch Dashboard
Write-Host "📊 Validating CloudWatch Dashboard:" -ForegroundColor Cyan
$dashboardName = "$serviceName-$stage-monitoring"
try {
    $dashboard = aws cloudwatch get-dashboard --dashboard-name $dashboardName --region $region --query "DashboardName" --output text 2>$null
    if ($dashboard -eq $dashboardName) {
        Write-Host "   ✅ Dashboard: $dashboardName" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Dashboard: $dashboardName (not found)" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Dashboard: $dashboardName (error checking)" -ForegroundColor Red
}

Write-Host ""

# Check SNS Topic
Write-Host "📧 Validating SNS Topic:" -ForegroundColor Cyan
$topicName = "$serviceName-$stage-error-alarms"
try {
    $topics = aws sns list-topics --region $region --query "Topics[?contains(TopicArn, '$topicName')].TopicArn" --output text
    if ($topics) {
        Write-Host "   ✅ SNS Topic: $topicName" -ForegroundColor Green
        Write-Host "   Topic ARN: $topics" -ForegroundColor Gray
    } else {
        Write-Host "   ❌ SNS Topic: $topicName (not found)" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ SNS Topic: $topicName (error checking)" -ForegroundColor Red
}

Write-Host ""

# Check Lambda Log Groups
Write-Host "📝 Validating Lambda Log Groups:" -ForegroundColor Cyan
$functionNames = @("health", "publicGetRoutes", "adminGetRoutes", "adminCreateRoute")
foreach ($functionName in $functionNames) {
    $logGroupName = "/aws/lambda/$serviceName-$stage-$functionName"
    try {
        $logGroup = aws logs describe-log-groups --log-group-name-prefix $logGroupName --region $region --query "logGroups[0].logGroupName" --output text 2>$null
        if ($logGroup -eq $logGroupName) {
            Write-Host "   ✅ $functionName log group" -ForegroundColor Green
        } else {
            Write-Host "   ❌ $functionName log group (not found)" -ForegroundColor Red
        }
    } catch {
        Write-Host "   ❌ $functionName log group (error checking)" -ForegroundColor Red
    }
}

Write-Host ""

# Test X-Ray tracing
Write-Host "🔍 Validating X-Ray Tracing:" -ForegroundColor Cyan
$prodUrl = "https://s8gu5u156h.execute-api.ap-south-1.amazonaws.com/$stage"
Write-Host "   Testing endpoint to generate X-Ray traces..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$prodUrl/health" -Method GET
    Write-Host "   ✅ Health endpoint call successful (trace should be visible in X-Ray)" -ForegroundColor Green
    Write-Host "   Response: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠️  Health endpoint call failed (will still generate traces)" -ForegroundColor Yellow
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""

# Summary
Write-Host "📊 Monitoring Validation Summary:" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔗 Quick Links:" -ForegroundColor Green
Write-Host "   CloudWatch Console: https://console.aws.amazon.com/cloudwatch/home?region=$region" -ForegroundColor Blue
Write-Host "   X-Ray Console: https://console.aws.amazon.com/xray/home?region=$region" -ForegroundColor Blue
Write-Host "   Lambda Console: https://console.aws.amazon.com/lambda/home?region=$region" -ForegroundColor Blue

Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Yellow
Write-Host "   • Wait 5-10 minutes for metrics to appear in CloudWatch" -ForegroundColor White
Write-Host "   • X-Ray traces may take a few minutes to show up" -ForegroundColor White
Write-Host "   • Subscribe to SNS topic for email notifications" -ForegroundColor White

Write-Host ""
Write-Host "✅ Monitoring validation completed!" -ForegroundColor Green