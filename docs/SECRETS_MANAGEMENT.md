# 🔐 Secrets Management

Complete guide for managing secrets and configuration across all environments.

---

## Overview

ContainrLab uses different secrets management strategies for each environment:

| Environment | Storage | Access Method |
|-------------|---------|---------------|
| **Local Development** | Files in `compose/secrets/` | Docker secrets mount |
| **AWS Production** | AWS SSM Parameter Store | IAM roles |
| **GitHub Actions** | GitHub Secrets | Workflow environment variables |

**Security Principles:**
- ✅ Never commit secrets to Git
- ✅ Use encrypted storage (SSM, GitHub Secrets)
- ✅ Principle of least privilege (IAM roles)
- ✅ Rotate credentials regularly

---

## Local Development Secrets

### Storage Location

**Directory:** `compose/secrets/`

**Gitignored:** Yes (entire directory in `.gitignore`)

**Structure:**
```
compose/secrets/
├── GITHUB_CLIENT_ID.txt
├── GITHUB_CLIENT_SECRET.txt
├── NEXTAUTH_SECRET.txt
└── GEMINI_API_KEY.txt
```

---

### Required Secrets

#### 1. GitHub OAuth Credentials

**Purpose:** Authenticate users via GitHub OAuth

**Get credentials:**
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in details:
   - **Application name:** ContainrLab Local
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Copy **Client ID** and **Client Secret**

**Create secret files:**
```bash
cd compose/secrets

# GitHub OAuth Client ID
echo "your-github-client-id" > GITHUB_CLIENT_ID.txt

# GitHub OAuth Client Secret
echo "your-github-client-secret" > GITHUB_CLIENT_SECRET.txt
```

---

#### 2. NextAuth Secret

**Purpose:** Encrypt session tokens and cookies

**Generate:**
```bash
# Generate random 32-byte hex string
openssl rand -hex 32 > compose/secrets/NEXTAUTH_SECRET.txt
```

**Example:**
```
a7f3c8e9b2d4f6a1c5e7d9b3f8a2c6e4d1f5b9a7c3e8d2f6a4c1e9b7d5f3a8c6
```

---

#### 3. Gemini API Key (Optional)

**Purpose:** AI-powered hints and explanations

**Get API key:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key

**Create secret file:**
```bash
echo "your-gemini-api-key" > compose/secrets/GEMINI_API_KEY.txt
```

**If omitted:** System will use stub responses (no AI features)

---

### Docker Compose Configuration

**How secrets are used:**

```yaml
services:
  api:
    secrets:
      - GITHUB_CLIENT_ID
      - GITHUB_CLIENT_SECRET
      - GEMINI_API_KEY
    environment:
      GITHUB_CLIENT_ID_FILE: /run/secrets/GITHUB_CLIENT_ID
      GITHUB_CLIENT_SECRET_FILE: /run/secrets/GITHUB_CLIENT_SECRET

secrets:
  GITHUB_CLIENT_ID:
    file: ./secrets/GITHUB_CLIENT_ID.txt
  GITHUB_CLIENT_SECRET:
    file: ./secrets/GITHUB_CLIENT_SECRET.txt
```

**Backend reads secrets:**
```python
# backend/config.py
def load_secret(name: str) -> str:
    secret_file = os.getenv(f"{name}_FILE")
    if secret_file and os.path.exists(secret_file):
        with open(secret_file) as f:
            return f.read().strip()
    return os.getenv(name, "")
```

**[→ Complete local setup guide](LOCAL_SETUP.md)**

---

## AWS Production Secrets

### Storage: SSM Parameter Store

**Namespace:** `/containrlab/*`

**Encryption:** AWS KMS (default key)

**Access:** IAM role-based (no keys in code)

---

### Required Parameters

#### Configuration Parameters

| Parameter | Type | Value | Purpose |
|-----------|------|-------|---------|
| `/containrlab/SESSION_TTL_SECONDS` | String | `1800` | Session timeout (30 min) |

#### Secret Parameters

