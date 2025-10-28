# AWS Resources Inventory

> **Last Updated:** October 27, 2025  
> **Region:** us-east-1  
> **Account:** 143353052888

## 🏢 Core Infrastructure

### VPC & Networking
- **VPC ID:** `vpc-0be7aeb8de15aec9f`
- **Subnets:** Public and Private subnets across availability zones
- **NAT Gateway:** 1 NAT Gateway (cost-optimized)
- **Internet Gateway:** Attached to VPC

### Load Balancers
- **Main ALB:** `containrlab-alb`
  - ARN: `arn:aws:elasticloadbalancing:us-east-1:143353052888:loadbalancer/app/containrlab-alb/d4c1db6e12d8dd5a`
  - Listeners: HTTP (80) → HTTPS (443)
  - SSL Certificate: AWS Certificate Manager
  
- **Runner ALB:** `containrlab-runner-alb`
  - ARN: `arn:aws:elasticloadbalancing:us-east-1:143353052888:loadbalancer/app/containrlab-runner-alb/38af2a7c8a80032c`

### Target Groups
- `containrlab-api-tg` - Port 8000 (API backend)
- `containrlab-web-tg` - Port 3000 (Next.js frontend)

## 🐳 ECS Resources

### Clusters
1. **containrlab-cluster** (Fargate)
   - Capacity Provider: FARGATE
   - Services: containrlab-service (API/Web)

2. **containrlab-runner-ec2** (EC2)
   - Capacity Provider: Auto Scaling Group
   - Services: containrlab-runner-service (Runner)

### Task Definitions
- `containrlab-task:26` (API/Web)
  - Platform: ARM64 Linux
  - Containers: api, web
  - See: `task-definitions/api-web-task.json`

- `containrlab-runner:9` (Runner supervisor)
  - Platform: ARM64 Linux  
  - Container: runnerd
  - See: `task-definitions/runner-task.json`

### Services
- `containrlab-service`
  - Cluster: containrlab-cluster
  - Desired Count: 1
  - See: `service-configs/api-service.json`

- `containrlab-runner-service`
  - Cluster: containrlab-runner-ec2
  - Desired Count: 1
  - See: `service-configs/runner-service.json`

## 🖥️ EC2 Resources

### Instances
- **Runner Instance:** `i-0f416961f1dce7a52`
  - Type: t3.medium (2 vCPU, 4GB RAM)
  - Platform: x86_64
  - AMI: Amazon Linux 2
  - Tag: containrlab-runner-instance

### Auto Scaling
- **Launch Template:** containrlab-runner-launch-template
  - Instance Type: t3.medium
  - User Data: Includes ECR credential helper setup
  - IAM Role: ecsInstanceRole

- **Auto Scaling Group:**
  - Min: 1, Max: 1, Desired: 1
  - Fixed capacity (cost-optimized)

## 📦 ECR Repositories

1. **containrlab-api**
   - Current: ARM64 images
   - Tag: latest

2. **containrlab-web**
   - Current: ARM64 images  
   - Tag: latest, working

3. **containrlab-runner**
   - Current: AMD64 images
   - Tag: latest

4. **containrlab-runnerd**
   - Current: AMD64 images
   - Tag: 20251027-184751 (timestamped)

## 🔐 IAM Roles

### Task Execution Role
- **Name:** ecsTaskExecutionRole
- **Purpose:** Pull images, read secrets
- **Policies:**
  - AmazonECSTaskExecutionRolePolicy
  - Custom inline policy for SSM parameters

### ECS Instance Role
- **Name:** ecsInstanceRole
- **Purpose:** EC2 instances to join ECS cluster
- **Policies:**
  - AmazonEC2ContainerServiceforEC2Role
  - ECR access

## 🔑 SSM Parameter Store

All parameters are prefixed with `/containrlab/`

See: `ssm-parameters/parameters-list.json`

### Key Parameters
- `SESSION_TTL_SECONDS` = 2700 (45 minutes)
- `RUNNER_MEMORY` = 1536m
- `RUNNER_NANO_CPUS` = 1000000000
- `GEMINI_API_KEY` (SecureString)
- `GITHUB_CLIENT_ID` (SecureString)
- `GITHUB_CLIENT_SECRET` (SecureString)
- `NEXTAUTH_SECRET` (SecureString)
- `NEXTAUTH_URL` (String)
- `RUNNERD_BASE_URL` (String)

## 🌐 Route 53

- **Domain:** containrlab.click
- **Records:**
  - A: app.containrlab.click → ALB
  - A: api.containrlab.click → ALB

## 💰 Cost Breakdown

### Monthly Costs (Optimized)
- EC2 t3.medium: ~$30/month
- Fargate: ~$25/month
- ALB: ~$25/month
- NAT Gateway: ~$10/month
- Data Transfer: ~$3/month

**Total: ~$93/month** (down from $125/month)

### Cost Optimization Applied
- EC2: m7i.large → t3.medium (-$32/month)
- Runner Memory: 2GB → 1.5GB (efficiency)
- NAT Gateway: Kept at 1 (already optimized)

## 📊 Capacity & Limits

- **Max Concurrent Sessions:** 2 (comfortably)
- **Session Resources:** 1.5GB RAM, 1 vCPU each
- **Session Timeout:** 45 minutes
- **EC2 Auto Scaling:** Fixed at 1 instance
