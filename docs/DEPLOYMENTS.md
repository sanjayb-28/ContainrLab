# Deployment Guide

> **Target:** Production deployment from scratch  
> **Time Required:** 2-3 hours  
> **Skill Level:** Intermediate AWS/Docker knowledge required

## 🎯 Prerequisites

### Required Tools
- AWS CLI configured with admin credentials
- Docker with buildx support
- Git
- jq (JSON processor)

### AWS Account Requirements
- AWS Account with billing enabled
- Domain registered (or use existing)
- SSL certificate in ACM

### Environment
- **Region:** us-east-1 (recommended)
- **Account ID:** Your AWS account

## 📋 Deployment Steps

### Phase 1: Initial Setup

#### 1.1 Clone Repository
```bash
git clone https://github.com/your-username/ContainrLab.git
cd ContainrLab
git checkout aws-deployment
```

#### 1.2 Configure AWS CLI
```bash
aws configure
# Enter your AWS credentials
# Set region to us-east-1
```

#### 1.3 Set Environment Variables
```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export DOMAIN=your-domain.com  # e.g., containrlab.click
```

### Phase 2: SSM Parameter Store

#### 2.1 Create Required Parameters
```bash
# Session configuration
aws ssm put-parameter \
  --name /containrlab/SESSION_TTL_SECONDS \
  --value "2700" \
  --type String \
  --region $AWS_REGION

# Runner configuration
aws ssm put-parameter \
  --name /containrlab/RUNNER_MEMORY \
  --value "1536m" \
  --type String \
  --region $AWS_REGION

aws ssm put-parameter \
  --name /containrlab/RUNNER_NANO_CPUS \
  --value "1000000000" \
  --type String \
  --region $AWS_REGION
```

#### 2.2 Create Secret Parameters
```bash
# GitHub OAuth (get from https://github.com/settings/developers)
aws ssm put-parameter \
  --name /containrlab/GITHUB_CLIENT_ID \
  --value "your-github-client-id" \
  --type SecureString \
  --region $AWS_REGION

aws ssm put-parameter \
  --name /containrlab/GITHUB_CLIENT_SECRET \
  --value "your-github-client-secret" \
  --type SecureString \
  --region $AWS_REGION

# NextAuth Secret (generate random string)
aws ssm put-parameter \
  --name /containrlab/NEXTAUTH_SECRET \
  --value "$(openssl rand -hex 32)" \
  --type SecureString \
  --region $AWS_REGION

# Gemini API Key (get from Google AI Studio)
aws ssm put-parameter \
  --name /containrlab/GEMINI_API_KEY \
  --value "your-gemini-api-key" \
  --type SecureString \
  --region $AWS_REGION

# URLs
aws ssm put-parameter \
  --name /containrlab/NEXTAUTH_URL \
  --value "https://app.$DOMAIN" \
  --type String \
  --region $AWS_REGION

aws ssm put-parameter \
  --name /containrlab/NEXT_PUBLIC_API_BASE \
  --value "https://api.$DOMAIN" \
  --type String \
  --region $AWS_REGION
```

### Phase 3: ECR Repositories

#### 3.1 Create Repositories
```bash
for repo in containrlab-api containrlab-web containrlab-runner containrlab-runnerd; do
  aws ecr create-repository \
    --repository-name $repo \
    --region $AWS_REGION
done
```

#### 3.2 Authenticate Docker to ECR
```bash
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

### Phase 4: Build and Push Images

#### 4.1 Build API Image
```bash
docker buildx create --name multiarch --use
docker buildx build \
  --platform linux/arm64 \
  --push \
  -f backend/Dockerfile \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/containrlab-api:latest \
  .
```

#### 4.2 Build Web Image
```bash
cd frontend
docker buildx build \
  --platform linux/arm64 \
  --push \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/containrlab-web:latest \
  .
cd ..
```

#### 4.3 Build Runner Images
```bash
# Build runner image
cd runner
docker buildx build \
  --platform linux/amd64 \
  --push \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/containrlab-runner:latest \
  .

# Build runnerd image
cd supervisor
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
docker buildx build \
  --platform linux/amd64 \
  --push \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/containrlab-runnerd:$TIMESTAMP \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/containrlab-runnerd:latest \
  .
cd ../..
```

### Phase 5: Infrastructure Setup

#### 5.1 VPC and Networking
**Option A:** Use default VPC (quickest)
**Option B:** Create dedicated VPC (recommended for production)

This guide assumes you have a VPC with:
- Public subnets (for ALB)
- Private subnets (for ECS tasks)
- NAT Gateway (for outbound internet)

#### 5.2 Create Security Groups
```bash
# ALB Security Group
# ECS Tasks Security Group
# Runner EC2 Security Group
# (Configure according to your VPC)
```

#### 5.3 Create Load Balancer
```bash
# Create ALB
# Create target groups
# Configure listeners
# (Use AWS Console or CLI)
```

### Phase 6: ECS Cluster Setup

#### 6.1 Create Fargate Cluster (API/Web)
```bash
aws ecs create-cluster \
  --cluster-name containrlab-cluster \
  --region $AWS_REGION
