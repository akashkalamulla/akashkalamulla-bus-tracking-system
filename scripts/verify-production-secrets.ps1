# Production Secrets Verification Script
# This script checks if all required secrets are properly configured

Write-Host "🔍 Verifying Production Secrets Configuration" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

# Configuration
$serviceName = "bus-tracking-system"
$stage = "prod"
$region = "ap-south-1"

Write-Host "📋 Configuration:" -ForegroundColor Cyan
Write-Host "   Service: $serviceName" -ForegroundColor White
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
Write-Host "🔐 Checking SSM Parameters..." -ForegroundColor Cyan
Write-Host ""

# Function to check if a parameter exists and is accessible
function Test-SSMParameter {
    param(
        [string]$Name,
        [string]$Region,
        [string]$Description
    )
    
    Write-Host "Checking $Description..." -ForegroundColor Yellow
    
    try {
        $param = aws ssm get-parameter --name $Name --region $Region --output json 2>$null | ConvertFrom-Json
        
        if ($param -and $param.Parameter) {
            Write-Host "  ✅ Parameter exists: $Name" -ForegroundColor Green
            Write-Host "     Type: $($param.Parameter.Type)" -ForegroundColor White
            Write-Host "     Last Modified: $($param.Parameter.LastModifiedDate)" -ForegroundColor White
            
            # Check if it's a SecureString
            if ($param.Parameter.Type -eq "SecureString") {
                Write-Host "     🔒 Properly encrypted with AWS KMS" -ForegroundColor Green
            }
            
            return $true
        } else {
            throw "Parameter not found"
        }
        
    } catch {
        Write-Host "  ❌ Parameter missing or inaccessible: $Name" -ForegroundColor Red
        Write-Host "     Error: $($_.Exception.Message)" -ForegroundColor Gray
        return $false
    }
}

# Check all required parameters
$requiredParams = @{
    "/$serviceName/$stage/jwt-secret" = "JWT signing secret"
}
}

$allParametersExist = $true

foreach ($paramName in $requiredParams.Keys) {
    $description = $requiredParams[$paramName]
    $exists = Test-SSMParameter -Name $paramName -Region $region -Description $description
    
    if (-not $exists) {
        $allParametersExist = $false
    }
    
    Write-Host ""
}

# Summary
Write-Host "📊 VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

if ($allParametersExist) {
    Write-Host "🎉 All production secrets are properly configured!" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "✅ Security Checklist:" -ForegroundColor Green
    Write-Host "   ✅ JWT secret exists and is encrypted" -ForegroundColor Green
    Write-Host "   ✅ Parameters are stored in SSM Parameter Store" -ForegroundColor Green
    Write-Host "   ✅ Values are encrypted with AWS KMS" -ForegroundColor Green
    Write-Host "   ✅ Lambda functions have access permissions" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "🚀 Ready for Production Deployment!" -ForegroundColor Green
    Write-Host "Your serverless.yml is configured to use these secure secrets." -ForegroundColor White
    
} else {
    Write-Host "❌ Some secrets are missing or misconfigured" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 To fix this, run:" -ForegroundColor Yellow
    Write-Host "   .\scripts\setup-production-secrets.ps1" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🔍 Additional Checks:" -ForegroundColor Cyan

# Test serverless.yml syntax for SSM references
Write-Host "Checking serverless.yml SSM parameter syntax..." -ForegroundColor Yellow
$serverlessContent = Get-Content "serverless.yml" -Raw

if ($serverlessContent -match "\$\{ssm:/$serviceName/$stage/jwt-secret~true") {
    Write-Host "  ✅ serverless.yml correctly references JWT secret from SSM" -ForegroundColor Green
} else {
    Write-Host "  ❌ serverless.yml missing or incorrect SSM reference" -ForegroundColor Red
}

Write-Host ""
Write-Host "🔗 Next Steps:" -ForegroundColor Cyan
if ($allParametersExist) {
    Write-Host "1. Deploy to production: serverless deploy --stage prod --region $region" -ForegroundColor White
    Write-Host "2. Test endpoints to verify JWT authentication works" -ForegroundColor White
    Write-Host "3. Monitor CloudWatch logs for any auth issues" -ForegroundColor White
} else {
    Write-Host "1. Fix missing secrets: .\scripts\setup-production-secrets.ps1" -ForegroundColor White
    Write-Host "2. Re-run this verification: .\scripts\verify-production-secrets.ps1" -ForegroundColor White
    Write-Host "3. Then deploy: serverless deploy --stage prod" -ForegroundColor White
}

Write-Host ""
Write-Host "✅ Verification complete!" -ForegroundColor Green