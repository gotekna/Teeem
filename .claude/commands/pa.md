# Deploy ALL Changes to Production (Full Pipeline)

**Shortcut:** `/pa` (Production All)

Commits ALL pending changes and deploys through the entire pipeline: staging → beta → production.

**Use `/p` to commit and deploy only THIS chat's changes instead.**

> **NOTE:** This file and `/p.md` share the same deployment logic.
> If you update one, update the other to stay in sync.

## Pipeline Flow
```
[commit] ──► Staging ──► Beta ──► Live (Production)
                │          │          │
           Frontend   Frontend   Frontend
           (Vercel)   (Vercel)   (Vercel)
                │          │          │
           Backend    Backend    Backend
           (Heroku)   (Heroku)   (Heroku)
```

## ⚠️ PRODUCTION DEPLOY - USE CAUTION

This deploys to the live production environment. Ensure:
- Changes have been tested locally
- No known issues
- You have approval to deploy to production

## Instructions

### Step 1 - Pre-Flight Checks
```bash
git branch --show-current
git status --short
```

### Step 2 - Pull and Check for Stashes
```bash
git pull origin Staging
git stash list
```
*If stashes exist, pop them: `git stash pop`*

### Step 3 - Pre-Commit Validation

```bash
echo "🔍 Pre-commit validation..."

# Check TypeScript compiles
if git status --short | grep -E "frontend-next/.*\.(ts|tsx)$" > /dev/null; then
  echo "Checking TypeScript..."
  cd frontend-next && npx tsc --noEmit 2>&1 | head -30
  TSC_EXIT=$?
  cd ..
  if [ $TSC_EXIT -ne 0 ]; then
    echo "❌ TypeScript errors - fix before committing"
    exit 1
  fi
  echo "✅ TypeScript OK"
fi

# Check Ruby syntax
if git status --short | grep -E "backend/.*\.rb$" > /dev/null; then
  echo "Checking Ruby syntax..."
  git status --short | grep -E "backend/.*\.rb$" | awk '{print $2}' | while read file; do
    if [ -f "$file" ]; then
      ruby -c "$file" > /dev/null 2>&1 || {
        echo "❌ Syntax error in $file"
        ruby -c "$file"
        exit 1
      }
    fi
  done
  echo "✅ Ruby syntax OK"
fi

echo "✅ Pre-commit validation passed"
```

### Step 4 - Auto-Generate Commit Message and Commit

**Analyze ALL changes and auto-generate message** (same rules as `/sa`)

```bash
git add -A
git commit -m "[auto-generated message]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 5 - Push to GitHub Staging
```bash
git push origin Staging
```
*Staging frontend auto-deploys from this push*

### Step 6 - Merge Frontend Branches (Staging → Beta → Live)

**This triggers Vercel auto-deploy for Beta and Production frontends.**

```bash
echo "🔀 Merging frontend branches..."

# Save current branch
CURRENT_BRANCH=$(git branch --show-current)

# Merge Staging → Beta
git checkout Beta
git pull origin Beta
git merge Staging -m "Merge Staging into Beta for deployment"
git push origin Beta
echo "✅ Beta frontend updated"

# Merge Beta → Live (Production)
git checkout Live
git pull origin Live
git merge Beta -m "Merge Beta into Live for deployment"
git push origin Live
echo "✅ Production frontend updated"

# Return to original branch
git checkout "$CURRENT_BRANCH"
echo "✅ Frontend branches merged"
```

### Step 7 - Deploy Backend to Staging (if backend changed)

```bash
git diff --name-only HEAD~1 HEAD | grep -q "^backend/" && echo "BACKEND: Deploy needed" || echo "BACKEND: No changes, skip"
```

**If backend changed:**
```bash
cd /Users/robertharder/GitHub/teeem

sync
sleep 1

