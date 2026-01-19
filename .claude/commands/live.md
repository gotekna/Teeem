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

### Step 8 - Deploy Backend to All Environments

**All three backends need the unified code:**

```bash
echo "📦 Deploying unified backend to ALL environments..."

cd /Users/robertharder/GitHub/teeem

# Deploy to Staging
echo "Deploying → Staging..."
sync && sleep 1
DEPLOY_DIR=$(mktemp -d)
cp -r backend/* "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"
git init && git add . && git commit -m "Sync deploy to Staging $(date +%Y%m%d-%H%M%S)"
git remote add heroku https://git.heroku.com/teeem-staging.git
git push heroku HEAD:main --force
cd /Users/robertharder/GitHub/teeem && rm -rf "$DEPLOY_DIR"
echo "✅ Staging backend deployed"

# Deploy to Beta
echo "Deploying → Beta..."
sync && sleep 1
DEPLOY_DIR=$(mktemp -d)
cp -r backend/* "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"
git init && git add . && git commit -m "Sync deploy to Beta $(date +%Y%m%d-%H%M%S)"
git remote add heroku https://git.heroku.com/teeem-beta.git
git push heroku HEAD:main --force
cd /Users/robertharder/GitHub/teeem && rm -rf "$DEPLOY_DIR"
echo "✅ Beta backend deployed"

# Deploy to Production
echo "Deploying → Production..."
sync && sleep 1
DEPLOY_DIR=$(mktemp -d)
cp -r backend/* "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"
git init && git add . && git commit -m "Sync deploy to Production $(date +%Y%m%d-%H%M%S)"
git remote add heroku https://git.heroku.com/teeem-production.git
git push heroku HEAD:main --force
cd /Users/robertharder/GitHub/teeem && rm -rf "$DEPLOY_DIR"
echo "✅ Production backend deployed"
```

### Step 9 - Pop Stash if Needed
```bash
if git stash list | grep -q "live-auto-stash"; then
    git stash pop
    echo "✅ Stashed changes restored"
fi
```

### Step 10 - Post-Deploy Verification

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

### Step 11 - Report Status

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

Backend (Heroku - direct deploy):
  ✅ Staging: deployed to teeem-staging
  ✅ Beta: deployed to teeem-beta
  ✅ Production: deployed to teeem-production
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
