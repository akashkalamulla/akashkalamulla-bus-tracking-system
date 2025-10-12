# Production Deployment Script
Write-Host "🚀 Production Deployment Script" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green
Write-Host ""

# Configuration
$stackName = "bus-tracking-system-prod"
$region = "ap-south-1"

Write-Host "📋 Checking CloudFormation stack status..." -ForegroundColor Cyan

# Check if stack exists
try {
    $stackStatus = aws cloudformation describe-stacks --stack-name $stackName --region $region --query "Stacks[0].StackStatus" --output text 2>$null
    
    if ($stackStatus) {
        Write-Host "   Current status: $stackStatus" -ForegroundColor Yellow
        
        # If stack is in a rollback or failed state, remove it
        if ($stackStatus -like "*ROLLBACK*" -or $stackStatus -like "*FAILED*") {
            Write-Host "   Stack is in failed state, attempting to remove..." -ForegroundColor Yellow
            
            # Wait for rollback to complete if necessary
            $waitCount = 0
            while ($stackStatus -like "*IN_PROGRESS*" -and $waitCount -lt 30) {
                Write-Host "   Waiting for rollback cleanup to complete... ($waitCount/30)" -ForegroundColor Yellow
                Start-Sleep -Seconds 10
                $stackStatus = aws cloudformation describe-stacks --stack-name $stackName --region $region --query "Stacks[0].StackStatus" --output text 2>$null
                $waitCount++
            }
            
            # Try to remove the stack
            if ($stackStatus -notlike "*IN_PROGRESS*") {
                Write-Host "   Removing failed stack..." -ForegroundColor Yellow
                npx serverless remove --stage prod --region $region
                Write-Host "   Stack removed successfully" -ForegroundColor Green
            } else {
                Write-Host "   ❌ Stack is still in progress, cannot remove automatically" -ForegroundColor Red
                Write-Host "   Please wait for CloudFormation operations to complete and try again" -ForegroundColor Red
                exit 1
            }
        }
    }
} catch {
    Write-Host "   No existing stack found, proceeding with fresh deployment" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Starting production deployment..." -ForegroundColor Green
Write-Host ""

# Deploy to production
try {
    npx serverless deploy --stage prod --region $region
    Write-Host ""
    Write-Host "✅ Production deployment completed successfully!" -ForegroundColor Green
    
    # Get the API Gateway endpoint
    Write-Host ""
    Write-Host "📡 Getting production endpoint..." -ForegroundColor Cyan
    $endpoints = npx serverless info --stage prod --region $region
    Write-Host $endpoints
    
} catch {
    Write-Host ""
    Write-Host "❌ Production deployment failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Production deployment process completed!" -ForegroundColor Green