| Parameter | Type | Purpose |
|-----------|------|---------|
| `/containrlab/GITHUB_CLIENT_ID` | SecureString | GitHub OAuth app ID |
| `/containrlab/GITHUB_CLIENT_SECRET` | SecureString | GitHub OAuth secret |
| `/containrlab/NEXTAUTH_SECRET` | SecureString | NextAuth.js encryption key |
| `/containrlab/GEMINI_API_KEY` | SecureString | Google Gemini AI key |

---

### Creating Parameters

#### Via AWS CLI

**Set configuration parameter:**
```bash
aws ssm put-parameter \
  --name /containrlab/SESSION_TTL_SECONDS \
  --value "1800" \
  --type String \
  --region us-east-1
```

**Set secret parameters:**
```bash
# GitHub OAuth
aws ssm put-parameter \
  --name /containrlab/GITHUB_CLIENT_ID \
  --value "your-github-client-id" \
  --type SecureString \
  --region us-east-1

aws ssm put-parameter \
  --name /containrlab/GITHUB_CLIENT_SECRET \
  --value "your-github-client-secret" \
  --type SecureString \
  --region us-east-1

# NextAuth secret (generate random)
aws ssm put-parameter \
  --name /containrlab/NEXTAUTH_SECRET \
  --value "$(openssl rand -hex 32)" \
  --type SecureString \
  --region us-east-1

# Gemini API key (optional)
aws ssm put-parameter \
  --name /containrlab/GEMINI_API_KEY \
  --value "your-gemini-api-key" \
  --type SecureString \
  --region us-east-1
```

---

#### Via AWS Console

1. Go to [AWS Systems Manager](https://console.aws.amazon.com/systems-manager/)
2. Click **Parameter Store** in left menu
3. Click **Create parameter**
4. Fill in:
   - **Name:** `/containrlab/PARAMETER_NAME`
   - **Type:** `SecureString` (for secrets) or `String` (for config)
   - **Value:** Your secret value
5. Click **Create parameter**

---

### ECS Task Definition Integration

**How ECS tasks access secrets:**

```json
{
  "containerDefinitions": [
    {
      "name": "api",
      "secrets": [
        {
          "name": "GITHUB_CLIENT_ID",
          "valueFrom": "arn:aws:ssm:us-east-1:ACCOUNT:parameter/containrlab/GITHUB_CLIENT_ID"
        },
        {
          "name": "GITHUB_CLIENT_SECRET",
          "valueFrom": "arn:aws:ssm:us-east-1:ACCOUNT:parameter/containrlab/GITHUB_CLIENT_SECRET"
        }
      ]
    }
  ]
}
```

**ECS injects as environment variables:**
- No files to read
- No code changes needed
- Secrets encrypted in transit and at rest

**[→ View task definitions](../infra/task-definitions/)**

---

### IAM Permissions

**ecsTaskExecutionRole needs:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameters",
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:ssm:us-east-1:*:parameter/containrlab/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": [
        "arn:aws:kms:us-east-1:*:key/*"
      ]
    }
  ]
}
```

**[→ Complete AWS infrastructure guide](AWS_INFRASTRUCTURE.md)**

---

## GitHub Actions Secrets

### Storage: Repository Secrets

**Access:** Settings → Secrets and variables → Actions

**Encryption:** GitHub-managed encryption

**Scope:** Available only to workflows in the repository

---

### Required Secrets

| Secret Name | Purpose | Value Source |
|-------------|---------|--------------|
| `AWS_ACCESS_KEY_ID` | AWS authentication for deployment | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | AWS authentication for deployment | IAM user secret key |

---

### Setup Instructions

#### 1. Create IAM User

```bash
# Create dedicated IAM user for GitHub Actions
aws iam create-user --user-name github-actions-deploy

# Attach policies for ECR and ECS
aws iam attach-user-policy \
  --user-name github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

aws iam attach-user-policy \
  --user-name github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess

