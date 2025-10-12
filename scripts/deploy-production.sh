# Simple Production Deployment Guide
# ==================================

# 1. Verify AWS CLI is configured
echo "Checking AWS CLI configuration..."
aws sts get-caller-identity

# 2. Deploy DynamoDB tables and infrastructure for production
echo ""
echo "Deploying production infrastructure..."
echo "This will create:"
echo "  ✅ All DynamoDB tables with production settings"
echo "  ✅ Point-in-Time Recovery enabled"
echo "  ✅ Deletion protection enabled"
echo "  ✅ Proper indexing and TTL"
echo ""

# Deploy to production stage
serverless deploy --stage prod --region ap-south-1

echo ""
echo "🎉 Production infrastructure deployed!"
echo ""
echo "Next steps:"
echo "1. Set production secrets (JWT_SECRET)"
echo "2. Test endpoints"
echo "3. Configure monitoring"
echo "4. Set up custom domain (optional)"