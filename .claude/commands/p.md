# Deploy THIS Chat's Changes to Production

**Shortcut:** `/p` (Production - This Chat Only)

Commits only THIS chat session's changes and deploys through the entire pipeline: Staging → Beta → Production.

**Use `/pa` to commit ALL pending changes from ALL sessions instead.**

> **NOTE:** This file and `/pa.md` share the same deployment logic.
> If you update one, update the other to stay in sync.

## Pipeline Flow
```
[commit] ──► Staging ──► Beta ──► Production
                │          │          │
           Frontend   Frontend   Frontend
           (Vercel)   (Vercel)   (Vercel)
                │          │          │
           Backend    Backend    Backend
           (Heroku)   (Heroku)   (Heroku)
                         └────┬────┘
                      PIPELINE PROMOTE
```

## Optimizations (Feb 2026)

| Optimization | Savings |
|--------------|---------|
| Pipeline promotion (build once on staging, promote slug to beta+prod) | ~4-5 min |
| Sequential deploy (staging → worker → promote, no fragile background jobs) | reliable |
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

**Result:** `/p` triggers exactly 3 Vercel builds (Staging + Beta + Live), not 12+.

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

**IMPORTANT: Note if ANY backend/ files are shown above. After commit, verify they were included.**

### Step 1.5 - Pull Latest (if needed)
```bash
git pull origin Staging
```

### Step 2 - Pre-Commit Validation (BEFORE commit!)

**CRITICAL: Run these checks on working directory BEFORE committing to catch errors early.**

```bash
echo "🔍 Pre-commit validation..."

# Check TypeScript compiles (catches type errors BEFORE they hit Vercel)
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

# Check Ruby syntax in changed backend files
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

# Check Gemfile.lock updated if Gemfile changed
if git status --short | grep -E "backend/Gemfile$" > /dev/null; then
  if ! git status --short | grep -E "backend/Gemfile.lock" > /dev/null; then
    echo "❌ Gemfile changed but Gemfile.lock not updated"
    echo "   Run: cd backend && bundle install"
    exit 1
  fi
  echo "✅ Gemfile.lock updated"
fi

echo "✅ Pre-commit validation passed"
```

**If any check fails, fix the errors before proceeding.**

### Step 3 - Commit This Chat's Changes

**Auto-generate commit message based on changes:**

Rules (in priority order):
1. Only `package.json` version → `chore: Bump version to X.X.X`
2. `.claude/commands/*` → `chore: Update slash commands`
3. `db/migrate/*` → `feat: Add migration`
4. Backend `.rb` → `feat: Update backend`
5. Frontend `.tsx/.jsx` → `feat: Update frontend`
6. Multiple types → Combine appropriately
7. Default → `chore: Update project files`

```bash
git add -A
git commit -m "[auto-generated message]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 4 - Push to GitHub Staging
```bash
git push origin Staging
```
*Staging frontend auto-deploys from this push*

### Step 4.5 - Verify Backend Changes Were Committed
**CRITICAL: If Step 1 showed backend/ files, verify they're in the commit:**
```bash
git diff --name-only HEAD~10 HEAD 2>/dev/null | grep backend/
```
**If backend files were in `git status` but NOT in the commit diff, STOP and investigate!**

### Step 5 - Deploy Backend + Merge Frontend Branches (CONCURRENT)

**Check if backend files were in the commit:**
```bash
git diff --name-only HEAD~10 HEAD 2>/dev/null | grep -q "^backend/" && echo "BACKEND: Deploy needed" || echo "BACKEND: No changes, skip Heroku"
```

**Run backend deploy and frontend branch merges concurrently.**
The branch merges (fast-forward) take seconds while the Heroku deploy takes minutes.
Starting them together saves ~1-2 min of dead time.

#### 5a - Start Backend Deploy (if needed)

**If backend changed, build on staging then promote to beta and production:**

```bash
echo "📦 Starting backend deploy with pipeline promotion..."

cd /Users/robertharder/GitHub/teeem

# Build temp dir with backend/ only (monorepo → Heroku-compatible layout)
DEPLOY_DIR=$(mktemp -d)
rsync -a --exclude='.git' --exclude-from=backend/.slugignore backend/ "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
git init
git add -A
git commit -m "Deploy $(date +%Y%m%d-%H%M%S)"

# 1. Push to Staging (builds slug, runs release phase with migrations)
git remote add staging https://git.heroku.com/teeem-staging.git
echo "📦 Building slug on Staging..."
git push staging HEAD:main --force
if [ $? -ne 0 ]; then
  cd /Users/robertharder/GitHub/teeem && rm -rf "$DEPLOY_DIR"
  echo "❌ Staging deploy failed - aborting pipeline"
  exit 1
fi
echo "✅ Staging deployed"

# 2. Push to shared worker (same code, separate dyno)
git remote add worker https://git.heroku.com/teeem-shared-worker.git
echo "📦 Deploying shared worker..."
git push worker HEAD:main --force || echo "⚠️ Shared worker deploy failed (non-blocking)"
echo "✅ Shared worker deployed"

cd /Users/robertharder/GitHub/teeem
rm -rf "$DEPLOY_DIR"

# 3. Promote compiled slug to Beta (no rebuild - instant copy)
echo "📦 Promoting Staging → Beta..."
heroku pipelines:promote --app teeem-staging --to teeem-beta
if [ $? -eq 0 ]; then
  echo "✅ Beta promoted"
else
  echo "❌ Beta promotion failed"
fi

# 4. Promote compiled slug to Production (no rebuild - instant copy)
echo "📦 Promoting Staging → Production..."
heroku pipelines:promote --app teeem-staging --to teeem-production
if [ $? -eq 0 ]; then
  echo "✅ Production promoted"
else
  echo "❌ Production promotion failed"
fi

echo "✅ All backend deploys complete"
```

**If no backend changes, skip Step 5a entirely.**

#### 5b - Merge Frontend Branches (runs while backend deploys)

**This triggers Vercel auto-deploy for Beta and Production frontends.**
Run this concurrently with Step 5a (while Heroku build is running).

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

### Step 6 - Smart Migration Verification (Only if migrations changed)

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

### Step 7 - Post-Deploy Verification (Conditional)

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

### Step 8 - Report Status

**Get version and show deploy status:**

```bash
BACKEND_VERSION=$(curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version | jq -r '.version' 2>/dev/null || echo "unknown")
BRISBANE_TIME=$(TZ='Australia/Brisbane' date '+%H:%M %d/%m')
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%s)
BACKEND_DEPLOYED=$(git diff --name-only HEAD~10 HEAD 2>/dev/null | grep -q "^backend/" && echo "deployed" || echo "skipped")
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
  ✅ Staging: [deployed/skipped] (slug built)
  ✅ Beta: [promoted/skipped] (slug copied, no rebuild)
  ✅ Production: v[XXX] - [promoted/skipped] (slug copied, no rebuild)
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

- Commits only THIS chat session's changes
- Deploys to ALL THREE environments: Staging, Beta, Production
- Frontend: Vercel auto-deploys on GitHub push/merge
- Backend: Build slug on staging, promote to beta+production via Heroku pipeline
- Migration verification only runs if db/migrate files changed
- Post-deploy verification runs for Production only
- Use `/pa` if you want to commit ALL pending changes
- Use `/b` if you only want to deploy up to Beta
- Use `/s` if you only want to deploy to Staging