DEPLOY_DIR=$(mktemp -d)
cp -r backend/* "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
git init
git add .
git commit -m "Deploy to Staging $(date +%Y%m%d-%H%M%S)"
git remote add heroku https://git.heroku.com/teeem-staging.git
git push heroku HEAD:main --force
cd /Users/robertharder/GitHub/teeem
rm -rf "$DEPLOY_DIR"

echo "✅ Staging backend deployed"
```

### Step 8 - Deploy Backend to Beta

```bash
echo "📦 Deploying backend → beta..."

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

echo "✅ Beta backend deployed"
```

### Step 9 - Deploy Backend to Production

```bash
echo "📦 Deploying backend → production..."

cd /Users/robertharder/GitHub/teeem

sync
sleep 1

DEPLOY_DIR=$(mktemp -d)
cp -r backend/* "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
git init
git add .
git commit -m "Deploy to Production $(date +%Y%m%d-%H%M%S)"
git remote add heroku https://git.heroku.com/teeem-production.git
git push heroku HEAD:main --force
cd /Users/robertharder/GitHub/teeem
rm -rf "$DEPLOY_DIR"

echo "✅ Production backend deployed"
```

### Step 10 - Post-Deploy Verification

```bash
sleep 10

# 1. Check recurring tasks
heroku run rails runner "
  tasks = SolidQueue::RecurringTask.pluck(:key)
  critical = ['xero_health_monitor', 'refresh_integration_tokens', 'daily_health_check']
  missing = critical - tasks
  if missing.any?
    puts '❌ MISSING RECURRING TASKS: ' + missing.join(', ')
    exit 1
  else
    puts '✅ Recurring tasks OK (' + tasks.count.to_s + ' registered)'
  end
" --app teeem-production

# 2. Check health monitor
heroku run rails runner "
  last = XeroSyncEvent.where(sync_type: 'health_check').order(created_at: :desc).first
  if last.nil?
    puts '⚠️  No health monitor runs found'
  elsif last.event_type == 'completed'
    puts '✅ Health monitor OK (last: ' + last.created_at.in_time_zone('Australia/Brisbane').strftime('%H:%M') + ')'
  else
    puts '❌ Health monitor failed: ' + (last.error_message || 'unknown')
  end
" --app teeem-production

# 3. Check Xero credentials
heroku run rails runner "
  total = XeroCredential.count
  expired = XeroCredential.all.count { |c| c.expired? }
  if expired > 0
    puts '⚠️  Xero: ' + expired.to_s + '/' + total.to_s + ' tokens expired (will auto-refresh)'
  else
    puts '✅ Xero: ' + total.to_s + ' credentials, all tokens valid'
  end
" --app teeem-production
```

### Step 11 - Report Status

```bash
BACKEND_VERSION=$(curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version | jq -r '.version' 2>/dev/null || echo "unknown")
BRISBANE_TIME=$(TZ='Australia/Brisbane' date '+%H:%M %d/%m')
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%s)
```

**Output format:**
```
========================================
FULL PIPELINE DEPLOYED: HH:MM DD/MM (Brisbane)
Commit: [hash] - [message]
----------------------------------------
Frontend (Vercel - auto-deploy on branch merge):
  ✅ Staging: Staging branch pushed
  ✅ Beta: Staging → Beta merged
  ✅ Production: Beta → Live merged

Backend (Heroku - direct deploy):
  ✅ Staging: v[XXX] deployed to teeem-staging
  ✅ Beta: v[XXX] deployed to teeem-beta
  ✅ Production: v[XXX] deployed to teeem-production
----------------------------------------
Post-Deploy Verification:
  [verification results]
========================================
```

## Error Handling

If any step fails:
1. Report which step failed
2. Do NOT proceed to next environment
3. Provide recovery instructions

## Notes

- Commits ALL changes from ALL chat sessions
- Deploys BOTH frontend AND backend to ALL THREE environments
- Frontend: Vercel auto-deploys when branches are merged (Staging → Beta → Live)
- Backend: Direct Heroku deploy via orphan push method
- Post-deploy verification runs for Production only
- Use `/p` if you only want to commit THIS chat's changes
- Use `/ba` if you only want to deploy up to Beta
- Use `/sa` if you only want to deploy to Staging
