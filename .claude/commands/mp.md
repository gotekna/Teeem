# Merge to Production (Full Pipeline Deploy)

**Shortcut:** `/mp` (Merge to Production)

Deploys Staging code through Beta to Live (production). Full release pipeline.

## Pipeline Flow
```
Staging ──► Beta ──► Live
   │          │        │
   └──────────┴────────┘
     Deploy pipeline flow
```

## ⚠️ PRODUCTION DEPLOY - USE CAUTION

This deploys to the live production environment. Ensure:
- Changes have been tested on Staging
- No known issues
- You have approval to deploy to production

## Instructions

### Step 1 - Pre-Flight Checks
```bash
git branch --show-current
git status --short
```

**IMPORTANT: Working tree must be clean. Commit changes first if needed.**

### Step 2 - Ensure Staging is Up to Date
```bash
git checkout Staging
git pull origin Staging
```

### Step 3 - Deploy to Beta + Production (Single Temp Dir, Parallel Workers)

```bash
echo "📦 Deploying Staging → Beta + Production..."

cd /Users/robertharder/GitHub/teeem

sync
sleep 1

# Build ONE temp dir - reused for ALL pushes
DEPLOY_DIR=$(mktemp -d)
rsync -a --exclude='.git' --exclude-from=backend/.slugignore backend/ "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
git init
git add .
git commit -m "Deploy $(date +%Y%m%d-%H%M%S)"

# Add all remotes upfront
git remote add beta https://git.heroku.com/teeem-beta.git
git remote add production https://git.heroku.com/teeem-production.git
git remote add beta-worker https://git.heroku.com/teeem-beta-worker.git 2>/dev/null
git remote add prod-worker https://git.heroku.com/teeem-production-worker.git 2>/dev/null

# Deploy Beta web first (safety gate)
echo "📦 Deploying → Beta..."
git push beta HEAD:main --force
BETA_EXIT=$?

if [ $BETA_EXIT -ne 0 ]; then
  echo "❌ Beta deploy failed - aborting pipeline"
  cd /Users/robertharder/GitHub/teeem
  rm -rf "$DEPLOY_DIR"
  exit 1
fi
echo "✅ Beta deployed"

# Deploy Production web + ALL workers in PARALLEL
echo "📦 Deploying → Production + workers (parallel)..."
git push production HEAD:main --force &
PID_PROD=$!

git push beta-worker HEAD:main --force 2>/dev/null &
PID_BW=$!

git push prod-worker HEAD:main --force 2>/dev/null &
PID_PW=$!

wait $PID_PROD
PROD_EXIT=$?

wait $PID_BW 2>/dev/null || echo "⚠️ Beta worker not available"
wait $PID_PW 2>/dev/null || echo "⚠️ Production worker not available"

cd /Users/robertharder/GitHub/teeem
rm -rf "$DEPLOY_DIR"

if [ $PROD_EXIT -eq 0 ]; then
  echo "✅ Production deployed"
else
  echo "❌ Production deploy failed (exit: $PROD_EXIT)"
fi
```

### Step 4 - Run Post-Deploy Verification

```bash
# Wait for dyno to restart
sleep 10

# 1. Check recurring tasks are registered
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

# 2. Check health monitor status
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

### Step 5 - Report Status

```bash
BACKEND_VERSION=$(curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version | jq -r '.version' 2>/dev/null || echo "unknown")
BRISBANE_TIME=$(TZ='Australia/Brisbane' date '+%H:%M %d/%m')
```

**Output format:**
```
========================================
FULL PIPELINE DEPLOYED: HH:MM DD/MM (Brisbane)
Source: Staging branch
----------------------------------------
✅ Beta: deployed to teeem-beta
✅ Production: v[XXX] - deployed to teeem-production
----------------------------------------
Post-Deploy Verification:
  [verification results]
========================================
```

## Error Handling

If beta deploy fails:
1. Report the error
2. Check Heroku logs: `heroku logs --app teeem-beta -n 50`
3. Do NOT proceed to production
4. Fix and retry

If production deploy fails:
1. Report the error
2. Check Heroku logs: `heroku logs --app teeem-production -n 50`
3. Retry if needed

## Notes

- Deploys staging code to both beta AND production
- No git branch merging - just code deployment
- Post-deploy verification runs automatically for production
- Frontend auto-deploys via Vercel on GitHub push (handled by `/sa`)
