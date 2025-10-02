# Security Guide — Bus Tracking System

This document summarizes the recommended security setup for the Bus Tracking System repository. It covers IAM user setup and permissions, GitHub Secrets configuration, local development security practices, environment variable management, credential rotation, and serverless deployment best practices.

The goal is to make deployments safe by applying the principle of least privilege and following strong operational security practices.

---

## 1) IAM user setup and permissions

Principle: grant only the minimum permissions required for the job (least privilege). Create separate IAM identities for different purposes (deploy user, CI, developers, monitoring).

Recommended identities:
- `ci-deployer` (used by GitHub Actions for deployments)
- `dev-user` (developer access for local testing; limited privileges)
- `infra-admin` (for infrastructure changes; very restricted and used sparingly)

Example approach:
- Create an IAM user for `ci-deployer` and attach a policy that only allows the specific Service actions required by Serverless Framework (CloudFormation, Lambda, API Gateway, S3, DynamoDB, IAM:PassRole for specific roles only, etc.). Do not attach AdministratorAccess.
- Use conditions and resource ARNs to narrow permissions (example: allow `iam:PassRole` only for the exact ARN(s) of the Lambda execution role(s) used by your `serverless.yml`).
- Require MFA for interactive users with elevated permissions.

Files in this repo to check and customize:
- `iam-policy.json` — review and replace any `"Resource": "*"` and `"Action": "iam:PassRole"` with service- and role-specific ARNs and `iam:PassedToService` conditions.
- `serverless.yml` — the `provider.iam`/`iam.role` and `provider.iam.role.statements` (or legacy `iamRoleStatements`) define the runtime role for Lambdas. Ensure those ARNs match what you grant the deployer to pass.

Example minimal `iam:PassRole` snippet (use in deployer policy):

```json
{
  "Effect": "Allow",
  "Action": "iam:PassRole",
  "Resource": "arn:aws:iam::123456789012:role/bus-tracking-system-dev-lambda-role",
  "Condition": {
    "StringEquals": { "iam:PassedToService": "lambda.amazonaws.com" }
  }
}
```

Notes on least privilege:
- Replace account numbers, role names, and ARNs with your actual values.
- Use `aws sts get-caller-identity` to confirm the account when crafting ARNs.
- Regularly run IAM Access Analyzer and the AWS IAM policy simulator to validate the expected effective permissions.

---

## 2) GitHub Secrets configuration

Store secrets in GitHub so workflows can access them securely (do not commit secrets to the repo).

Required secrets for CI/CD:
- `AWS_ACCESS_KEY_ID` (for the `ci-deployer` IAM user)
- `AWS_SECRET_ACCESS_KEY`
- Optionally `AWS_REGION` (if you prefer not to hard-code region in workflows)

Recommended GitHub Actions setup steps (UI):
1. Go to your repository → Settings → Secrets and variables → Actions → New repository secret.
2. Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
3. (Optional) Add `AWS_REGION` and any other private values (DB connection strings, third-party API keys).

Using GitHub CLI (optional):
```powershell
# Requires `gh` installed and authenticated
gh secret set AWS_ACCESS_KEY_ID --body "<value>"
gh secret set AWS_SECRET_ACCESS_KEY --body "<value>"
gh secret set AWS_REGION --body "ap-south-1"
```

Notes:
- Use repository-scoped secrets for repo-specific credentials, organization secrets for multi-repo shared credentials with appropriate restrictions.
- Prefer GitHub OIDC for short-lived ephemeral credentials where possible (no long-lived AWS keys). GitHub's `configure-aws-credentials` action supports OIDC.

---

## 3) Local development security practices

Do:
- Use the AWS CLI with named profiles (avoid modifying the default profile if you have multiple AWS accounts):
  ```powershell
  aws configure --profile dev
  ```
- Use the `.env.example` file as the template. Create a local `.env` in your machine only (and it is already ignored by `.gitignore`).
- For local DynamoDB use the local endpoint: `DYNAMODB_ENDPOINT=http://localhost:8000`.
- Keep development credentials in the AWS credentials file (`%USERPROFILE%\.aws\credentials`) or use environment variables in local shells — but never commit them.

Don't:
- Commit `.env` files containing credentials.
- Store AWS keys in source files, config repos, or public locations.

If you share a machine with other users, do not set user-level persistent credentials unless required; prefer session credentials or assume-role.

---

## 4) Environment variable management

Files and locations:
- `.env.example` — example template tracked in repo (safe to commit)
- `.env` — local dev values (must be in `.gitignore`)
- `%USERPROFILE%\\.aws\\credentials` and `%USERPROFILE%\\.aws\\config` — where `aws configure` stores named profiles on Windows

