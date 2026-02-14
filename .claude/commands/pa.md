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

## Optimizations (Feb 2026)

| Optimization | Savings |
|--------------|---------|
| Pipeline promotion (build once on staging, promote slug to beta+prod) | ~4-5 min |
| Parallel worker deploys (all 3 workers push simultaneously) | ~6-8 min |
| Overlap branch merges with Heroku deploy (concurrent) | ~1-2 min |
| Conditional post-deploy (curl health check vs full dyno boot) | ~30-60s |
| Standalone Next.js output (smaller Vercel uploads) | ~1-3 min |
| Smart migration check (only if db/migrate changed) | ~10-30s |
| Vercel branch filtering (each project builds only its branch) | ~9 duplicate builds eliminated |
| Skip frontend merges on backend-only deploys | ~30s git ops + avoids unnecessary Vercel builds |
| Turbopack production builds | ~1-2 min per Vercel build |

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

### Step 6 - Deploy Backend + Merge Frontend Branches (CONCURRENT)

**Check if backend files changed in recent commits (last 10):**
```bash
git diff --name-only HEAD~10 HEAD 2>/dev/null | grep -q "^backend/" && echo "BACKEND: Deploy needed" || echo "BACKEND: No changes, skip"
```

**Run backend deploy and frontend branch merges concurrently.**
The branch merges (fast-forward) take seconds while the Heroku deploy takes minutes.
Starting them together saves ~1-2 min of dead time.

#### 6a - Start Backend Deploy (if needed)

**If backend changed, build on staging then promote to beta and production:**

```bash
echo "📦 Starting backend deploy with pipeline promotion..."

cd /Users/robertharder/GitHub/teeem

# Ensure files are flushed to disk
sync
sleep 1

# Build ONE temp dir - reused for ALL Heroku pushes (staging + workers)
DEPLOY_DIR=$(mktemp -d)
rsync -a --exclude='.git' --exclude-from=backend/.slugignore backend/ "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
git init
git add -A
git commit -m "Deploy $(date +%Y%m%d-%H%M%S)"
git remote add staging https://git.heroku.com/teeem-staging.git
git remote add staging-worker https://git.heroku.com/teeem-shared-worker.git
git remote add beta-worker https://git.heroku.com/teeem-beta-worker.git 2>/dev/null
git remote add prod-worker https://git.heroku.com/teeem-production-worker.git 2>/dev/null

echo "📦 Building slug on Staging + deploying workers in PARALLEL..."

# Push staging (main slug build) and ALL workers in parallel
git push staging HEAD:main --force &
PID_STAGING=$!

git push staging-worker HEAD:main --force &
PID_SW=$!

git push beta-worker HEAD:main --force 2>/dev/null &
PID_BW=$!

git push prod-worker HEAD:main --force 2>/dev/null &
PID_PW=$!

# Wait for staging first (it's the gate)
wait $PID_STAGING
STAGING_EXIT=$?

# Wait for workers (non-blocking, report failures)
wait $PID_SW 2>/dev/null || echo "⚠️ Staging worker push failed"
wait $PID_BW 2>/dev/null || echo "⚠️ Beta worker not available"
wait $PID_PW 2>/dev/null || echo "⚠️ Production worker not available"

cd /Users/robertharder/GitHub/teeem
rm -rf "$DEPLOY_DIR"

if [ $STAGING_EXIT -ne 0 ]; then
  echo "❌ Staging deploy failed - aborting pipeline"
  exit 1
fi
echo "✅ Staging backend + all workers deployed"

# Promote compiled slug to Beta (no rebuild - instant copy)
echo "📦 Promoting Staging → Beta..."
heroku pipelines:promote --app teeem-staging --to teeem-beta
BETA_EXIT=$?

if [ $BETA_EXIT -eq 0 ]; then
  echo "✅ Beta backend promoted"
else
  echo "❌ Beta promotion failed (exit: $BETA_EXIT)"
fi

# Promote compiled slug to Production (no rebuild - instant copy)
echo "📦 Promoting Staging → Production..."
heroku pipelines:promote --app teeem-staging --to teeem-production
PROD_EXIT=$?

if [ $PROD_EXIT -eq 0 ]; then
  echo "✅ Production backend promoted"
else
  echo "❌ Production promotion failed (exit: $PROD_EXIT)"
fi

echo "✅ All backend deploys complete"
```

#### 6b - Merge Frontend Branches (runs while backend deploys)

**This triggers Vercel auto-deploy for Beta and Production frontends.**
Run this concurrently with Step 6a (while Heroku build is running).

**Skip entirely if no frontend changes (saves ~30s git ops + prevents unnecessary Vercel builds).**

```bash
if git diff --name-only HEAD~10 HEAD 2>/dev/null | grep -q "^frontend-next/"; then
  echo "🔀 Frontend changes detected - merging branches..."

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
else
  echo "⏭️  No frontend changes - skipping branch merge (Vercel won't rebuild)"
fi
```

### Step 7 - Smart Migration Verification (Only if migrations changed)

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

### Step 8 - Post-Deploy Verification (Conditional)

**OPTIMIZED (Feb 2026):** Fast health check by default, full verification only when migrations detected.

#### Routine deploys (no migrations): Fast curl health check (~5s)
```bash
sleep 5

echo "🏥 Quick health check..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://teeem-production-121159e1ff9d.herokuapp.com/api/v1/health 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Production API healthy (HTTP 200)"
else
  echo "⚠️ Production API returned HTTP $HTTP_STATUS - running full verification..."
  # Fall through to full verification below
fi
```

#### If migrations detected OR health check failed: Full dyno verification (~30s)
```bash
if git diff --name-only HEAD~10 HEAD 2>/dev/null | grep -q "^backend/db/migrate/" || [ "$HTTP_STATUS" != "200" ]; then
  echo "🔍 Running full post-deploy verification..."
  sleep 5

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
fi
```

### Step 9 - Report Status

```bash
BACKEND_VERSION=$(curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version | jq -r '.version' 2>/dev/null || echo "unknown")
BRISBANE_TIME=$(TZ='Australia/Brisbane' date '+%H:%M %d/%m')
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%s)
FRONTEND_DEPLOYED=$(git diff --name-only HEAD~10 HEAD 2>/dev/null | grep -q "^frontend-next/" && echo "deployed" || echo "skipped")
```

**Output format:**
```
========================================
FULL PIPELINE DEPLOYED: HH:MM DD/MM (Brisbane)
Commit: [hash] - [message]
----------------------------------------
Frontend (Vercel - auto-deploy on branch merge):
  ✅ Staging: Staging branch pushed
  ✅ Beta: [merged/skipped (no frontend changes)]
  ✅ Production: [merged/skipped (no frontend changes)]

Backend (Heroku - pipeline promotion):
  ✅ Staging: deployed (slug built)
  ✅ Beta: promoted (slug copied, no rebuild)
  ✅ Production: v[XXX] promoted (slug copied, no rebuild)
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
- Backend: Build slug on staging, promote to beta+production via Heroku pipeline
- Migration verification only runs if db/migrate files changed
- Post-deploy verification runs for Production only
- Use `/p` if you only want to commit THIS chat's changes
- Use `/ba` if you only want to deploy up to Beta
- Use `/sa` if you only want to deploy to Staging
