# ContainrLab Infrastructure Documentation

> **Current Status:** Production deployment on AWS (October 27, 2025)  
> **Environment:** Single production environment  
> **Region:** us-east-1  
> **Cost:** ~$93/month (optimized from $125/month)

## 📋 Overview

This directory contains documentation and configuration for the ContainrLab AWS infrastructure. The deployment uses a hybrid ECS architecture with Fargate for the web tier and EC2 for compute-intensive runner workloads.

## 🏗️ Architecture

### Services
- **API/Web Tier:** ECS Fargate (ARM64)
  - Cluster: `containrlab-cluster`
  - Service: `containrlab-service`
  - Task Definition: `containrlab-task:26`
  
- **Runner Tier:** ECS on EC2 (AMD64)
  - Cluster: `containrlab-runner-ec2`
  - Service: `containrlab-runner-service`
  - Instance: t3.medium (cost-optimized)
  - Task Definition: `containrlab-runner:9`

### Key Resources
- **Load Balancer:** Application Load Balancer with HTTPS
- **Container Registry:** 4 ECR repositories
- **Configuration:** SSM Parameter Store
- **Networking:** VPC with public/private subnets

## 📂 Directory Structure

```
infra/
├── README.md                      # This file
├── aws-resources.md              # Complete resource inventory
├── deployment-guide.md           # Step-by-step deployment
├── cost-optimization.md          # Cost optimization details
├── task-definitions/             # ECS task definitions
│   ├── api-web-task.json
│   └── runner-task.json
├── service-configs/              # ECS service configurations
│   ├── api-service.json
│   └── runner-service.json
└── ssm-parameters/               # Parameter store docs
    └── parameters.md
```

## 🚀 Quick Reference

### Current Deployment
- **URL:** https://app.containrlab.click
- **API:** https://api.containrlab.click
- **Status:** Production, fully operational
- **Session TTL:** 45 minutes
- **Capacity:** 2 concurrent users

### Key Configuration
- **Session Memory:** 1.5GB per container
- **Session CPU:** 1 vCPU per container
- **Auto Scaling:** Fixed at 1 EC2 instance

## 📚 Documentation

- **[AWS Resources](aws-resources.md)** - Complete inventory of all AWS resources
- **[Deployment Guide](deployment-guide.md)** - How to deploy from scratch
- **[Cost Optimization](cost-optimization.md)** - Details on cost savings

## 🔮 Future Plans

This documentation-first approach allows for:
- Easy recreation of infrastructure if needed
- Future migration to Terraform/IaC when scaling requires it
- Clear understanding of all deployed resources

**Note:** Terraform/CDK can be added later if multi-environment deployment is needed.
