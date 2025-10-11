# 🚀 Quick Start: API Gateway Rate Limiting

## 📋 Summary

✅ **IMPLEMENTED**: API Gateway Usage Plans for rate limiting
- Public endpoints: 50 req/sec, 100 burst, 10,000/day
- Authenticated endpoints: 100 req/sec, 200 burst, 50,000/day

## 🎯 Quick Commands

### 1. Deploy with Rate Limiting
```powershell
# Deploy to development
serverless deploy --stage dev --region ap-south-1

# Deploy to production
serverless deploy --stage prod --region ap-south-1
```

### 2. Get API Keys
```powershell
# Get API keys for development
npm run api-keys:dev

# Get API keys for production  
npm run api-keys:prod
```

### 3. Test Rate Limiting
```powershell
# Test rate limiting in development
npm run test:rate-limiting:dev

# Test rate limiting in production
npm run test:rate-limiting:prod
```

## 📖 Usage Examples

### Public Endpoints (No Auth, API Key Required)
```bash
curl -H "X-API-Key: YOUR_PUBLIC_API_KEY" \
     https://your-api-id.execute-api.ap-south-1.amazonaws.com/dev/public/routes
```

### Authenticated Endpoints (JWT + API Key Required)
```bash
curl -X PUT \
     -H "X-API-Key: YOUR_AUTH_API_KEY" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"latitude":6.9271,"longitude":79.8612}' \
     https://your-api-id.execute-api.ap-south-1.amazonaws.com/dev/buses/BUS123/location
```

## 🔧 What Changed

### serverless.yml
- Added Usage Plans and API Keys in `resources` section
- Added `private: true` to public endpoints
- Added CloudFormation outputs for API keys

### Rate Limits Applied To:
- ✅ `GET /public/routes`
- ✅ `GET /public/routes/{id}`
- ✅ `GET /public/routes/{id}/buses/live`
- ✅ `GET /routes`
- ✅ `GET /routes/{id}` 

### Scripts Added:
- ✅ `scripts/get-api-keys.js` - Retrieve API keys
- ✅ `scripts/test-rate-limiting.js` - Test rate limiting
- ✅ `docs/RATE_LIMITING_IMPLEMENTATION.md` - Full documentation

## ⚡ Rate Limits

| Endpoint Type | Rate/sec | Burst | Daily Quota |
|---------------|----------|-------|-------------|
| Public | 50 | 100 | 10,000 |
| Authenticated | 100 | 200 | 50,000 |

## 🚨 Error Codes

- **403 Forbidden**: Missing or invalid API key
- **429 Too Many Requests**: Rate limit exceeded
- **429 Limit Exceeded**: Daily quota exceeded

## 📄 Files to Ignore in Git

Add to `.gitignore`:
```
.env.api-keys.*
```

## 🔍 Monitoring

Check AWS Console:
1. **API Gateway** → **Usage Plans**
2. **CloudWatch** → **API Gateway Metrics**

## 💡 Next Steps

1. **Deploy**: Run deployment to create Usage Plans
2. **Get Keys**: Use script to retrieve API keys  
3. **Update Clients**: Add `X-API-Key` header to requests
4. **Test**: Verify rate limiting works
5. **Monitor**: Check usage in AWS Console

---

📚 **Full documentation**: `docs/RATE_LIMITING_IMPLEMENTATION.md`