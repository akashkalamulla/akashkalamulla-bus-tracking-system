# Simple Production Deployment Script
Write-Host "Production Deployment Script" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green
Write-Host ""

# Configuration
$stackName = "bus-tracking-system-prod"
$region = "ap-south-1"

Write-Host "Checking CloudFormation stack status..." -ForegroundColor Cyan

# Check current stack status
$stackStatus = aws cloudformation describe-stacks --stack-name $stackName --region $region --query "Stacks[0].StackStatus" --output text 2>$null

if ($stackStatus) {
    Write-Host "Current status: $stackStatus" -ForegroundColor Yellow
    
    if ($stackStatus -like "*ROLLBACK*" -or $stackStatus -like "*FAILED*") {
        Write-Host "Stack is in failed state. Please manually delete from AWS Console and try again." -ForegroundColor Red
        Write-Host "AWS Console URL: https://ap-south-1.console.aws.amazon.com/cloudformation/" -ForegroundColor Cyan
        exit 1
    }
} else {
    Write-Host "No existing stack found, proceeding with fresh deployment" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting production deployment..." -ForegroundColor Green
Write-Host ""

# Deploy to production
npx serverless deploy --stage prod --region $region

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Production deployment completed successfully!" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Getting production endpoint..." -ForegroundColor Cyan
    npx serverless info --stage prod --region $region
} else {
    Write-Host ""
    Write-Host "Production deployment failed" -ForegroundColor Red
}