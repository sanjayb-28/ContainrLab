# SSM Parameter Store Configuration

> **Namespace:** `/containrlab/`  
> **Region:** us-east-1  
> **Account:** 143353052888

## 📋 Parameter List

### Application Configuration

| Parameter | Type | Value | Description |
|-----------|------|-------|-------------|
| `/containrlab/SESSION_TTL_SECONDS` | String | `2700` | Session timeout (45 minutes) |
| `/containrlab/RUNNER_MEMORY` | String | `1536m` | Memory limit per session container |
| `/containrlab/RUNNER_NANO_CPUS` | String | `1000000000` | CPU limit per session (1 CPU) |
| `/containrlab/RUNNER_IMAGE` | String | ECR URI | Runner container image |
| `/containrlab/RUNNERD_BASE_URL` | String | Internal URL | RunnerD supervisor endpoint |

### API Configuration

| Parameter | Type | Value | Description |
|-----------|------|-------|-------------|
| `/containrlab/API_INTERNAL_BASE` | String | Internal URL | Internal API base URL |
| `/containrlab/CORS_ALLOW_ORIGINS` | String | URLs | Allowed CORS origins |

### Next.js / Frontend Configuration

| Parameter | Type | Value | Description |
|-----------|------|-------|-------------|
| `/containrlab/NEXT_PUBLIC_API_BASE` | String | `https://api.containrlab.click` | Public API URL |
| `/containrlab/NEXTAUTH_URL` | String | `https://app.containrlab.click` | NextAuth callback URL |
| `/containrlab/NEXTAUTH_SECRET` | SecureString | [ENCRYPTED] | NextAuth JWT secret |

### OAuth / Authentication

| Parameter | Type | Value | Description |
|-----------|------|-------|-------------|
| `/containrlab/GITHUB_CLIENT_ID` | SecureString | [ENCRYPTED] | GitHub OAuth App Client ID |
| `/containrlab/GITHUB_CLIENT_SECRET` | SecureString | [ENCRYPTED] | GitHub OAuth App Secret |

### AI / External Services

| Parameter | Type | Value | Description |
|-----------|------|-------|-------------|
| `/containrlab/GEMINI_API_KEY` | SecureString | [ENCRYPTED] | Google Gemini API key |

## 🔐 Secrets Management

### SecureString Parameters
These parameters are encrypted at rest using AWS KMS:
- `NEXTAUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GEMINI_API_KEY`

### IAM Permissions Required

**Task Execution Role needs:**
```json
{
  "Effect": "Allow",
  "Action": [
    "ssm:GetParameters",
    "kms:Decrypt"
  ],
  "Resource": [
    "arn:aws:ssm:us-east-1:143353052888:parameter/containrlab/*",
    "arn:aws:kms:us-east-1:143353052888:key/*"
  ]
}
```

## 📝 Parameter Usage

### In ECS Task Definitions

Parameters are injected as secrets in task definitions:

```json
{
  "secrets": [
    {
      "name": "SESSION_TTL_SECONDS",
      "valueFrom": "/containrlab/SESSION_TTL_SECONDS"
    },
    {
      "name": "NEXTAUTH_SECRET",
      "valueFrom": "/containrlab/NEXTAUTH_SECRET"
    }
  ]
}
```

### Container Environment Variables

At runtime, these become environment variables:
```bash
echo $SESSION_TTL_SECONDS  # 2700
echo $RUNNER_MEMORY        # 1536m
```

## 🔄 Updating Parameters

### Via AWS CLI
```bash
# Update a parameter
aws ssm put-parameter \
  --name /containrlab/SESSION_TTL_SECONDS \
  --value "1800" \
  --type String \
  --overwrite \
  --region us-east-1

# Update a secure parameter
aws ssm put-parameter \
  --name /containrlab/NEXTAUTH_SECRET \
  --value "your-secret-here" \
  --type SecureString \
  --overwrite \
  --region us-east-1
```

### Via AWS Console
1. Navigate to Systems Manager → Parameter Store
2. Find parameter by name
3. Click "Edit"
4. Update value
5. Save

**Note:** Task definitions don't auto-update. Force new deployment after parameter changes if needed.

## 🚨 Important Notes

### Parameter Changes Requiring Redeployment

These parameters require ECS task restart to take effect:
- ✅ All parameters (read at container startup)

Force new deployment:
```bash
aws ecs update-service \
  --cluster containrlab-cluster \
  --service containrlab-service \
  --force-new-deployment \
  --region us-east-1
```

### Backup Recommendations

**Export all parameters (excluding secrets):**
```bash
aws ssm describe-parameters \
  --parameter-filters "Key=Name,Option=BeginsWith,Values=/containrlab/" \
  --region us-east-1 > parameters-backup.json
```

**Note:** SecureString values are not exported for security. Document them separately in a secure password manager.

## 📊 Current Configuration (Oct 27, 2025)

See: `parameters-list.json` for complete parameter metadata.

### Optimization Settings
- Session TTL: 45 minutes (2700 seconds)
- Runner Memory: 1.5GB (1536m)
- Runner CPU: 1 vCPU (1000000000 nanocpus)

These values are optimized for 1-2 concurrent users on t3.medium EC2 instance.
