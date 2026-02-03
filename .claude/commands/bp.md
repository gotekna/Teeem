# Deploy Beta to Production

**Shortcut:** `/bp` (Beta → Production)

Deploys the current beta code to the production Heroku environment (teeem-production). No branch merging - just deploys.

## Pipeline Position
```
staging ──► beta ──► production
                 ▲
              YOU ARE HERE
```

## ⚠️ PRODUCTION DEPLOY - USE CAUTION

This deploys to the live production environment. Ensure:
- Changes have been tested on beta
- No known issues in beta
- You have approval to deploy to production

## Instructions

### Step 1 - Pre-Flight Checks
```bash
git branch --show-current
git status --short
```

**IMPORTANT: Commit any uncommitted changes first.**

### Step 2 - Ensure Code is Up to Date
```bash
git pull origin staging
```

### Step 3 - Deploy Backend to Production

```bash
cd /Users/robertharder/GitHub/teeem

sync
sleep 1

DEPLOY_DIR=$(mktemp -d)
# FIX (Feb 2026): Use rsync to copy ALL files including hidden (.slugignore)
rsync -a --exclude='.git' backend/ "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
git init
git add .
git commit -m "Deploy to Production $(date +%Y%m%d-%H%M%S)"
git remote add heroku https://git.heroku.com/teeem-production.git
git push heroku HEAD:main --force
cd /Users/robertharder/GitHub/teeem
rm -rf "$DEPLOY_DIR"
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

**Get version:**
```bash
BACKEND_VERSION=$(curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version | jq -r '.version' 2>/dev/null || echo "unknown")
BRISBANE_TIME=$(TZ='Australia/Brisbane' date '+%H:%M %d/%m')
```

**Output format:**
```
========================================
PRODUCTION DEPLOYED: HH:MM DD/MM (Brisbane)
Source: staging branch
----------------------------------------
Backend: v[XXX] - deployed to teeem-production
========================================
```

## Error Handling

If deploy fails:
1. Report the error
2. Check Heroku logs: `heroku logs --app teeem-production -n 50`
3. Retry if needed

## Notes

- This deploys staging code directly to production Heroku
- No git branch operations - staging branch stays as-is
- Post-deploy verification runs automatically
- Frontend: Configure Vercel to deploy to production URL
