# AWS Setup Instructions for Bus Tracking System

## Prerequisites
- AWS Account with appropriate permissions
- GitHub repository with admin access

## Step 1: Create IAM Policy

1. Go to AWS IAM Console: https://console.aws.amazon.com/iam/
2. Navigate to **Policies** → **Create policy**
3. Select **JSON** tab
4. Copy the entire contents of `iam-policy.json` from this repository
5. Click **Next: Tags** (optional)
6. Click **Next: Review**
7. Name: `bus-tracking-system-deploy-policy`
8. Description: `Policy for deploying bus tracking system via GitHub Actions`
9. Click **Create policy**

## Step 2: Create IAM User

1. Go to AWS IAM Console → **Users** → **Create user**
2. User name: `bus-tracking-system-deployer`
3. Select **Provide user access to the AWS Management Console** (optional)
4. Click **Next**
5. Select **Attach policies directly**
6. Search for and select: `bus-tracking-system-deploy-policy`
7. Click **Next**
8. Click **Create user**

## Step 3: Create Access Keys

1. From the IAM Users list, click on `bus-tracking-system-deployer`
2. Go to **Security credentials** tab
3. Under **Access keys**, click **Create access key**
4. Select **Command Line Interface (CLI)**
5. Check the confirmation box
6. Click **Create access key**
7. **IMPORTANT**: Save the Access Key ID and Secret Access Key securely
   - You cannot retrieve the Secret Access Key later!

## Step 4: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

### Required Secrets for Development/Production:
```
AWS_ACCESS_KEY_ID = <your-access-key-id>
AWS_SECRET_ACCESS_KEY = <your-secret-access-key>
AWS_REGION = us-east-1
```

### Optional: Separate Production Credentials
If you want different credentials for production:
```
AWS_ACCESS_KEY_ID_PROD = <prod-access-key-id>
AWS_SECRET_ACCESS_KEY_PROD = <prod-secret-access-key>
```

## Step 5: Verify Setup

1. Go to **Actions** tab in your GitHub repository
2. The workflow should automatically trigger on push to main/master
3. Or manually trigger via **Workflow dispatch**
4. Check the deployment logs for any permission errors

## Troubleshooting

### Common Issues:

1. **"Access Denied" errors**:
   - Verify the IAM policy is correctly attached to the user
   - Check that the policy JSON is valid

2. **"Credentials not found" in GitHub Actions**:
   - Ensure secrets are named exactly as specified
   - Check that secrets are set at repository level (not organization)

3. **"Region not found" errors**:
   - Verify AWS_REGION secret is set
   - Default region is us-east-1 if not specified

4. **Serverless deployment fails**:
   - Check CloudFormation permissions in the policy
   - Ensure the AWS account has enough resources (Lambda functions, etc.)

## Security Best Practices

- ✅ Use IAM user with minimal required permissions
- ✅ Store credentials as GitHub secrets (never in code)
- ✅ Rotate access keys regularly
- ✅ Use different credentials for different environments
- ✅ Monitor AWS CloudTrail for suspicious activity
- ✅ Enable MFA on your AWS account

## Policy Permissions Explained

The IAM policy includes permissions for:

- **CloudFormation**: Stack management for infrastructure
- **Lambda**: Function creation, updates, and management
- **API Gateway**: REST API and deployment management
- **DynamoDB**: Table operations, streams, and indexes
- **IAM**: Role and policy management for Lambda execution
- **CloudWatch Logs**: Logging and monitoring
- **S3**: Static asset storage (if needed)
- **STS**: Credential validation and session management

## Environment Variables

The deployment uses these environment variables:
- `NODE_VERSION`: Node.js version (18)
- `AWS_REGION`: AWS region for deployment
- `STAGE`: Deployment stage (dev, staging, prod)