# Push to Live (Forward Sync All Environments)

**Shortcut:** `/live` (Sync all environments to be identical)

Merges ALL branches together so Staging, Beta, and Live all have the same code. Handles the case where hotfixes were committed directly to Production or Beta.

## Pipeline Flow
```
       ┌─────────────────────────┐
       │    SYNC ALL BRANCHES    │
       └─────────────────────────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
 Staging ◄──► Beta ◄──► Live
    │         │         │
    └─────────┴─────────┘
      All identical after sync
```

## Optimizations (Jan 2026)

| Optimization | Savings |
|--------------|---------|
| Single temp directory (reused for all 3 deploys) | ~2s |
| Parallel beta+production deploys | ~60-90s |
| Smart migration check (only if db/migrate changed) | ~10-30s |

## When to Use

- After a hotfix was committed directly to Production or Beta
- When branches have diverged and need to be synchronized
- Before starting new development to ensure clean slate
- To make all environments run the same code

## Instructions

### Step 1 - Pre-Flight Checks
```bash
git branch --show-current
git status --short
```

**IMPORTANT: Working tree should be clean. Stash or commit changes first.**

### Step 2 - Stash Any Uncommitted Changes
```bash
if [ -n "$(git status --porcelain)" ]; then
    git stash push -m "live-auto-stash-$(date +%Y%m%d-%H%M%S)"
    echo "✅ Changes stashed"
fi
```

### Step 3 - Fetch All Branches
```bash
git fetch origin Live Beta Staging
echo "✅ All branches fetched"
```

### Step 4 - Merge Everything into Staging (Staging becomes the unified branch)

```bash
echo "🔀 Merging all branches into Staging..."

git checkout Staging
git pull origin Staging

# Merge Beta into Staging (gets any Beta-only changes)
echo "Merging Beta → Staging..."
git merge origin/Beta --no-edit || {
    echo "⚠️ Merge conflict: Beta → Staging"
    echo "Resolve conflicts, then run: git add . && git commit"
    exit 1
}

# Merge Live into Staging (gets any Production hotfixes)
echo "Merging Live → Staging..."
git merge origin/Live --no-edit || {
    echo "⚠️ Merge conflict: Live → Staging"
    echo "Resolve conflicts, then run: git add . && git commit"
    exit 1
}

git push origin Staging
echo "✅ Staging now has ALL changes from all branches"
```

### Step 5 - Update Beta to Match Staging

```bash
echo "🔀 Syncing Beta with Staging..."

git checkout Beta
git pull origin Beta
git merge Staging --no-edit || {
    echo "⚠️ Merge conflict: Staging → Beta"
    echo "Resolve conflicts, then run: git add . && git commit"
    exit 1
}
git push origin Beta
echo "✅ Beta synchronized"
```

### Step 6 - Update Live to Match Staging

```bash
echo "🔀 Syncing Live with Staging..."

git checkout Live
git pull origin Live
git merge Staging --no-edit || {
    echo "⚠️ Merge conflict: Staging → Live"
    echo "Resolve conflicts, then run: git add . && git commit"
    exit 1
}
git push origin Live
echo "✅ Live synchronized"
```

### Step 7 - Return to Staging
```bash
git checkout Staging
echo "✅ All branches now identical"
```

### Step 8 - Deploy Backend to All Environments (OPTIMIZED - Single Directory, Parallel)

**All three backends need the unified code. Uses single temp directory and parallel deploys.**

```bash
echo "📦 Starting optimized backend deploy to ALL environments..."

cd /Users/robertharder/GitHub/teeem

# Ensure files are flushed to disk
sync
sleep 1

# Create SINGLE temp directory (reused for all 3 environments)
DEPLOY_DIR=$(mktemp -d)
# FIX (Feb 2026): Use rsync to copy ALL files including hidden (.slugignore)
rsync -a --exclude='.git' backend/ "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
git init
git add -A
git commit -m "Sync deploy $(date +%Y%m%d-%H%M%S)"

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

### Step 9 - Smart Migration Verification (Only if migrations changed)

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

### Step 10 - Pop Stash if Needed
```bash
if git stash list | grep -q "live-auto-stash"; then
    git stash pop
    echo "✅ Stashed changes restored"
fi
```

### Step 11 - Post-Deploy Verification

```bash
sleep 10

heroku run rails runner "
  tasks = SolidQueue::RecurringTask.pluck(:key)
  critical = ['xero_health_monitor', 'refresh_integration_tokens', 'daily_health_check']
  missing = critical - tasks
  if missing.any?
    puts '❌ MISSING RECURRING TASKS: ' + missing.join(', ')
  else
    puts '✅ Recurring tasks OK (' + tasks.count.to_s + ' registered)'
  end
" --app teeem-production
```

### Step 12 - Report Status

```bash
BRISBANE_TIME=$(TZ='Australia/Brisbane' date '+%H:%M %d/%m')
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%s)
```

**Output format:**
```
========================================
ALL ENVIRONMENTS SYNCED: HH:MM DD/MM (Brisbane)
Unified commit: [hash] - [message]
----------------------------------------
Git Branches (all identical):
  ✅ Staging: merged Beta + Live, pushed
  ✅ Beta: merged Staging, pushed
  ✅ Live: merged Staging, pushed

Frontend (Vercel - auto-deploy on push):
  ✅ Staging: deployed
  ✅ Beta: deployed
  ✅ Live: deployed

Backend (Heroku - optimized parallel deploy):
  ✅ Staging: deployed (safety check first)
  ✅ Beta: deployed (parallel)
  ✅ Production: deployed (parallel)
----------------------------------------
All environments now running identical code
========================================
```

## Error Handling

**If merge conflicts occur:**
1. Stop and show the conflict
2. List conflicting files
3. Show both versions for each conflict
4. Ask user how to resolve
5. After resolution, continue with remaining merges

**If any deploy fails:**
1. Report which environment failed
2. Show Heroku logs: `heroku logs --app teeem-[env] -n 50`
3. Continue with other environments (they're independent)

## How It Differs from Other Commands

| Command | Direction | What It Does |
|---------|-----------|--------------|
| `/live` | Bidirectional | Merges ALL into ALL (true sync) |
| `/ma` | Backward only | Live → Beta → Staging |
| `/pa` | Forward only | Staging → Beta → Live |

## Notes

- This is a **true sync** - all branches become identical
- Handles hotfixes committed to any branch
- Merges are non-destructive (preserves git history)
- If no conflicts, all branches will have exact same code
- Ends on Staging branch
- Auto-stashes and restores local changes
