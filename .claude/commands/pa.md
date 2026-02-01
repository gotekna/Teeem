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
                         └────┬────┘
                         PARALLEL!
```

## Optimizations (Jan 2026)

| Optimization | Savings |
|--------------|---------|
| Single temp directory (reused for all 3 deploys) | ~2s |
| Parallel beta+production deploys | ~60-90s |
| Smart migration check (only if db/migrate changed) | ~10-30s |
| Vercel branch filtering (each project builds only its branch) | ~9 duplicate builds eliminated |
| Combined post-deploy verification (single dyno boot) | ~30s |

## Vercel Branch Filtering

Each Vercel project only builds its designated branch via `DEPLOY_BRANCH` env var:
- `teeem-staging` → only builds `Staging` branch
- `teeem-beta` → only builds `Beta` branch
- `teeem-production` → only builds `Live` branch
- Dev environments (jake/sam/rob) → only build their personal branches

**Result:** `/pa` triggers exactly 3 Vercel builds (Staging + Beta + Live), not 12+.

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

### Step 7 - Deploy Backend (OPTIMIZED - Single Directory, Parallel Deploys)

**Check if backend files changed in recent commits (last 10):**
```bash
# Check last 10 commits for backend changes - catches committed-but-undeployed changes
git diff --name-only HEAD~10 HEAD 2>/dev/null | grep -q "^backend/" && echo "BACKEND: Deploy needed" || echo "BACKEND: No changes, skip"
```

**If backend changed, use optimized deploy:**

```bash
echo "📦 Starting optimized backend deploy..."

cd /Users/robertharder/GitHub/teeem

# Ensure files are flushed to disk
sync
sleep 1

# Create SINGLE temp directory (reused for all 3 environments)
DEPLOY_DIR=$(mktemp -d)
cp -R backend/* "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
git init
git add -A
git commit -m "Deploy $(date +%Y%m%d-%H%M%S)"

# Add all remotes upfront
git remote add staging https://git.heroku.com/teeem-staging.git
git remote add beta https://git.heroku.com/teeem-beta.git
git remote add production https://git.heroku.com/teeem-production.git

# STEP 1: Deploy to Staging first (safety check)
echo "📦 Deploying → Staging..."
git push staging HEAD:main --force
STAGING_EXIT=$?

if [ $STAGING_EXIT -ne 0 ]; then
  echo "❌ Staging deploy failed - aborting pipeline"
  cd /Users/robertharder/GitHub/teeem
  rm -rf "$DEPLOY_DIR"
  exit 1
fi
echo "✅ Staging backend deployed"

# STEP 2: Deploy to Beta AND Production in PARALLEL
echo "📦 Deploying → Beta + Production (parallel)..."
git push beta HEAD:main --force &
BETA_PID=$!
git push production HEAD:main --force &
PROD_PID=$!

# Wait for both to complete
wait $BETA_PID
BETA_EXIT=$?
wait $PROD_PID
PROD_EXIT=$?

# Cleanup
cd /Users/robertharder/GitHub/teeem
rm -rf "$DEPLOY_DIR"

# Report results
if [ $BETA_EXIT -eq 0 ]; then
  echo "✅ Beta backend deployed"
else
  echo "❌ Beta deploy failed (exit: $BETA_EXIT)"
fi

if [ $PROD_EXIT -eq 0 ]; then
  echo "✅ Production backend deployed"
else
  echo "❌ Production deploy failed (exit: $PROD_EXIT)"
fi

echo "✅ All backend deploys complete"
```

### Step 8 - Smart Migration Verification (Only if migrations changed)

**Only run migration check if commit includes db/migrate files:**

```bash
if git diff --name-only HEAD~10 HEAD 2>/dev/null | grep -q "^backend/db/migrate/"; then
  echo "🔄 Migrations detected - verifying..."

  # Check all 3 environments
  echo "Checking Staging migrations..."
  heroku run "rails db:migrate:status | tail -5" --app teeem-staging

  echo "Checking Beta migrations..."
  heroku run "rails db:migrate:status | tail -5" --app teeem-beta

  echo "Checking Production migrations..."
  heroku run "rails db:migrate:status | tail -5" --app teeem-production

  echo "✅ Migration verification complete"
else
  echo "⏭️  No migrations in commit - skipping verification"
fi
```

### Step 9 - Post-Deploy Verification (Production Only)

**OPTIMIZED (Jan 2026):** Single dyno boot instead of 3 (~30s savings)

```bash
sleep 10

# Combined verification (single dyno boot)
heroku run rails runner "
  # 1. Check recurring tasks
  tasks = SolidQueue::RecurringTask.pluck(:key)
  critical = ['xero_health_monitor', 'refresh_integration_tokens', 'daily_health_check']
  missing = critical - tasks
  puts missing.any? ? '❌ MISSING: ' + missing.join(', ') : '✅ Recurring: ' + tasks.count.to_s + ' tasks'

  # 2. Check health monitor
  last = XeroSyncEvent.where(sync_type: 'health_check').order(created_at: :desc).first
  if last&.event_type == 'completed'
    puts '✅ Health: ' + last.created_at.in_time_zone('Australia/Brisbane').strftime('%H:%M')
  else
    puts '⚠️  Health: ' + (last&.error_message || 'no data')
  end

  # 3. Check Xero credentials
  total = XeroCredential.count
  expired = XeroCredential.all.count { |c| c.expired? }
  puts expired > 0 ? '⚠️  Xero: ' + expired.to_s + '/' + total.to_s + ' expired' : '✅ Xero: ' + total.to_s + ' valid'
" --app teeem-production
```

### Step 10 - Report Status

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

Backend (Heroku - optimized parallel deploy):
  ✅ Staging: deployed (safety check first)
  ✅ Beta: deployed (parallel)
  ✅ Production: v[XXX] deployed (parallel)
----------------------------------------
Post-Deploy Verification:
  [verification results]
========================================
```

## Error Handling

If any step fails:
1. Report which step failed
2. Do NOT proceed to next environment (staging failure stops everything)
3. Provide recovery instructions

**Staging acts as gate:** If staging deploy fails, beta and production are NOT attempted.

## Notes

- Commits ALL changes from ALL chat sessions
- Deploys BOTH frontend AND backend to ALL THREE environments
- Frontend: Vercel auto-deploys when branches are merged (Staging → Beta → Live)
- Backend: Single temp directory, staging first, then beta+production in parallel
- Migration verification only runs if db/migrate files changed
- Post-deploy verification runs for Production only
- Use `/p` if you only want to commit THIS chat's changes
- Use `/ba` if you only want to deploy up to Beta
- Use `/sa` if you only want to deploy to Staging
