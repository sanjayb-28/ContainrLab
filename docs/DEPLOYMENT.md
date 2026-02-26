# Deployment Guide

Complete guide for deploying ContainrLab to AWS production environment.

---

## Overview

Deploy ContainrLab to AWS using ECS (Fargate + EC2) with automated CI/CD or manual deployment.

**What you'll deploy:**
- Frontend & Backend on ECS Fargate (AMD64)
- Runner on EC2 with ECS (Docker-in-Docker)
- Application Load Balancer with HTTPS
- Secrets in SSM Parameter Store
- Docker images in Amazon ECR

**Time:** 2-3 hours (first-time setup) | 15 minutes (CI/CD deployments)

---

## Prerequisites

### AWS Account
- AWS Account with billing enabled
- IAM user with administrator access
- AWS CLI installed and configured
- Domain name with SSL certificate in AWS Certificate Manager

### Local Tools
- Docker Desktop with buildx support
- Git
- Node.js 20+ and Python 3.12+ (for testing)

### External Services
- **GitHub OAuth App** - [Create here](https://github.com/settings/developers)
- **Google Gemini API Key** (optional) - [Get here](https://makersuite.google.com/app/apikey)

---

## Option 1: Automated CI/CD Deployment (Recommended)

### Step 1: Fork & Clone Repository

```bash
git clone https://github.com/YOUR-USERNAME/ContainrLab.git
cd ContainrLab
```

### Step 2: Initial AWS Infrastructure

#### 2.1 Create ECR Repositories

```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create container registries
aws ecr create-repository --repository-name containrlab-api --region $AWS_REGION
aws ecr create-repository --repository-name containrlab-web --region $AWS_REGION
aws ecr create-repository --repository-name containrlab-runner --region $AWS_REGION
aws ecr create-repository --repository-name containrlab-runnerd --region $AWS_REGION
```

#### 2.2 Create ECS Clusters

```bash
# Fargate cluster for API/Web
aws ecs create-cluster --cluster-name containrlab-cluster --region $AWS_REGION

# EC2 cluster for Runner
aws ecs create-cluster --cluster-name containrlab-runner-ec2 --region $AWS_REGION
```

#### 2.3 Launch EC2 Instance for Runner

Use ECS-optimized Amazon Linux 2 AMI with appropriate instance type. Configure with IAM role (ecsInstanceRole) and user data script:

```bash
#!/bin/bash
yum install -y amazon-ecr-credential-helper
mkdir -p /root/.docker
echo '{"credsStore": "ecr-login"}' > /root/.docker/config.json
systemctl restart docker
```

#### 2.4 Create Load Balancer & Target Groups

- Create Application Load Balancer
- Create target groups for API (port 8000), Web (port 3000), Runner (port 8080)
- Configure HTTPS listener with SSL certificate
- Set up host-based routing (`api.domain.com`, `app.domain.com`)

---

### Step 3: Configure Secrets

#### GitHub OAuth Application

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create new OAuth App:
   - **Homepage URL:** `https://app.your-domain.com`
   - **Callback URL:** `https://app.your-domain.com/api/auth/callback/github`
3. Save Client ID and Client Secret

#### Store Secrets in SSM Parameter Store

```bash
# GitHub OAuth credentials
aws ssm put-parameter \
  --name /containrlab/GITHUB_CLIENT_ID \
  --value "your-github-client-id" \
  --type SecureString

aws ssm put-parameter \
  --name /containrlab/GITHUB_CLIENT_SECRET \
  --value "your-github-client-secret" \
  --type SecureString

# NextAuth secret (generate random)
aws ssm put-parameter \
  --name /containrlab/NEXTAUTH_SECRET \
  --value "$(openssl rand -hex 32)" \
  --type SecureString

# Gemini API key (optional)
aws ssm put-parameter \
  --name /containrlab/GEMINI_API_KEY \
  --value "your-gemini-api-key" \
  --type SecureString

# Session TTL (45 minutes = 2700 seconds)
aws ssm put-parameter \
  --name /containrlab/SESSION_TTL_SECONDS \
  --value "2700" \
  --type String
```

### Complete SSM Parameter Reference

**Namespace:** `/containrlab/`

#### Application Configuration

| Parameter | Type | Example Value | Description |
|-----------|------|---------------|-------------|
| `/containrlab/SESSION_TTL_SECONDS` | String | `2700` | Session timeout (45 minutes) |
| `/containrlab/RUNNER_MEMORY` | String | `1536m` | Memory limit per session container |
| `/containrlab/RUNNER_NANO_CPUS` | String | `1000000000` | CPU limit per session (1 CPU) |
| `/containrlab/RUNNER_IMAGE` | String | ECR URI | Runner container image |
| `/containrlab/RUNNERD_BASE_URL` | String | Internal URL | RunnerD supervisor endpoint |

#### API Configuration

| Parameter | Type | Example Value | Description |
|-----------|------|---------------|-------------|
| `/containrlab/API_INTERNAL_BASE` | String | Internal URL | Internal API base URL |
| `/containrlab/CORS_ALLOW_ORIGINS` | String | URLs | Allowed CORS origins |

#### Frontend Configuration

| Parameter | Type | Example Value | Description |
|-----------|------|---------------|-------------|
| `/containrlab/NEXT_PUBLIC_API_BASE` | String | `https://api.your-domain.com` | Public API URL |
| `/containrlab/NEXTAUTH_URL` | String | `https://app.your-domain.com` | NextAuth callback URL |
| `/containrlab/NEXTAUTH_SECRET` | SecureString | [ENCRYPTED] | NextAuth JWT secret |

#### OAuth / Authentication

| Parameter | Type | Example Value | Description |
|-----------|------|---------------|-------------|
| `/containrlab/GITHUB_CLIENT_ID` | SecureString | [ENCRYPTED] | GitHub OAuth App Client ID |
| `/containrlab/GITHUB_CLIENT_SECRET` | SecureString | [ENCRYPTED] | GitHub OAuth App Secret |

#### AI / External Services

| Parameter | Type | Example Value | Description |
|-----------|------|---------------|-------------|
| `/containrlab/GEMINI_API_KEY` | SecureString | [ENCRYPTED] | Google Gemini API key |

**SecureString Parameters** (encrypted at rest with AWS KMS):
- `NEXTAUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GEMINI_API_KEY`

**Updating Parameters:**
```bash
# Update a parameter
aws ssm put-parameter \
  --name /containrlab/SESSION_TTL_SECONDS \
  --value "1800" \
  --type String \
  --overwrite \
  --region us-east-1

# Force ECS task restart to pick up changes
aws ecs update-service \
  --cluster containrlab-cluster \
  --service containrlab-service \
  --force-new-deployment \
  --region us-east-1
```

---

### Step 4: Set Up GitHub Actions

#### 4.1 Create IAM User for CI/CD

```bash
# Create IAM user
aws iam create-user --user-name github-actions-deploy

# Attach required policies
aws iam attach-user-policy \
  --user-name github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

aws iam attach-user-policy \
  --user-name github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess

# Create access key
aws iam create-access-key --user-name github-actions-deploy
```

**Save the Access Key ID and Secret Access Key!**

#### 4.2 Add GitHub Secrets

Go to repository: `Settings` → `Secrets and variables` → `Actions`

Add these secrets:
- `AWS_ACCESS_KEY_ID` - From step 4.1
- `AWS_SECRET_ACCESS_KEY` - From step 4.1

#### 4.3 Update Workflow Configuration

Edit `.github/workflows/deploy.yml`:

```yaml
env:
  AWS_REGION: us-east-1
  AWS_ACCOUNT_ID: YOUR-ACCOUNT-ID  # Update this
```

---

### Step 5: Deploy

```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

**GitHub Actions will automatically:**
1. Run tests
2. Build Docker images (AMD64 architecture)
3. Push images to ECR
4. Update ECS services
5. Verify health checks

**Monitor progress:** `https://github.com/YOUR-USERNAME/ContainrLab/actions`

---

### Step 6: Configure DNS & Verify

```bash
# Add DNS records (Route 53 or your provider)
api.your-domain.com  →  ALIAS to ALB
app.your-domain.com  →  ALIAS to ALB

# Verify deployment
curl https://api.your-domain.com/healthz
# Expected: {"status":"ok"}

# Visit web app
open https://app.your-domain.com
```

**Your ContainrLab instance is live!**

---

## Option 2: Manual Deployment

For complete control or learning purposes.

### Phase 1: Infrastructure Setup

```bash
# Clone repository
git clone https://github.com/sanjayb-28/ContainrLab.git
cd ContainrLab

# Configure environment
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create ECR repositories (see Option 1, Step 2.1)
# Create ECS clusters (see Option 1, Step 2.2)
# Launch EC2 instance (see Option 1, Step 2.3)
# Configure load balancer (see Option 1, Step 2.4)
```

---

### Phase 2: Build & Push Images

```bash
# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Create buildx builder
docker buildx create --name multiarch --use

# Build and push all images (AMD64 architecture)
docker buildx build \
  --platform linux/amd64 \
  --push \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/containrlab-api:latest \
  -f backend/Dockerfile .

docker buildx build \
  --platform linux/amd64 \
  --push \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/containrlab-web:latest \
  -f frontend/Dockerfile .

docker buildx build \
  --platform linux/amd64 \
  --push \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/containrlab-runner:latest \
  runner/

docker buildx build \
  --platform linux/amd64 \
  --push \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/containrlab-runnerd:latest \
  runnerd/
```

---

### Phase 3: Create ECS Task Definitions & Services

Register task definitions using the AWS Console or CLI. Task definitions should reference:
- ECR image URIs for each service (api, web, runner, runnerd)
- SSM parameter ARNs for secrets injection
- Resource limits (CPU, memory)
- Container port mappings

Create ECS services connected to load balancer target groups.

---

## Secrets Management

### Local Development

**Storage:** `compose/secrets/` directory (gitignored)

```bash
# Create secret files
mkdir -p compose/secrets

echo "your-github-client-id" > compose/secrets/GITHUB_CLIENT_ID.txt
echo "your-github-client-secret" > compose/secrets/GITHUB_CLIENT_SECRET.txt
echo "$(openssl rand -hex 32)" > compose/secrets/NEXTAUTH_SECRET.txt
echo "your-gemini-api-key" > compose/secrets/GEMINI_API_KEY.txt
```

### Production (AWS SSM)

All production secrets stored in SSM Parameter Store with IAM role-based access. See Step 3 above for setup.

**Security Best Practices:**
- Never commit secrets to Git
- Use encrypted storage (SSM SecureString, GitHub Secrets)
- Rotate credentials regularly
- Principle of least privilege for IAM roles

---

## CI/CD Pipeline

### GitHub Actions Workflow

**Trigger:** Push to `main` branch

**Steps:**
1. **Test** - Run backend and frontend test suites
2. **Build** - Create Docker images for AMD64 architecture
3. **Push** - Upload images to Amazon ECR
4. **Deploy** - Update ECS services with new task definitions
5. **Verify** - Health check endpoints

**Configuration:** `.github/workflows/deploy.yml`

### Deployment Strategy

- **Rolling updates** with zero downtime
- **Automatic rollback** on health check failures
- **Manual rollback** via Git revert or task definition version

---

## Monitoring & Maintenance

### CloudWatch Logs

- `/ecs/containrlab-api` - API service logs
- `/ecs/containrlab-web` - Web service logs
- `/ecs/containrlab-runner` - Runner service logs

### Health Checks

```bash
# API health
curl https://api.your-domain.com/healthz

# Check ECS task status
aws ecs describe-tasks \
  --cluster containrlab-cluster \
  --tasks $(aws ecs list-tasks --cluster containrlab-cluster --query 'taskArns[0]' --output text)

# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn <your-target-group-arn>
```

### Updates

**Via CI/CD:**
```bash
git push origin main  # Automatic deployment
```

**Manual:**
```bash
aws ecs update-service \
  --cluster containrlab-cluster \
  --service containrlab-api-service \
  --force-new-deployment
```

---

## Troubleshooting

### Deployment Fails

**GitHub Actions:**
- Check Actions tab for build/deploy logs
- Verify AWS credentials in GitHub Secrets
- Confirm IAM permissions for ECR and ECS

**Common Issues:**
- ECR push fails → Verify IAM policy includes `ecr:*` permissions
- ECS update fails → Check task definition JSON syntax
- Build fails → Review Dockerfile and dependency versions

---

### Services Won't Start

**ECS Task Logs:**
```bash
aws logs tail /ecs/containrlab-api --follow
```

**Common Issues:**
- Missing SSM parameters → Verify all parameters exist with correct names
- Image pull errors → Check ECR authentication on EC2 instance
- Port conflicts → Verify security group rules and target group configurations

---

### Health Checks Fail

**Debug Steps:**
1. Check container logs in CloudWatch
2. Verify security group allows ALB → ECS traffic
3. Confirm health check path is correct (`/healthz` for API)
4. Test endpoint directly from ECS task

**ALB Target Health:**
```bash
aws elbv2 describe-target-health --target-group-arn <arn>
```

---

### EC2 Runner Issues

**SSH Diagnostics:**
```bash
# Check Docker status
sudo systemctl status docker

# Check ECS agent
sudo systemctl status ecs

# Test ECR authentication
docker pull $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/containrlab-runner:latest
```

**Common Issues:**
- ECR authentication fails → Install `amazon-ecr-credential-helper`
- Container won't start → Verify privileged mode enabled in task definition
- Out of resources → Check available CPU/memory on instance

---

## Architecture Notes

**Image Architecture:** All Docker images must be built for `linux/amd64` (x86_64) for compatibility across AWS Fargate and EC2.

**Network Architecture:**
- ALB in public subnets
- ECS tasks in private subnets
- NAT Gateway for outbound internet access

**Scaling Considerations:**
- Fargate services auto-scale based on CPU/memory
- EC2 runner instances can be added to cluster for capacity
- Session containers limited by runner instance resources

---

## Related Documentation

- **[Architecture](ARCHITECTURE.md)** - System design and component details
- **[Local Setup](LOCAL_SETUP.md)** - Development environment
- **[Main README](../README.md)** - Project overview

---

<div align="center">

**[← Back to Documentation](README.md)** | **[View Architecture →](ARCHITECTURE.md)**

</div>
