# Deploy Staging to Beta

**Shortcut:** `/sb` (Staging → Beta)

Deploys the current staging code to the beta Heroku environment. No branch merging - just deploys.

## Pipeline Position
```
staging ──► beta ──► production
        ▲
     YOU ARE HERE
```

## Instructions

### Step 1 - Pre-Flight Checks
```bash
git branch --show-current
git status --short
```

**IMPORTANT: Commit any uncommitted changes first with `/s` or `/sa`.**

### Step 2 - Ensure Staging is Up to Date
```bash
git checkout staging
git pull origin staging
```

### Step 3 - Deploy Backend to Beta

```bash
cd /Users/robertharder/GitHub/teeem

sync
sleep 1

DEPLOY_DIR=$(mktemp -d)
cp -r backend/* "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
git init
git add .
git commit -m "Deploy to Beta $(date +%Y%m%d-%H%M%S)"
git remote add heroku https://git.heroku.com/teeem-beta.git
git push heroku HEAD:main --force
cd /Users/robertharder/GitHub/teeem
rm -rf "$DEPLOY_DIR"
```

### Step 4 - Report Status

**Output format:**
```
========================================
DEPLOYED TO BETA: HH:MM DD/MM (Brisbane)
Source: staging branch
----------------------------------------
Backend: deployed to teeem-beta
========================================
```

## Error Handling

If deploy fails:
1. Report the error
2. Check Heroku logs: `heroku logs --app teeem-beta -n 50`
3. Retry if needed

## Notes

- This deploys staging code directly to beta Heroku
- No git branch operations - staging branch stays as-is
- Frontend: Configure Vercel to deploy staging branch to beta URL if needed
