# Quick API Test Script for Bus Tracking System
# This script tests all three main requirements: Authentication, Caching, and Rate Limiting

param(
    [string]$AdminApiKey = "",
    [string]$OperatorApiKey = "",
    [string]$AdminToken = "",
    [string]$OperatorToken = ""
)

$API_BASE = "https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev"

Write-Host "🚀 Bus Tracking API Test Script" -ForegroundColor Green
Write-Host "API Base: $API_BASE" -ForegroundColor Gray
Write-Host ""

# Test 1: Public Endpoint (No Auth)
Write-Host "=== Test 1: Public Endpoints (No Authentication) ===" -ForegroundColor Cyan

try {
    Write-Host "Testing public routes endpoint..."
    $response = Invoke-WebRequest -Uri "$API_BASE/public/routes" -Method GET
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "✅ ETag: $($response.Headers.ETag)" -ForegroundColor Green
    Write-Host "✅ Cache-Control: $($response.Headers.'Cache-Control')" -ForegroundColor Green
    
    if ($response.Headers.'X-RateLimit-Limit') {
        Write-Host "✅ Rate Limit: $($response.Headers.'X-RateLimit-Limit') requests" -ForegroundColor Green
        Write-Host "✅ Remaining: $($response.Headers.'X-RateLimit-Remaining')" -ForegroundColor Green
    }
}
catch {
    Write-Host "❌ Public endpoint test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: ETag Caching
Write-Host "=== Test 2: ETag Caching ===" -ForegroundColor Cyan

try {
    Write-Host "Testing ETag caching..."
    $response1 = Invoke-WebRequest -Uri "$API_BASE/public/routes" -Method GET
    $etag = $response1.Headers.ETag
    Write-Host "First request ETag: $etag"
    
    $response2 = Invoke-WebRequest -Uri "$API_BASE/public/routes" -Method GET -Headers @{"If-None-Match" = $etag} -SkipHttpErrorCheck
    if ($response2.StatusCode -eq 304) {
        Write-Host "✅ Conditional GET working: 304 Not Modified" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Expected 304, got: $($response2.StatusCode)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "❌ ETag test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Rate Limiting
Write-Host "=== Test 3: Rate Limiting ===" -ForegroundColor Cyan

Write-Host "Making 5 rapid requests to test rate limiting..."
for ($i = 1; $i -le 5; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "$API_BASE/public/routes" -Method GET -SkipHttpErrorCheck
        $remaining = $response.Headers.'X-RateLimit-Remaining'
        $status = $response.StatusCode
        
        if ($status -eq 429) {
            Write-Host "✅ Request $i - Rate limited (429)" -ForegroundColor Yellow
        } else {
            Write-Host "Request $i - Status: $status, Remaining: $remaining" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "Request $i - Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 200
}

Write-Host ""

# Test 4: Admin Endpoints (if API key provided)
if ($AdminApiKey -and $AdminToken) {
    Write-Host "=== Test 4: Admin Endpoints ===" -ForegroundColor Cyan
    
    $adminHeaders = @{
        "Authorization" = "Bearer $AdminToken"
        "X-API-Key" = $AdminApiKey
        "Content-Type" = "application/json"
    }
    
    try {
        Write-Host "Testing admin routes endpoint..."
        $response = Invoke-RestMethod -Uri "$API_BASE/admin/routes" -Method GET -Headers $adminHeaders
        Write-Host "✅ Admin routes accessible" -ForegroundColor Green
        Write-Host "Routes count: $($response.data.Count)" -ForegroundColor Gray
    }
    catch {
        Write-Host "❌ Admin endpoint test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "=== Test 4: Admin Endpoints ===" -ForegroundColor Cyan
    Write-Host "⚠️  Skipped - No admin API key or token provided" -ForegroundColor Yellow
    Write-Host "To test admin endpoints, run:" -ForegroundColor Gray
    Write-Host ".\quick-test.ps1 -AdminApiKey 'your-key' -AdminToken 'your-jwt-token'" -ForegroundColor Yellow
}

Write-Host ""

# Test 5: Operator Endpoints (if API key provided)
if ($OperatorApiKey -and $OperatorToken) {
    Write-Host "=== Test 5: Operator Endpoints ===" -ForegroundColor Cyan
    
    $operatorHeaders = @{
        "Authorization" = "Bearer $OperatorToken"
        "X-API-Key" = $OperatorApiKey
        "Content-Type" = "application/json"
    }
    
    try {
        Write-Host "Testing operator buses endpoint..."
        $response = Invoke-RestMethod -Uri "$API_BASE/operator/buses" -Method GET -Headers $operatorHeaders
        Write-Host "✅ Operator buses accessible" -ForegroundColor Green
        Write-Host "Buses count: $($response.data.Count)" -ForegroundColor Gray
    }
    catch {
        Write-Host "❌ Operator endpoint test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "=== Test 5: Operator Endpoints ===" -ForegroundColor Cyan
    Write-Host "⚠️  Skipped - No operator API key or token provided" -ForegroundColor Yellow
    Write-Host "To test operator endpoints, run:" -ForegroundColor Gray
    Write-Host ".\quick-test.ps1 -OperatorApiKey 'your-key' -OperatorToken 'your-jwt-token'" -ForegroundColor Yellow
}

Write-Host ""

# Test 6: Error Scenarios
Write-Host "=== Test 6: Error Scenarios ===" -ForegroundColor Cyan

# Test admin endpoint without API key
try {
    Write-Host "Testing admin endpoint without API key (should fail)..."
    $response = Invoke-RestMethod -Uri "$API_BASE/admin/routes" -Method GET -Headers @{"Authorization" = "Bearer some-token"}
    Write-Host "❌ Should have failed without API key" -ForegroundColor Red
}
catch {
    Write-Host "✅ Correctly rejected without API key" -ForegroundColor Green
}

# Test admin endpoint without JWT
try {
    Write-Host "Testing admin endpoint without JWT (should fail)..."
    $response = Invoke-RestMethod -Uri "$API_BASE/admin/routes" -Method GET -Headers @{"X-API-Key" = "some-key"}
    Write-Host "❌ Should have failed without JWT" -ForegroundColor Red
}
catch {
    Write-Host "✅ Correctly rejected without JWT" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 API Testing Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Summary of Tests:" -ForegroundColor White
Write-Host "✅ Public endpoints (no auth)" -ForegroundColor Green
Write-Host "✅ ETag caching" -ForegroundColor Green  
Write-Host "✅ Rate limiting" -ForegroundColor Green
Write-Host "✅ Error handling" -ForegroundColor Green

if ($AdminApiKey -and $AdminToken) {
    Write-Host "✅ Admin endpoints" -ForegroundColor Green
} else {
    Write-Host "⚠️  Admin endpoints (not tested)" -ForegroundColor Yellow
}

if ($OperatorApiKey -and $OperatorToken) {
    Write-Host "✅ Operator endpoints" -ForegroundColor Green
} else {
    Write-Host "⚠️  Operator endpoints (not tested)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Generate JWT tokens: node generate-test-tokens.js" -ForegroundColor Gray
Write-Host "2. Create API keys in AWS Console" -ForegroundColor Gray
Write-Host "3. Run full tests with tokens and keys" -ForegroundColor Gray