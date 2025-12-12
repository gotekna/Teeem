# Deploy ALL Changes to Production

**Shortcut:** `/lp` (Live Push - Everything)

Commits ALL pending changes from ALL chat sessions and deploys to production.

**Use `/l` to commit and deploy only THIS chat's changes instead.**

> **NOTE:** This file and `/l.md` share the same deployment logic.
> If you update one, update the other to stay in sync.

## PRODUCTION DEPLOY

- Backend: Heroku (`teeemlive`) - manual deploy via FAST orphan method
- Frontend: Vercel - auto-deploys from GitHub push

## Instructions

### Step 1 - Pre-Flight Checks
```bash
git branch --show-current
git status --short
```

### Step 2 - Ensure on Live Branch
```bash
git checkout Live
git pull origin Live
```

### Step 3 - Pop Any Stashed Changes

**Include any stashed work from other chats:**
```bash
git stash list
# If there are stashes from other chats, pop them:
git stash pop
```

### Step 4 - Auto-Generate Commit Message and Commit

**Analyze ALL changes and auto-generate message:**

Rules (in priority order):
1. Only `package.json` version → `chore: Bump version to X.X.X`
2. `.claude/commands/*` → `chore: Update slash commands`
3. `db/migrate/*` → `feat: Add migration`
4. Backend `.rb` → `feat: Update backend`
5. Frontend `.tsx/.jsx` → `feat: Update frontend`
6. Multiple types → Combine appropriately
7. Default → `chore: Update project files`

**Auto-commit ALL changes (including untracked):**
```bash
git add -A
git commit -m "[auto-generated message]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 5 - Push to GitHub
```bash
git push origin Live
```
*Vercel auto-deploys frontend from this push*

### Step 6 - Pre-Flight Checks (Fail Fast)

**Run before deploying to Heroku to catch errors early:**

```bash
echo "🔍 Pre-flight checks..."

# Check Ruby syntax in changed backend files
if git diff --name-only HEAD~1 HEAD | grep "^backend/.*\.rb$" > /dev/null; then
  echo "Checking Ruby syntax..."
  git diff --name-only HEAD~1 HEAD | grep "^backend/.*\.rb$" | while read file; do
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

# Check migrations can run locally
if git diff --name-only HEAD~1 HEAD | grep "^backend/db/migrate/" > /dev/null; then
  echo "Checking migrations..."
  cd backend && bin/rails db:migrate:status > /dev/null 2>&1 || {
    echo "❌ Migration check failed - fix locally first"
    cd ..
    exit 1
  }
  cd ..
  echo "✅ Migrations OK"
fi

# Check Gemfile.lock updated if Gemfile changed
if git diff --name-only HEAD~1 HEAD | grep "^backend/Gemfile$" > /dev/null; then
  if ! git diff --name-only HEAD~1 HEAD | grep "^backend/Gemfile.lock" > /dev/null; then
    echo "❌ Gemfile changed but Gemfile.lock not updated"
    echo "   Run: cd backend && bundle install"
    exit 1
  fi
  echo "✅ Gemfile.lock updated"
fi

echo "✅ Pre-flight checks passed"
```

### Step 7 - Deploy Backend (ONLY if backend changed)

**Check if backend files were in the commit:**
```bash
git diff --name-only HEAD~1 HEAD | grep -q "^backend/" && echo "BACKEND: Deploy needed" || echo "BACKEND: No changes, skip Heroku"
```

**If backend changed**, deploy to Heroku using FAST method (no history processing):
```bash
# ULTRA-FAST DEPLOY - direct push from temp directory (~5 seconds total)
# Avoids slow git subtree split entirely
cd /Users/robertharder/GitHub/teeem

# CRITICAL: Ensure all file writes are flushed to disk before copying
sync
sleep 1

