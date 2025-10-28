# CI/CD Setup Guide

> **Status:** Automated CI/CD configured with GitHub Actions  
> **Last Updated:** October 27, 2025

## 📋 Overview

ContainrLab uses GitHub Actions for continuous integration and deployment:
- **Testing:** Runs on every PR and push
- **Deployment:** Automatic deployment to production on `main` branch push
- **Security:** Automated security scanning

## 🚀 Quick Start - Adding GitHub Secrets

### Required GitHub Secrets

You need to add these secrets to your GitHub repository:

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each of these secrets:

| Secret Name | Value | Where to Get It |
|-------------|-------|-----------------|
| `AWS_ACCESS_KEY_ID` | `<your-access-key-id>` | From IAM user creation (saved locally) |
| `AWS_SECRET_ACCESS_KEY` | `<your-secret-access-key>` | From IAM user creation (saved locally) |

**⚠️ IMPORTANT:** The actual credentials were generated during setup and should be saved securely.
If you didn't save them, you can generate new ones using:
```bash
aws iam create-access-key --user-name github-actions-deploy
```

### Step-by-Step: Adding Secrets to GitHub

1. **Navigate to Repository Settings**
   ```
   https://github.com/sanjayb-28/ContainrLab/settings/secrets/actions
   ```

2. **Add AWS_ACCESS_KEY_ID**
   - Click "New repository secret"
   - Name: `AWS_ACCESS_KEY_ID`
   - Secret: `<paste-your-access-key-id>`
   - Click "Add secret"

3. **Add AWS_SECRET_ACCESS_KEY**
   - Click "New repository secret"
   - Name: `AWS_SECRET_ACCESS_KEY`
   - Secret: `<paste-your-secret-access-key>`
   - Click "Add secret"

4. **Verify Secrets**
   - You should see both secrets listed (values will be hidden)
   - ✅ Ready to use GitHub Actions!

## 🔧 What Was Set Up

### IAM User Created
- **User:** `github-actions-deploy`
- **Purpose:** Allows GitHub Actions to deploy to AWS
- **Permissions:**
  - Push images to ECR
  - Update ECS services
  - Describe ECS tasks and services

### GitHub Actions Workflows

#### 1. Test Workflow (`.github/workflows/test.yml`)
**Triggers:** Pull requests and pushes to `main` or `aws-deployment`

**What it does:**
- ✅ Runs backend Python tests
- ✅ Runs frontend TypeScript checks
- ✅ Lints code
- ✅ Scans for security vulnerabilities
- ✅ Checks for accidentally committed secrets

#### 2. Deploy Workflow (`.github/workflows/deploy.yml`)
**Triggers:** Pushes to `main` branch or manual trigger

**What it does:**
1. ✅ Builds 4 Docker images:
   - API (ARM64 for Fargate)
   - Web (ARM64 for Fargate)
   - Runner (AMD64 for EC2)
   - RunnerD (AMD64 for EC2)

2. ✅ Pushes images to ECR with tags:
   - `latest` (always points to production)
   - `<commit-sha>` (specific version for rollback)

3. ✅ Deploys to ECS:
   - Updates `containrlab-service` (API/Web)
   - Updates `containrlab-runner-service` (Runner)

4. ✅ Waits for deployment to stabilize

5. ✅ Verifies deployment:
   - Checks API health endpoint
   - Checks web app loads
   - Fails if unhealthy

## 🎯 How to Use

### Automatic Deployment
Simply push to `main` branch:
```bash
git checkout main
git merge aws-deployment
git push origin main
```

GitHub Actions will automatically:
1. Build new Docker images
2. Push to ECR
3. Deploy to production
4. Verify health

### Manual Deployment
1. Go to GitHub Actions tab
2. Select "Deploy to Production" workflow
3. Click "Run workflow"
4. Select branch
5. Click "Run workflow" button

### Testing Before Deploy
Create a pull request:
```bash
git checkout -b feature/my-feature
# Make changes
git push origin feature/my-feature
```

