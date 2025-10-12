# Production Secrets Setup Script
# This script creates secure JWT secrets in AWS SSM Parameter Store for production deployment

Write-Host "🔐 Setting up Production Secrets" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
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
    $identity = aws sts get-caller-identity --output json 2>$null | ConvertFrom-Json
    Write-Host "✅ Connected as: $($identity.Arn)" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS credentials not configured. Run 'aws configure' first." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Generate secure JWT secret (64 characters with special characters)
Write-Host "🔐 Generating secure JWT secret..." -ForegroundColor Cyan
$jwtSecret = -join ((65..90) + (97..122) + (48..57) + @(33,35,36,37,38,42,43,45,61,63,64,94,95) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "✅ Generated 64-character secure JWT secret" -ForegroundColor Green

Write-Host ""
Write-Host "📝 Creating SSM Parameters..." -ForegroundColor Cyan
Write-Host ""

# Create JWT secret parameter
$paramName = "/$serviceName/$stage/jwt-secret"
Write-Host "Creating JWT secret parameter: $paramName" -ForegroundColor Yellow

try {
    # Check if parameter already exists
    $existing = aws ssm get-parameter --name $paramName --region $region 2>$null
    
    if ($existing) {
        Write-Host "Parameter already exists. Updating..." -ForegroundColor Yellow
        $result = aws ssm put-parameter --name $paramName --value $jwtSecret --type "SecureString" --description "JWT signing secret for production authentication" --overwrite --region $region 2>&1
    } else {
        Write-Host "Creating new parameter..." -ForegroundColor Yellow
        $result = aws ssm put-parameter --name $paramName --value $jwtSecret --type "SecureString" --description "JWT signing secret for production authentication" --region $region 2>&1
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ JWT secret created successfully" -ForegroundColor Green
        $success = $true
    } else {
        Write-Host "❌ Failed to create JWT secret: $result" -ForegroundColor Red
        $success = $false
    }
} catch {
    Write-Host "❌ Error creating JWT secret: $($_.Exception.Message)" -ForegroundColor Red
    $success = $false
}

Write-Host ""

# Summary
if ($success) {
    Write-Host "🎉 Production secrets configured successfully!" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "📋 Configured Parameters:" -ForegroundColor Cyan
    Write-Host "   ✅ JWT Secret: $paramName" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "🔍 Verification:" -ForegroundColor Cyan
    Write-Host "You can verify the parameter exists with:" -ForegroundColor White
    Write-Host "   aws ssm get-parameter --name '$paramName' --with-decryption --region $region" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Deploy your application: serverless deploy --stage $stage --region $region" -ForegroundColor White
    Write-Host "2. Your Lambda functions will automatically use these secure secrets" -ForegroundColor White
    Write-Host "3. The JWT_SECRET is now securely stored and encrypted in AWS" -ForegroundColor White
    
} else {
    Write-Host "❌ Secret configuration failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check AWS IAM permissions for SSM" -ForegroundColor White
    Write-Host "2. Verify AWS credentials are configured" -ForegroundColor White
    Write-Host "3. Ensure the AWS region is correct" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "🔒 Security Notes:" -ForegroundColor Yellow
Write-Host "• Secret is encrypted with AWS KMS" -ForegroundColor White
Write-Host "• Only your Lambda functions can access this value" -ForegroundColor White
Write-Host "• Secret is not visible in CloudFormation or serverless outputs" -ForegroundColor White
Write-Host "• Use 'aws ssm get-parameter --with-decryption' to view value" -ForegroundColor White

Write-Host ""
Write-Host "✅ Production secrets setup complete!" -ForegroundColor Green