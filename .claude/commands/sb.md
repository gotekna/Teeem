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
# FIX (Feb 2026): Use rsync to copy ALL files including hidden (.slugignore)
rsync -a --exclude='.git' --exclude-from=backend/.slugignore backend/ "$DEPLOY_DIR/"

# ⚠️ NEVER use 'cd "$DEPLOY_DIR"' - it breaks VS Code's working directory tracking
# Use 'git -C' to run git commands in temp dir without changing cwd
git -C "$DEPLOY_DIR" init
git -C "$DEPLOY_DIR" add .
git -C "$DEPLOY_DIR" commit -m "Deploy to Beta $(date +%Y%m%d-%H%M%S)"

# Deploy to web app
git -C "$DEPLOY_DIR" remote add heroku https://git.heroku.com/teeem-beta.git
git -C "$DEPLOY_DIR" push heroku HEAD:main --force

# Deploy to shared worker (same code, separate dyno)
git -C "$DEPLOY_DIR" remote add worker https://git.heroku.com/teeem-shared-worker.git
git -C "$DEPLOY_DIR" push worker HEAD:main --force || echo "⚠️ Shared worker deploy failed (non-blocking)"

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