Best practices:
- Track only non-sensitive defaults in `.env.example` (region, hostnames). Example in this repo:
  ```text
  AWS_REGION=ap-south-1
  AWS_PROFILE=default
  DYNAMODB_ENDPOINT=http://localhost:8000
  REDIS_HOST=localhost
  REDIS_PORT=6379
  NODE_ENV=development
  LOG_LEVEL=debug
  ```
- Use secrets managers (AWS Secrets Manager or Parameter Store) for runtime secrets in production and grant Lambda access to read them through an IAM policy.
- Use the Serverless Framework's support for secure variables (secrets plugins or referencing SSM/Secrets Manager at deploy-time) instead of committing values.

---

## 5) Credential rotation procedures

Rotate keys regularly (e.g., every 90 days) and immediately after a suspected compromise.

Recommended rotation workflow for IAM user keys (manual steps):
1. Create a new access key for the IAM user in the AWS Console or via CLI.
2. Add the new key to GitHub Secrets (`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`) and confirm CI uses it successfully.
3. Remove the old key from GitHub Secrets and then delete the old key from IAM.
4. Document the rotation event in change control and notify the team.

Automated options:
- Use AWS IAM Access Keys rotation automation with AWS Secrets Manager and Lambda for automatic rotation.
- For CI best practice, prefer GitHub OIDC (no fixed AWS keys) or use short-lived role credentials.

Emergency procedure:
- Immediately revoke the compromised key in IAM (disable or delete access key), rotate keys, and inspect CloudTrail for suspicious activity.

---

## 6) Security best practices for serverless deployment

- Use the principle of least privilege for Lambda execution roles and deployer roles.
- Avoid `Resource: '*'` where possible. Use explicit ARNs and conditions. Example: limit DynamoDB table access to specific tables only.
- Use `iam:PassedToService` condition for `iam:PassRole` permissions.
- Keep functions small and single-purpose. Smaller functions reduce blast radius and scope of permissions.
- Use environment variables for non-sensitive configuration only. For secrets, use secured stores (SSM Parameter Store or Secrets Manager) and grant Lambdas permission to read them.
- Add monitoring and alerting: CloudWatch logs, alarms on error rates, and CloudTrail for API activity.
- Enable encryption at rest for DynamoDB (default) and ensure any S3 buckets used are encrypted and have appropriate bucket policies.
- Use VPCs carefully — only attach Lambda functions to a VPC when necessary; VPC attachment may require additional IAM and networking configuration.

---

## 7) Monitoring, auditing and compliance

- Enable CloudTrail across the account and configure logs to an S3 bucket with restricted access and lifecycle rules.
- Use AWS Config and GuardDuty for ongoing security posture and threat detection.
- Regularly run `npm audit`, `snyk` or similar scanning tools in CI for open-source dependency vulnerabilities.
- Periodically review IAM roles and policies (at least quarterly).

---

## 8) Quick checklist before deploying

- [ ] GitHub secrets configured for the `ci-deployer` account
- [ ] `iam-policy.json` reviewed and narrowed to explicit ARNs
- [ ] `.env` not committed and `.env.example` contains only non-sensitive defaults
- [ ] CloudTrail and monitoring configured in AWS account
- [ ] Test access with `aws sts get-caller-identity` and minimal AWS commands

---

## 9) Useful commands (PowerShell)

Check identity:
```powershell
aws sts get-caller-identity --profile dev
```
List DynamoDB tables (dev region example):
```powershell
aws dynamodb list-tables --region ap-south-1 --profile dev
```
Set up CLI profile:
```powershell
aws configure --profile dev
```
Add GitHub secret using `gh` (optional):
```powershell
gh secret set AWS_ACCESS_KEY_ID --body "<ACCESS_KEY>"
gh secret set AWS_SECRET_ACCESS_KEY --body "<SECRET_KEY>"
```

---

## 10) Principle of Least Privilege (PoLP) — applied

- Deploy-time role (`ci-deployer`) is restricted to only the CloudFormation/Lambda/DynamoDB/S3 actions necessary to create/update the resources defined in `serverless.yml`.
- Lambda runtime role is scoped to only the DynamoDB tables, Redis endpoints (if needed), and logs resources it must access.
- `iam:PassRole` is allowed only for the specific Lambda execution role ARN and limited to `lambda.amazonaws.com` as the service principal.
- Developer accounts use separate IAM users or assume-role patterns with limited privileges for day-to-day work; elevated operations are gated behind an approval process.

---

If you want, I can:
- Draft a minimal deployer IAM policy based on this repo's `serverless.yml` (I can parse `serverless.yml` to extract exact resource names/ARNS and produce a policy).
- Show the exact `gh` or AWS console steps for adding secrets and creating the `ci-deployer` user.
- Provide a PowerShell script to safely add `C:\Program Files\Amazon\AWSCLIV2` to the user PATH via the registry (avoiding `setx` truncation issues).

If you'd like the deployer policy drafted automatically, confirm and I will parse `serverless.yml` and create a minimal `iam-policy-ci.json` for you.