GitHub will automatically run tests. Merge PR only if tests pass.

## 📊 Monitoring Deployments

### View Deployment Status
- **GitHub Actions:** `https://github.com/sanjayb-28/ContainrLab/actions`
- **AWS ECS Services:** AWS Console → ECS → Clusters

### Deployment Timeline
Typical deployment takes **8-12 minutes**:
- Building images: ~5-7 min
- Pushing to ECR: ~2-3 min
- ECS deployment: ~2-3 min
- Health checks: ~30 sec

### Logs
- **Build logs:** GitHub Actions workflow run
- **Runtime logs:** CloudWatch Logs
  - Log group: `/ecs/containrlab`
  - Streams: `api/api/<task-id>`, `web/web/<task-id>`

## 🔄 Rollback Procedure

If deployment fails or causes issues:

### Quick Rollback via GitHub
1. Go to GitHub Actions
2. Find the last successful deployment
3. Click "Re-run all jobs"

### Rollback via AWS CLI
```bash
# Find previous working task definition
aws ecs describe-services \
  --cluster containrlab-cluster \
  --services containrlab-service \
  --query 'services[0].taskDefinition'

# Rollback to previous version (e.g., :25)
aws ecs update-service \
  --cluster containrlab-cluster \
  --service containrlab-service \
  --task-definition containrlab-task:25 \
  --force-new-deployment
```

### Rollback via ECR Image Tag
Deploy a specific commit:
```bash
# Update task definition to use specific image SHA
# Then force deployment
```

## 🛡️ Security

### Secrets Protection
- ✅ AWS credentials stored as GitHub encrypted secrets
- ✅ Never logged or exposed in workflow output
- ✅ IAM user has minimal required permissions
- ✅ Access keys can be rotated anytime

### IAM User Permissions
The `github-actions-deploy` user can:
- ✅ Push to ECR repositories
- ✅ Update ECS services
- ✅ Describe ECS resources

The user **cannot**:
- ❌ Delete resources
- ❌ Modify IAM
- ❌ Access SSM parameters
- ❌ Stop/delete EC2 instances

### Rotating Access Keys
If credentials are compromised:

1. **Create new access key:**
   ```bash
   aws iam create-access-key \
     --user-name github-actions-deploy
   ```

2. **Update GitHub secrets** with new values

3. **Delete old access key:**
   ```bash
   aws iam delete-access-key \
     --user-name github-actions-deploy \
     --access-key-id OLD_KEY_ID
   ```

## 🧪 Testing the CI/CD

### Test the Pipeline
1. **Make a small change:**
   ```bash
   git checkout -b test-ci
   echo "# CI/CD Test" >> README.md
   git add README.md
   git commit -m "test: verify CI/CD pipeline"
   git push origin test-ci
   ```

2. **Create PR and watch tests run**

3. **Merge to main and watch deployment**

4. **Verify at:** https://app.containrlab.click

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS ECS Deployment](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-types.html)
- [Docker Buildx](https://docs.docker.com/buildx/working-with-buildx/)

## 🆘 Troubleshooting

### Build Fails
- **Check:** Docker syntax in Dockerfiles
- **Check:** Dependencies in requirements.txt / package.json
- **Fix:** Update dependencies or fix syntax

### Deployment Fails
- **Check:** ECS service events in AWS Console
- **Check:** CloudWatch logs for errors
- **Check:** Task definition is valid

### Tests Fail
- **Check:** Test output in GitHub Actions
- **Fix:** Update code or tests
- **Don't merge** until tests pass

### Health Check Fails
- **Check:** Application logs
- **Check:** Service is running
- **Rollback** to previous version

---

**Setup Complete!** 🎉

Next steps:
1. ✅ Add GitHub secrets (see above)
2. ✅ Push to main branch to test deployment
3. ✅ Monitor first deployment
4. ✅ Verify application works

Your CI/CD pipeline is ready to use!
