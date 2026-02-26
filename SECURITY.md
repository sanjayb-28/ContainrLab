# Security Policy

## Secrets Management

### Production Secrets
All production secrets are stored in **AWS Systems Manager Parameter Store** and are never committed to the repository.

**SecureString Parameters:**
- `GITHUB_CLIENT_ID` - GitHub OAuth App credentials
- `GITHUB_CLIENT_SECRET` - GitHub OAuth App credentials  
- `NEXTAUTH_SECRET` - NextAuth.js JWT signing secret
- `GEMINI_API_KEY` - Google Gemini API key

**Regular Parameters:**
- `SESSION_TTL_SECONDS` - Session timeout (not sensitive)
- `RUNNER_MEMORY` - Container memory limit (not sensitive)
- Other configuration values

### Local Development
For local development, secrets are stored in the `compose/secrets/` directory (gitignored):

```bash
# Create secrets directory
mkdir -p compose/secrets

# Create secret files
echo "your-github-client-id" > compose/secrets/GITHUB_CLIENT_ID.txt
echo "your-github-client-secret" > compose/secrets/GITHUB_CLIENT_SECRET.txt
echo "$(openssl rand -hex 32)" > compose/secrets/NEXTAUTH_SECRET.txt
echo "your-gemini-api-key" > compose/secrets/GEMINI_API_KEY.txt  # Optional
```

These files are mounted as Docker secrets in `docker-compose.yml`.

### What's Safe in the Repository

The following information is intentionally documented and **is NOT sensitive**:

- ✅ Generic AWS service names (ECS, EC2, ALB)
- ✅ ECS cluster naming patterns
- ✅ Task definition structures
- ✅ Architecture diagrams and deployment guides
- ✅ Parameter **names** (not values)

**Why these are safe:**
- Service names and patterns are generic
- No account-specific resource identifiers
- AWS security is based on IAM authentication, not documentation

### Protected by .gitignore

The following files and directories contain secrets and are never committed:

```
compose/secrets/
.env
.env.local
.env.*.local
*.pem
*.key
```

## Security Best Practices

### For Contributors

1. **Never commit secrets**
   - Use environment variables
   - Use SSM Parameter Store for production
   - Use `.env.local` for local development

2. **Before committing:**
   ```bash
   # Check for accidentally staged secrets
   git diff --cached
   
   # Verify .env files aren't staged
   git status | grep env
   ```

3. **If you accidentally commit a secret:**
   - Rotate the secret immediately
   - Use `git-filter-branch` or BFG Repo-Cleaner to remove from history
   - Update SSM Parameter Store with new secret

### For Production Deployment

1. **All secrets in SSM Parameter Store**
   - Never pass secrets as environment variables in task definitions
   - Use `secrets` field to reference SSM parameters
   - Use SecureString type for sensitive values

2. **IAM Permissions**
   - Task execution role must have `ssm:GetParameters` permission
   - Task execution role must have `kms:Decrypt` permission
   - Principle of least privilege - only grant what's needed

3. **Rotating Secrets**
   ```bash
   # Update SSM parameter
   aws ssm put-parameter \
     --name /containrlab/GITHUB_CLIENT_SECRET \
     --value "new-secret-value" \
     --type SecureString \
     --overwrite
   
   # Force ECS task restart to pick up new value
   aws ecs update-service \
     --cluster containrlab-cluster \
     --service containrlab-service \
     --force-new-deployment
   ```

## Reporting Security Issues

If you discover a security vulnerability, please email:
**sanjay.baskaran@colorado.edu**

**Please do NOT:**
- Open a public GitHub issue
- Discuss in public channels
- Share the vulnerability publicly

## Security Checklist

Before making the repository public or sharing:

- [x] No secrets in committed code
- [x] No secrets in git history
- [x] `.env` files are in `.gitignore`
- [x] Production secrets in SSM Parameter Store
- [x] IAM roles follow least privilege
- [x] Security groups properly configured
- [x] SSL/TLS enabled on all public endpoints
- [x] Regular security updates for dependencies

## Additional Resources

- [AWS Secrets Management Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [NextAuth.js Security](https://next-auth.js.org/configuration/options#secret)
- [GitHub OAuth Security Best Practices](https://docs.github.com/en/developers/apps/building-oauth-apps/best-practices-for-oauth-apps)

---

**Last Security Audit:** October 27, 2025  
**Status:** ✅ No security issues found