DEPLOY_DIR=$(mktemp -d)
cp -r backend/* "$DEPLOY_DIR/"

# VERIFICATION: Check that latest changes are in copied directory
# Compare git HEAD with copied files to ensure Edit tool changes are included
if git diff --name-only HEAD~1 HEAD | grep "^backend/" > /dev/null; then
  echo "✅ Verifying copied files match git commit..."
  git diff --name-only HEAD~1 HEAD | grep "^backend/" | while read file; do
    if [ -f "$file" ] && [ -f "$DEPLOY_DIR/${file#backend/}" ]; then
      if ! diff -q "$file" "$DEPLOY_DIR/${file#backend/}" > /dev/null 2>&1; then
        echo "⚠️  Warning: $file differs between git and deploy directory"
      fi
    fi
  done
fi

cd "$DEPLOY_DIR"
git init
git add .
git commit -m "Deploy $(date +%Y%m%d-%H%M%S)"
git remote add heroku https://git.heroku.com/teeemlive.git
git push heroku HEAD:main --force
cd /Users/robertharder/GitHub/teeem
rm -rf "$DEPLOY_DIR"
```

**If no backend changes, skip this step entirely.**

### Step 8 - Report Status

**Show Brisbane time:**
```
========================================
DEPLOYED: HH:MM DD/MM (Brisbane)
Commit: [hash] - [message]
Backend: v[XXX] or "No changes - skipped"
Frontend: Auto-deployed via Vercel
Heroku: v[XXX] or "Skipped"
========================================
```

### Step 9 - Post-Deploy Verification (Backend only)

**If backend was deployed, verify critical systems are healthy:**

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
" --app teeemlive

# 2. Check recent health monitor ran successfully
heroku run rails runner "
  last = XeroSyncEvent.where(sync_type: 'health_check').order(created_at: :desc).first
  if last.nil?
    puts '⚠️  No health monitor runs found'
  elsif last.event_type == 'completed'
    puts '✅ Health monitor OK (last: ' + last.created_at.in_time_zone('Australia/Brisbane').strftime('%H:%M') + ')'
  else
    puts '❌ Health monitor failed: ' + (last.error_message || 'unknown')
  end
" --app teeemlive

# 3. Check Xero credentials status
heroku run rails runner "
  total = XeroCredential.count
  expired = XeroCredential.all.count { |c| c.expired? }
  if expired > 0
    puts '⚠️  Xero: ' + expired.to_s + '/' + total.to_s + ' tokens expired (will auto-refresh)'
  else
    puts '✅ Xero: ' + total.to_s + ' credentials, all tokens valid'
  end
" --app teeemlive

# 4. Check Xero sync health (are syncs running? check ALL tenants)
heroku run rails runner "
  stale_threshold = 60.minutes.ago
  stale_count = 0
  total = 0
  XeroSyncStatus.where(sync_type: 'invoices').where.not(tenant_id: nil).each do |s|
    total += 1
    if s.last_synced_at.nil? || s.last_synced_at < stale_threshold
      stale_count += 1
    end
  end
  if stale_count > 0
    puts '❌ STALE SYNCS: ' + stale_count.to_s + '/' + total.to_s + ' tenants not synced in 60min'
    puts '   Run: heroku run rails runner \"XeroHealthMonitorJob.perform_now\" --app teeemlive'
  else
    puts '✅ Xero syncs OK (' + total.to_s + ' tenants all synced within 60min)'
  end
" --app teeemlive
```

**If any check fails:**
- Recurring tasks missing → Check `config/recurring.yml` syntax
- Health monitor failed → Check logs: `heroku logs --app teeemlive -n 100 | grep -i health`
- Tokens expired → Will auto-refresh on next health monitor run (every 15 min)
- Stale syncs → Run health monitor manually to trigger self-heal

## Error Handling

If any step fails:
1. Report which step failed
2. Stay on Live branch
3. Provide recovery instructions

### Release Command Failures (Expected)

The Heroku release command (`deploy:prepare` + `increment_version`) may fail with:
```
release command failed: too many connections for role
```

**This is OK!** The code still deploys successfully. This happens when:
- Database connection pool is saturated (workers/jobs using all connections)
- Release command can't get a DB connection to run migrations

**What happens:**
- ✅ App restarts with new code (deploy succeeds)
- ❌ Release command fails (migrations/version increment)
- Both have error handling and retry logic

**If you need migrations to run:**
```bash
heroku run rails db:migrate --app teeemlive
```

**If you want to avoid this:**
- Deploy during low-traffic periods
- Or: Temporarily scale down workers before deploy

## Notes

- No pre-configured Heroku remote needed - the deploy script creates it on-the-fly
- Frontend deploys automatically via Vercel on GitHub push
- Backend only deploys if changes detected in `backend/` directory
