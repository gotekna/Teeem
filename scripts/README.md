# TEEEM Security Scripts

## API Key & Secret Detection

### Overview
These scripts prevent accidental deployment of API keys, tokens, and other credentials to production.

### Scripts

#### `check_all_secrets.sh` (Main Script)
Master security check that scans both backend and frontend for leaked secrets.

**Usage:**
```bash
./scripts/check_all_secrets.sh
```

**When to run:**
- Before EVERY deployment (automated by deploy-manager agent)
- Before creating pull requests
- After adding any third-party integrations

**Exit codes:**
- `0` = Safe to deploy (no secrets found)
- `1` = Deployment blocked (secrets detected)

#### `backend/scripts/check_for_secrets.sh`
Backend-specific secret detection.

**Detects:**
- API keys and tokens
- AWS credentials
- Database URLs with passwords
- OAuth client secrets
- Stripe keys
- GitHub tokens
- Heroku API keys
- Generic secrets and private keys
- Hardcoded passwords

**Excluded files:**
- Sample files (`*.sample`, `*.example`)
- Configuration templates (`config/database.yml`)
- Documentation files (`*.md`)
- Kamal secrets management files

### How It Works

1. **Pattern Matching**: Scans git-tracked files using regex patterns for common secret formats
2. **File Detection**: Checks for commonly miscommitted files (`.env`, `master.key`, etc.)
3. **Smart Filtering**: Ignores comments, ENV variable usage, and sample files
4. **Deployment Block**: Returns exit code 1 if secrets are detected

### What to Do If Secrets Are Detected

1. **Never commit secrets** - Remove them immediately
2. **Use environment variables** - All secrets should use `ENV['SECRET_NAME']`
3. **Update `.gitignore`** - Ensure sensitive files are excluded
4. **Rotate compromised secrets** - If already pushed, rotate the credentials immediately

### Environment Variables

All secrets must be stored as environment variables:

**Backend (Heroku):**
```bash
heroku config:set SECRET_NAME=your_secret_value
```

**Frontend (Vercel):**
```bash
vercel env add SECRET_NAME
```

**Local development:**
- Use `.env.local` (never commit this file!)
- Reference in code: `ENV['SECRET_NAME']` (backend) or `import.meta.env.VITE_SECRET` (frontend)

### False Positives

If the script incorrectly flags a false positive:

1. Verify it's actually a false positive (not a real secret)
2. Update exclusions in `backend/scripts/check_for_secrets.sh`
3. Add the file pattern to the exclusion list

### Integration with Deploy Agent

The deploy-manager agent **automatically runs** `check_all_secrets.sh` before every deployment.
This is enforced via the project's TEEEM_BIBLE.md Chapter 20 (Agent System).

If secrets are detected, deployment will be blocked until they are removed.

### Manual Testing

Test the security check:
```bash
cd /Users/jakebaird/teeem
./scripts/check_all_secrets.sh
```

Expected output:
```
✅ SECURITY CHECK PASSED
Safe to proceed with deployment
```

### Common Issues

**Issue:** Script blocks deployment for `.env.example`
**Solution:** `.example` files are already excluded - ensure file is named correctly

**Issue:** Script flags `ENV['SECRET']` usage
**Solution:** This should be filtered out - if not, update the grep filter

**Issue:** Need to add custom pattern
**Solution:** Edit `PATTERNS` array in `backend/scripts/check_for_secrets.sh`

---

## Maintenance

**Owner:** Security is everyone's responsibility
**Last Updated:** November 2025
**Review:** Update patterns as new secret types are added to the codebase
