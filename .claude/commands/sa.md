# Deploy ALL Changes to Staging

**Shortcut:** `/sa` (Staging All - Everything)

Commits ALL pending changes from ALL chat sessions and deploys to staging environment.

**Use `/s` to commit and deploy only THIS chat's changes instead.**

> **NOTE:** This file and `/s.md` share the same deployment logic.
> If you update one, update the other to stay in sync.

## STAGING DEPLOY

- Backend: Heroku (`teeem-staging`) - manual deploy via FAST orphan method
- Frontend: Auto-deploys from GitHub push (no version tracking)

## Vercel Branch Filtering (Jan 2026)

Each Vercel project only builds its designated branch via `DEPLOY_BRANCH` env var:
- `teeem-staging` → only builds `Staging` branch
- `teeem-beta` → only builds `Beta` branch
- `teeem-production` → only builds `Live` branch
- Dev environments (jake/sam/rob) → only build their personal branches

**Result:** No duplicate builds. Push to Staging only triggers `teeem-staging`.

## Instructions

### Step 1 - Pre-Flight Checks
```bash
git branch --show-current
git status --short
```

### Step 2 - ALWAYS Pull and Check for Stashes
**CRITICAL: Always run these - don't skip!**
```bash
git pull origin Staging
git stash list
```
*If stashes exist, pop them: `git stash pop`*

### Step 3 - Verify Backend Changes Before Commit
**IMPORTANT: If `git status --short` shows ANY backend/ files, note them here.**
**After commit, verify they were included with `git diff --name-only HEAD~10 HEAD 2>/dev/null | grep backend/`**

If backend files were shown in status but NOT in the committed diff, STOP and investigate.

### Step 4 - Pre-Commit Validation (BEFORE commit!)

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

### Step 5 - Auto-Generate Commit Message and Commit

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

### Step 6 - Push to GitHub
```bash
git push origin Staging
```
*Frontend auto-deploys from this push*

### Step 6.5 - Verify Backend Changes Were Committed
**CRITICAL: If Step 1 showed backend/ files, verify they're in the commit:**
```bash
git diff --name-only HEAD~10 HEAD 2>/dev/null | grep backend/
```
**If backend files were in `git status` but NOT in the commit diff, STOP and investigate!**

### Step 7 - Deploy Backend to Staging (ONLY if backend changed)

**Check if backend files were in the commit:**
```bash
git diff --name-only HEAD~10 HEAD 2>/dev/null | grep -q "^backend/" && echo "BACKEND: Deploy needed" || echo "BACKEND: No changes, skip Heroku"
```

**If backend changed**, run additional backend checks then deploy:
```bash
# Check migrations can run locally
if git diff --name-only HEAD~10 HEAD 2>/dev/null | grep "^backend/db/migrate/" > /dev/null; then
  echo "Checking migrations..."
  cd backend && bin/rails db:migrate:status > /dev/null 2>&1 || {
    echo "❌ Migration check failed - fix locally first"
    cd ..
    exit 1
  }
  cd ..
  echo "✅ Migrations OK"
fi

# ULTRA-FAST DEPLOY - direct push from temp directory (~5 seconds total)
# Avoids slow git subtree split entirely
cd /Users/robertharder/GitHub/teeem

# CRITICAL: Ensure all file writes are flushed to disk before copying
sync
sleep 1

DEPLOY_DIR=$(mktemp -d)
# FIX (Feb 2026): Use rsync to copy ALL files including hidden (.slugignore)
rsync -a --exclude='.git' backend/ "$DEPLOY_DIR/"

# VERIFICATION: Check that latest changes are in copied directory
# Compare git HEAD with copied files to ensure Edit tool changes are included
if git diff --name-only HEAD~10 HEAD 2>/dev/null | grep "^backend/" > /dev/null; then
  echo "✅ Verifying copied files match git commit..."
  git diff --name-only HEAD~10 HEAD 2>/dev/null | grep "^backend/" | while read file; do
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
git remote add heroku https://git.heroku.com/teeem-staging.git
git push heroku HEAD:main --force
cd /Users/robertharder/GitHub/teeem
rm -rf "$DEPLOY_DIR"
```

**If no backend changes, skip this step entirely.**

### Step 8 - Report Status

**Get version and show deploy status:**

```bash
BACKEND_VERSION=$(curl -s https://teeem-staging-*.herokuapp.com/version | jq -r '.version' 2>/dev/null || echo "unknown")
BRISBANE_TIME=$(TZ='Australia/Brisbane' date '+%H:%M %d/%m')
BACKEND_DEPLOYED=$(git diff --name-only HEAD~10 HEAD 2>/dev/null | grep -q "^backend/" && echo "deployed" || echo "skipped")
```

**Output format:**
```
========================================
STAGING DEPLOYED: HH:MM DD/MM (Brisbane)
Commit: [hash] - [message]
----------------------------------------
Backend: v[XXX] - [deployed/skipped]
========================================
```

## Error Handling

If any step fails:
1. Report which step failed
2. Stay on staging branch
3. Provide recovery instructions

### Release Command Failures (Expected)

The Heroku release command (`deploy:prepare` + `increment_version`) may fail with:
```
release command failed: too many connections for role
```

**This is OK!** The code still deploys successfully.

**If you need migrations to run:**
```bash
heroku run rails db:migrate --app teeem-staging
```

## Notes

- Commits ALL changes from ALL chat sessions
- Deploys to Staging ONLY
- Frontend auto-deploys from GitHub push (no version tracking needed)
- Backend only deploys if changes detected in `backend/` directory
- Use `/ba` to also deploy to Beta
- Use `/pa` to deploy all the way to Production
- Use `/s` to commit only THIS chat's changes
