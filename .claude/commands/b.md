# Deploy THIS Chat's Changes to Beta

**Shortcut:** `/b` (Beta - This Chat Only)

Commits only THIS chat session's changes and deploys to Staging AND Beta environments.

**Use `/ba` to commit ALL pending changes from ALL sessions instead.**

> **NOTE:** This file and `/ba.md` share the same deployment logic.
> If you update one, update the other to stay in sync.

## Pipeline Flow
```
[commit] ──► Staging ──► Beta
                │          │
           Frontend   Frontend
           (Vercel)   (Vercel)
                │          │
           Backend    Backend
           (Heroku)   (Heroku)
```

## Optimizations (Jan 2026)

| Optimization | Savings |
|--------------|---------|
| Single temp directory (reused for both deploys) | ~1s |
| Smart migration check (only if db/migrate changed) | ~10-20s |
| Vercel branch filtering (each project builds only its branch) | ~6 duplicate builds eliminated |

## Vercel Branch Filtering

Each Vercel project only builds its designated branch via `DEPLOY_BRANCH` env var:
- `teeem-staging` → only builds `Staging` branch
- `teeem-beta` → only builds `Beta` branch
- `teeem-production` → only builds `Live` branch
- Dev environments (jake/sam/rob) → only build their personal branches

**Result:** `/b` triggers exactly 2 Vercel builds (Staging + Beta), not 6+.

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

### Step 4.5 - Merge Frontend Branch (Staging → Beta)

**This triggers Vercel auto-deploy for Beta frontend.**

```bash
echo "🔀 Merging frontend branch Staging → Beta..."

# Save current branch
CURRENT_BRANCH=$(git branch --show-current)

# Merge Staging → Beta
git checkout Beta
git pull origin Beta
git merge Staging -m "Merge Staging into Beta for deployment"
git push origin Beta
echo "✅ Beta frontend updated"

# Return to original branch
git checkout "$CURRENT_BRANCH"
echo "✅ Frontend branch merged"
```

### Step 4.6 - Verify Backend Changes Were Committed
**CRITICAL: If Step 1 showed backend/ files, verify they're in the commit:**
```bash
git diff --name-only HEAD~10 HEAD 2>/dev/null | grep backend/
```
**If backend files were in `git status` but NOT in the commit diff, STOP and investigate!**

### Step 5 - Deploy Backend (OPTIMIZED - Single Directory)

**Check if backend files were in the commit:**
```bash
git diff --name-only HEAD~10 HEAD 2>/dev/null | grep -q "^backend/" && echo "BACKEND: Deploy needed" || echo "BACKEND: No changes, skip Heroku"
```

**If backend changed, use optimized deploy:**

```bash
echo "📦 Starting optimized backend deploy..."

cd /Users/robertharder/GitHub/teeem

# Ensure files are flushed to disk
sync
sleep 1

# Create SINGLE temp directory (reused for both environments)
DEPLOY_DIR=$(mktemp -d)
# FIX (Feb 2026): Use rsync to copy ALL files including hidden (.slugignore)
rsync -a --exclude='.git' backend/ "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
git init
git add -A
git commit -m "Deploy $(date +%Y%m%d-%H%M%S)"

# Add both remotes upfront
git remote add staging https://git.heroku.com/teeem-staging.git
git remote add beta https://git.heroku.com/teeem-beta.git

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

# STEP 2: Deploy to Beta
echo "📦 Deploying → Beta..."
git push beta HEAD:main --force
BETA_EXIT=$?

# Cleanup
cd /Users/robertharder/GitHub/teeem
rm -rf "$DEPLOY_DIR"

if [ $BETA_EXIT -eq 0 ]; then
  echo "✅ Beta backend deployed"
else
  echo "❌ Beta deploy failed (exit: $BETA_EXIT)"
fi

echo "✅ All backend deploys complete"
```

**If no backend changes, skip this step entirely.**

### Step 6 - Smart Migration Verification (Only if migrations changed)

**Only run migration check if commit includes db/migrate files:**

```bash
if git diff --name-only HEAD~10 HEAD 2>/dev/null | grep -q "^backend/db/migrate/"; then
  echo "🔄 Migrations detected - verifying..."

  echo "Checking Staging migrations..."
  heroku run "rails db:migrate:status | tail -5" --app teeem-staging

  echo "Checking Beta migrations..."
  heroku run "rails db:migrate:status | tail -5" --app teeem-beta

  echo "✅ Migration verification complete"
else
  echo "⏭️  No migrations in commit - skipping verification"
fi
```

### Step 7 - Report Status

**Get version and show deploy status:**

```bash
BRISBANE_TIME=$(TZ='Australia/Brisbane' date '+%H:%M %d/%m')
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%s)
BACKEND_DEPLOYED=$(git diff --name-only HEAD~10 HEAD 2>/dev/null | grep -q "^backend/" && echo "deployed" || echo "skipped")
```

**Output format:**
```
========================================
BETA DEPLOYED: HH:MM DD/MM (Brisbane)
Commit: [hash] - [message]
----------------------------------------
Frontend (Vercel - auto-deploy on branch merge):
  ✅ Staging: Staging branch pushed
  ✅ Beta: Staging → Beta merged

Backend (Heroku - optimized single-directory deploy):
  ✅ Staging: [deployed/skipped]
  ✅ Beta: [deployed/skipped]
========================================
```

## Error Handling

If any step fails:
1. Report which step failed
2. Do NOT proceed to next environment (staging failure stops everything)
3. Provide recovery instructions

**Staging acts as gate:** If staging deploy fails, beta is NOT attempted.

## Notes

- Commits only THIS chat session's changes
- Deploys to Staging AND Beta
- Frontend auto-deploys via Vercel on GitHub push
- Backend: Single temp directory, staging first then beta
- Migration verification only runs if db/migrate files changed
- Use `/ba` if you want to commit ALL pending changes
- Use `/s` if you only want to deploy to Staging
- Use `/p` to deploy all the way to Production