# Create access key
aws iam create-access-key --user-name github-actions-deploy
```

**Save the output:**
```json
{
  "AccessKeyId": "AKIAIOSFODNN7EXAMPLE",
  "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
}
```

---

#### 2. Add Secrets to GitHub

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**

**Add each secret:**

**AWS_ACCESS_KEY_ID:**
- Name: `AWS_ACCESS_KEY_ID`
- Secret: `AKIAIOSFODNN7EXAMPLE` (from step 1)
- Click **Add secret**

**AWS_SECRET_ACCESS_KEY:**
- Name: `AWS_SECRET_ACCESS_KEY`
- Secret: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` (from step 1)
- Click **Add secret**

---

### Workflow Usage

**How workflows access secrets:**

```yaml
name: Deploy to AWS

on:
  push:
    branches: [ "main" ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
```

**Security:**
- Secrets are masked in logs
- Not accessible to forked repositories
- Not exposed in pull requests from forks

**[→ Complete CI/CD setup guide](CI_CD_SETUP.md)**

---

## Secret Rotation

### When to Rotate

**Immediately:**
- Secret is compromised or exposed
- Employee with access leaves team
- Unauthorized access detected

**Regularly:**
- Every 90 days (recommended)
- Every 180 days (minimum)
- After major security incident

---

### Rotation Procedure

#### GitHub OAuth Credentials

**1. Create new OAuth app:**
- Go to GitHub Developer Settings
- Create new OAuth app with same settings
- Get new Client ID and Secret

**2. Update all environments:**

**Local:**
```bash
echo "new-client-id" > compose/secrets/GITHUB_CLIENT_ID.txt
echo "new-client-secret" > compose/secrets/GITHUB_CLIENT_SECRET.txt
docker compose restart
```

**AWS:**
```bash
aws ssm put-parameter \
  --name /containrlab/GITHUB_CLIENT_ID \
  --value "new-client-id" \
  --type SecureString \
  --overwrite

aws ssm put-parameter \
  --name /containrlab/GITHUB_CLIENT_SECRET \
  --value "new-client-secret" \
  --type SecureString \
  --overwrite

# Force ECS to restart with new values
aws ecs update-service \
  --cluster containrlab-cluster \
  --service containrlab-service \
  --force-new-deployment
```

**3. Delete old OAuth app:**
- Go to GitHub Developer Settings
- Delete the old OAuth app

---

#### NextAuth Secret

**Generate new secret:**
```bash
NEW_SECRET=$(openssl rand -hex 32)
```

**Update all environments:**

**Local:**
```bash
echo "$NEW_SECRET" > compose/secrets/NEXTAUTH_SECRET.txt
docker compose restart
```

**AWS:**
```bash
aws ssm put-parameter \
  --name /containrlab/NEXTAUTH_SECRET \
  --value "$NEW_SECRET" \
  --type SecureString \
  --overwrite

aws ecs update-service \
  --cluster containrlab-cluster \
  --service containrlab-service \
  --force-new-deployment
```

**Warning:** All existing user sessions will be invalidated

---

#### AWS IAM Access Keys

**1. Create new access key:**
```bash
aws iam create-access-key --user-name github-actions-deploy
```

**2. Update GitHub Secrets:**
- Go to repository Settings → Secrets
- Update `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

**3. Test new keys:**
```bash
# Push a small change to trigger deployment
git commit --allow-empty -m "test: verify new AWS keys"
git push origin main
```

**4. Delete old access key:**
```bash
aws iam delete-access-key \
  --user-name github-actions-deploy \
  --access-key-id OLD_ACCESS_KEY_ID
```

---

#### Gemini API Key

**1. Create new API key:**
- Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
- Create new API key

**2. Update all environments:**

**Local:**
```bash
echo "new-api-key" > compose/secrets/GEMINI_API_KEY.txt
docker compose restart
```

**AWS:**
```bash
aws ssm put-parameter \
  --name /containrlab/GEMINI_API_KEY \
  --value "new-api-key" \
  --type SecureString \
  --overwrite

aws ecs update-service \
  --cluster containrlab-cluster \
  --service containrlab-service \
  --force-new-deployment