```

#### 6.2 Create EC2 Cluster (Runner)
```bash
aws ecs create-cluster \
  --cluster-name containrlab-runner-ec2 \
  --region $AWS_REGION
```

### Phase 7: ECS Task Definitions

#### 7.1 Create API/Web Task Definition
Use the provided template: `infra/task-definitions/api-web-task.json`

Update image URIs and register:
```bash
# Edit api-web-task.json with your account ID and region
aws ecs register-task-definition \
  --cli-input-json file://infra/task-definitions/api-web-task.json
```

#### 7.2 Create Runner Task Definition
Use the provided template: `infra/task-definitions/runner-task.json`

Update and register:
```bash
aws ecs register-task-definition \
  --cli-input-json file://infra/task-definitions/runner-task.json
```

### Phase 8: EC2 Auto Scaling Setup

#### 8.1 Create IAM Role for EC2
```bash
# Create ecsInstanceRole with AmazonEC2ContainerServiceforEC2Role policy
```

#### 8.2 Create Launch Template
```bash
# User data should include:
# - ECS cluster configuration
# - amazon-ecr-credential-helper installation
# - Docker ECR credential helper config
```

User Data Template:
```bash
#!/bin/bash
echo ECS_CLUSTER=containrlab-runner-ec2 >> /etc/ecs/ecs.config
yum install -y amazon-ecr-credential-helper
mkdir -p /root/.docker
echo '{"credsStore": "ecr-login"}' > /root/.docker/config.json
systemctl restart docker
```

#### 8.3 Create Auto Scaling Group
```bash
# Min: 1, Max: 1, Desired: 1
# Instance Type: t3.medium
# AMI: Latest ECS-optimized Amazon Linux 2
```

### Phase 9: ECS Services

#### 9.1 Create API/Web Service
```bash
aws ecs create-service \
  --cluster containrlab-cluster \
  --service-name containrlab-service \
  --task-definition containrlab-task \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --load-balancers file://load-balancers-config.json
```

#### 9.2 Create Runner Service
```bash
aws ecs create-service \
  --cluster containrlab-runner-ec2 \
  --service-name containrlab-runner-service \
  --task-definition containrlab-runner \
  --desired-count 1
```

### Phase 10: DNS & SSL

#### 10.1 Configure Route 53
```bash
# Create hosted zone (if not exists)
aws route53 create-hosted-zone --name $DOMAIN

# Create A records pointing to ALB
# - app.$DOMAIN
# - api.$DOMAIN
```

#### 10.2 Request SSL Certificate
```bash
aws acm request-certificate \
  --domain-name $DOMAIN \
  --subject-alternative-names "*.$DOMAIN" \
  --validation-method DNS
```

#### 10.3 Configure ALB HTTPS Listener
```bash
# Add HTTPS listener on port 443
# Attach SSL certificate
# Redirect HTTP to HTTPS
```

## ✅ Verification

### Check Services
```bash
# API/Web Service
aws ecs describe-services \
  --cluster containrlab-cluster \
  --services containrlab-service \
  --query 'services[0].runningCount'

# Runner Service
aws ecs describe-services \
  --cluster containrlab-runner-ec2 \
  --services containrlab-runner-service \
  --query 'services[0].runningCount'
```

### Test Endpoints
```bash
curl https://api.$DOMAIN/healthz
curl https://app.$DOMAIN
```

### Test Authentication
1. Go to `https://app.$DOMAIN`
2. Click "Sign in with GitHub"
3. Authorize the app
4. Verify successful login

## 🔧 Troubleshooting

### Common Issues

**Issue:** Tasks failing to start
- Check CloudWatch logs
- Verify IAM permissions
- Check security groups

**Issue:** Cannot pull ECR images
- Verify ECR authentication
- Check task execution role permissions
- For EC2: Verify credential helper installed

**Issue:** Authentication not working
- Verify NEXTAUTH_SECRET parameter exists
- Check GitHub OAuth app configuration
- Verify NEXTAUTH_URL matches your domain

## 📚 Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Docker Buildx Guide](https://docs.docker.com/buildx/)
- [NextAuth.js Docs](https://next-auth.js.org/)

## 🔄 Updates & Maintenance

### Deploying Code Changes

1. Build new images with timestamp tags
2. Update task definitions
3. Force new deployment:
```bash
aws ecs update-service \
  --cluster containrlab-cluster \
  --service containrlab-service \
  --force-new-deployment
```

### Scaling Up
See: `cost-optimization.md` for scaling recommendations

### Backup Procedure
- Export task definitions (already in this repo)
- Backup SSM parameters (metadata only)
- Document any manual configuration changes

---

**Note:** This guide provides the overall flow. Some steps require manual configuration in AWS Console for first-time setup. Once deployed, updates can be automated.
