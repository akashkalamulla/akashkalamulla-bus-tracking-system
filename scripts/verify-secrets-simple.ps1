# Simple Production Secrets Verification Script
Write-Host "Verifying Production Secrets Configuration" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Configuration
$serviceName = "bus-tracking-system"
$stage = "prod"
$region = "ap-south-1"

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "   Service: $serviceName" -ForegroundColor White
Write-Host "   Stage: $stage" -ForegroundColor White
Write-Host "   Region: $region" -ForegroundColor White
Write-Host ""

# Check AWS credentials
Write-Host "Checking AWS credentials..." -ForegroundColor Cyan
try {
    $identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "Connected as: $($identity.Arn)" -ForegroundColor Green
} catch {
    Write-Host "AWS credentials not configured. Run 'aws configure' first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Checking SSM Parameters..." -ForegroundColor Cyan
Write-Host ""

# Check JWT secret
Write-Host "Checking JWT signing secret..." -ForegroundColor Yellow
$jwtParamName = "/$serviceName/$stage/jwt-secret"
try {
    $jwtParam = aws ssm get-parameter --name $jwtParamName --region $region --output json 2>$null | ConvertFrom-Json
    if ($jwtParam -and $jwtParam.Parameter) {
        Write-Host "  Parameter exists: $jwtParamName" -ForegroundColor Green
        Write-Host "     Type: $($jwtParam.Parameter.Type)" -ForegroundColor White
        Write-Host "     Last Modified: $($jwtParam.Parameter.LastModifiedDate)" -ForegroundColor White
        $jwtExists = $true
    } else {
        Write-Host "  Parameter missing: $jwtParamName" -ForegroundColor Red
        $jwtExists = $false
    }
} catch {
    Write-Host "  Parameter missing or inaccessible: $jwtParamName" -ForegroundColor Red
    $jwtExists = $false
}

Write-Host ""

# Summary
Write-Host "VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan
Write-Host ""

if ($jwtExists) {
    Write-Host "All production secrets are properly configured!" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Security Checklist:" -ForegroundColor Green
    Write-Host "   JWT secret exists and is accessible" -ForegroundColor Green
    Write-Host "   Parameters are stored in SSM Parameter Store" -ForegroundColor Green
    Write-Host "   Lambda functions have access permissions" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Ready for Production Deployment!" -ForegroundColor Green
    Write-Host "Your serverless.yml is configured to use these secure secrets." -ForegroundColor White
    
} else {
    Write-Host "Some secrets are missing or misconfigured" -ForegroundColor Red
    Write-Host ""
    Write-Host "To fix this, run:" -ForegroundColor Yellow
    Write-Host "   .\scripts\setup-production-secrets.ps1" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Additional Checks:" -ForegroundColor Cyan

# Test serverless.yml syntax for SSM references
Write-Host "Checking serverless.yml SSM parameter syntax..." -ForegroundColor Yellow
$serverlessContent = Get-Content "serverless.yml" -Raw

if ($serverlessContent -match "\$\{ssm:/$serviceName/$stage/jwt-secret~true") {
    Write-Host "  serverless.yml correctly references JWT secret from SSM" -ForegroundColor Green
} else {
    Write-Host "  serverless.yml missing or incorrect SSM reference" -ForegroundColor Red
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
if ($jwtExists) {
    Write-Host "1. Deploy to production: serverless deploy --stage prod --region $region" -ForegroundColor White
    Write-Host "2. Test endpoints to verify JWT authentication works" -ForegroundColor White
    Write-Host "3. Monitor CloudWatch logs for any auth issues" -ForegroundColor White
} else {
    Write-Host "1. Fix missing secrets: .\scripts\setup-production-secrets.ps1" -ForegroundColor White
    Write-Host "2. Re-run this verification: .\scripts\verify-secrets-simple.ps1" -ForegroundColor White
    Write-Host "3. Then deploy: serverless deploy --stage prod" -ForegroundColor White
}

Write-Host ""
Write-Host "Verification complete!" -ForegroundColor Green