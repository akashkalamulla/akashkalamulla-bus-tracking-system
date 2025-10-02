# AWS IAM Setup for Bus Tracking System CI/CD

## Prerequisites
- AWS Account with appropriate permissions
- AWS CLI installed and configured (optional, for manual setup)

## 1. Create IAM Policy

### Option A: Using AWS Console
1. Go to IAM → Policies → Create policy
2. Select "JSON" tab
3. Copy the contents of `iam-policy.json`
4. Click "Next: Tags" → "Next: Review"
5. Name: `bus-tracking-system-deployment-policy`
6. Description: `Deployment permissions for bus tracking system`
7. Click "Create policy"

### Option B: Using AWS CLI
```bash
aws iam create-policy \
  --policy-name bus-tracking-system-deployment-policy \
  --policy-document file://iam-policy.json \
  --description "Deployment permissions for bus tracking system"
```

## 2. Create IAM User for CI/CD

### Option A: Using AWS Console
1. Go to IAM → Users → Add users
2. User name: `bus-tracking-system-cicd`
3. Select "Access key - Programmatic access"
4. Click "Next: Permissions"
5. Select "Attach existing policies directly"
6. Search for and select `bus-tracking-system-deployment-policy`
7. Click "Next: Tags" → "Next: Review" → "Create user"
8. **IMPORTANT**: Save the Access Key ID and Secret Access Key

### Option B: Using AWS CLI
```bash
# Create the user
aws iam create-user --user-name bus-tracking-system-cicd

# Attach the policy
aws iam attach-user-policy \
  --user-name bus-tracking-system-cicd \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/bus-tracking-system-deployment-policy

# Create access keys
aws iam create-access-key --user-name bus-tracking-system-cicd
```

## 3. Configure GitHub Secrets

In your GitHub repository:
1. Go to Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `AWS_ACCESS_KEY_ID`: The access key ID from step 2
   - `AWS_SECRET_ACCESS_KEY`: The secret access key from step 2
   - `AWS_REGION`: `ap-south-1` (Mumbai region)

## 4. Verify Setup

### Test AWS Credentials
```bash
# Set environment variables (replace with your actual keys)
export AWS_ACCESS_KEY_ID=your_access_key_id
export AWS_SECRET_ACCESS_KEY=your_secret_access_key
export AWS_REGION=ap-south-1

# Test basic permissions
aws sts get-caller-identity
aws cloudformation list-stacks --max-items 1
aws lambda list-functions --max-items 1
aws dynamodb list-tables --max-items 1
```

### Test Serverless Configuration
```bash
# Install dependencies
npm ci

# Validate serverless config
npx sls print --stage dev --region us-east-1

# Test deployment (dry run)
npx sls deploy --stage dev --region ap-south-1 --noDeploy
```

## 5. Troubleshooting

### Common Issues

#### "Access Denied" Errors
- Ensure the IAM policy is attached to the user
- Check that the policy JSON is valid (no syntax errors)
- Verify the AWS region matches

#### "Invalid Action" Errors
- The policy was updated to fix invalid actions
- Make sure you're using the latest `iam-policy.json`

#### Serverless Deployment Fails
- Check that all required environment variables are set
- Ensure the AWS credentials have the necessary permissions
- Verify the serverless.yml configuration is valid

#### GitHub Actions Failures
- Check that all secrets are properly configured
- Ensure the workflow file is in the correct location: `.github/workflows/deploy-dev.yml`
- Review the workflow logs for specific error messages

## 6. Security Best Practices

- **Rotate Access Keys**: Regularly rotate the CI/CD user's access keys
- **Least Privilege**: The policy follows least privilege principles
- **Monitor Usage**: Set up CloudTrail to monitor API usage
- **Restrict Regions**: Consider restricting to specific AWS regions if needed

## 7. Clean Up (if needed)

To remove the setup:
```bash
# Detach policy
aws iam detach-user-policy \
  --user-name bus-tracking-system-cicd \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/bus-tracking-system-deployment-policy

# Delete user
aws iam delete-user --user-name bus-tracking-system-cicd

# Delete policy (if not attached to other users)
aws iam delete-policy \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/bus-tracking-system-deployment-policy
```

## Support

If you encounter issues:
1. Check the GitHub Actions logs for detailed error messages
2. Verify AWS credentials and permissions
3. Ensure all files are properly committed and pushed
4. Review the troubleshooting section above

For additional help, check the AWS documentation or create an issue in the repository.