```

**3. Disable old API key:**
- Go to Google AI Studio
- Disable or delete the old key

---

## Best Practices

### 1. Never Commit Secrets

**Use .gitignore:**
```gitignore
# Secrets
compose/secrets/
*.env
*.key
*.pem
.env.local
.env.production
```

**Check before committing:**
```bash
# Search for potential secrets
git diff --cached | grep -i "secret\|password\|key\|token"
```

---

### 2. Use Different Secrets Per Environment

**Don't reuse secrets across:**
- Local development
- Staging environment
- Production environment

**Example:**
- Local: `github-oauth-app-dev`
- Production: `github-oauth-app-prod`

---

### 3. Principle of Least Privilege

**GitHub Actions IAM user:**
- ✅ Can push to ECR
- ✅ Can update ECS services
- ❌ Cannot read SSM parameters
- ❌ Cannot modify IAM policies
- ❌ Cannot access S3 buckets

**ECS Task Execution Role:**
- ✅ Can read SSM parameters in `/containrlab/*`
- ✅ Can pull from ECR
- ❌ Cannot modify SSM parameters
- ❌ Cannot access other namespaces

---

### 4. Use Secret Scanning

**GitHub Secret Scanning:**
- Enabled by default on public repos
- Alerts when secrets committed
- Automatically revokes some partner tokens

**Enable for private repos:**
1. Go to repository Settings
2. Click **Code security and analysis**
3. Enable **Secret scanning**

---

### 5. Monitor Access

**CloudTrail for SSM:**
```bash
# View SSM parameter access logs
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::SSM::Parameter \
  --max-results 50
```

**GitHub Actions audit log:**
- Organization Settings → Audit log
- Filter by: `action:secrets`

---

## Troubleshooting

### Local: "Secret file not found"

**Problem:** Docker Compose can't find secret files

**Solution:**
```bash
# Check files exist
ls -la compose/secrets/

# Verify file permissions (should be readable)
chmod 644 compose/secrets/*.txt

# Restart containers
docker compose down
docker compose up -d
```

---

### AWS: "Cannot retrieve secret value"

**Problem:** ECS task can't read SSM parameters

**Check:**
1. Parameter exists:
   ```bash
   aws ssm get-parameter --name /containrlab/GITHUB_CLIENT_ID
   ```

2. IAM role has permissions:
   ```bash
   aws iam get-role-policy \
     --role-name ecsTaskExecutionRole \
     --policy-name SSMPolicy
   ```

3. Parameter ARN correct in task definition

---

### GitHub Actions: "AWS credentials not found"

**Problem:** Workflow can't authenticate to AWS

**Check:**
1. Secrets exist in GitHub (Settings → Secrets)
2. Secret names match workflow file exactly
3. IAM user exists and has required policies
4. Access key is active (not deleted)

**Test locally:**
```bash
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
aws sts get-caller-identity
```

---

### OAuth: "Redirect URI mismatch"

**Problem:** GitHub OAuth returns error

**Solution:**
1. Check OAuth app settings match environment:
   - Local: `http://localhost:3000/api/auth/callback/github`
   - Production: `https://app.containrlab.click/api/auth/callback/github`

2. Verify NEXTAUTH_URL environment variable matches

---

## Security Checklist

- [ ] All secrets in `.gitignore`
- [ ] No secrets committed to Git history
- [ ] GitHub Secret Scanning enabled
- [ ] Different secrets for local vs production
- [ ] IAM roles use least privilege
- [ ] Regular rotation schedule (90 days)
- [ ] Access logs monitored
- [ ] Secrets encrypted at rest (SSM, GitHub)
- [ ] Secrets encrypted in transit (HTTPS, TLS)
- [ ] Team members know rotation procedures

---

## Related Documentation

- **[Local Setup](LOCAL_SETUP.md)** - Setting up local development secrets
- **[Deployment Guide](DEPLOYMENTS.md)** - AWS SSM parameter setup
- **[CI/CD Setup](CI_CD_SETUP.md)** - GitHub Actions secrets
- **[AWS Infrastructure](AWS_INFRASTRUCTURE.md)** - IAM roles and permissions
- **[Architecture](ARCHITECTURE.md)** - Security model

---

<div align="center">

**[← Back to Documentation](README.md)** | **[Deploy to AWS →](DEPLOYMENTS.md)**

</div>
