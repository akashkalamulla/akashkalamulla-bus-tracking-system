Write-Host "Setting up production secrets..." -ForegroundColor Green

$serviceName = "bus-tracking-system"
$stage = "prod"
$region = "ap-south-1"

# Check AWS credentials
Write-Host "Checking AWS credentials..."
try {
    $identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "Connected as: $($identity.Arn)"
} catch {
    Write-Host "AWS credentials not configured. Run 'aws configure' first."
    exit 1
}

# Generate JWT secret
Write-Host "Generating JWT secret..."
$chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&*+-=?@^_"
$jwtSecret = ""
for ($i = 0; $i -lt 64; $i++) {
    $jwtSecret += $chars[(Get-Random -Maximum $chars.Length)]
}

# Create SSM parameter
$paramName = "/$serviceName/$stage/jwt-secret"
Write-Host "Creating parameter: $paramName"

$result = aws ssm put-parameter --name $paramName --value $jwtSecret --type "SecureString" --description "JWT signing secret for production" --overwrite --region $region 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: JWT secret created in SSM Parameter Store" -ForegroundColor Green
    Write-Host "Parameter name: $paramName"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "1. Deploy: serverless deploy --stage $stage --region $region"
    Write-Host "2. Your Lambda functions will use this secure secret"
} else {
    Write-Host "ERROR: Failed to create parameter" -ForegroundColor Red
    Write-Host $result
}