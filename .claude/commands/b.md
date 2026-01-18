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
                └──────────┘
              Deploy pipeline
```

## BETA DEPLOY

- Backend: Heroku (`teeem-staging` + `teeem-beta`) - manual deploy via FAST orphan method
- Frontend: Auto-deploys from GitHub push (no version tracking)

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

### Step 4 - Push to GitHub
```bash
git push origin Staging
```
*Frontend auto-deploys from this push*

### Step 4.5 - Verify Backend Changes Were Committed
**CRITICAL: If Step 1 showed backend/ files, verify they're in the commit:**
```bash
git diff --name-only HEAD~1 HEAD | grep backend/
```
**If backend files were in `git status` but NOT in the commit diff, STOP and investigate!**

### Step 5 - Deploy Backend to Staging (ONLY if backend changed)

**Check if backend files were in the commit:**
```bash
git diff --name-only HEAD~1 HEAD | grep -q "^backend/" && echo "BACKEND: Deploy needed" || echo "BACKEND: No changes, skip Heroku"
```

**If backend changed**, deploy to Staging:
```bash
echo "📦 Deploying → Staging..."

cd /Users/robertharder/GitHub/teeem

sync
sleep 1

DEPLOY_DIR=$(mktemp -d)
cp -r backend/* "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
git init
git add .
git commit -m "Deploy to Staging $(date +%Y%m%d-%H%M%S)"
git remote add heroku https://git.heroku.com/teeem-staging.git
git push heroku HEAD:main --force
cd /Users/robertharder/GitHub/teeem
rm -rf "$DEPLOY_DIR"

echo "✅ Staging deployed"
```

### Step 6 - Deploy Backend to Beta

**If backend changed**, deploy to Beta:
```bash
echo "📦 Deploying → Beta..."

cd /Users/robertharder/GitHub/teeem

sync
sleep 1

DEPLOY_DIR=$(mktemp -d)
cp -r backend/* "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
git init
git add .
git commit -m "Deploy to Beta $(date +%Y%m%d-%H%M%S)"
git remote add heroku https://git.heroku.com/teeem-beta.git
git push heroku HEAD:main --force
cd /Users/robertharder/GitHub/teeem
rm -rf "$DEPLOY_DIR"

echo "✅ Beta deployed"
```

**If no backend changes, skip Steps 5 and 6 entirely.**

### Step 7 - Report Status

**Get version and show deploy status:**

```bash
BRISBANE_TIME=$(TZ='Australia/Brisbane' date '+%H:%M %d/%m')
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%s)
BACKEND_DEPLOYED=$(git diff --name-only HEAD~1 HEAD | grep -q "^backend/" && echo "deployed" || echo "skipped")
```

**Output format:**
```
========================================
BETA DEPLOYED: HH:MM DD/MM (Brisbane)
Commit: [hash] - [message]
----------------------------------------
✅ Staging: [deployed/skipped]
✅ Beta: [deployed/skipped]
========================================
```

## Error Handling

If any step fails:
1. Report which step failed
2. Do NOT proceed to next environment
3. Provide recovery instructions

## Notes

- Commits only THIS chat session's changes
- Deploys to Staging AND Beta
- Frontend auto-deploys via Vercel on GitHub push
- Use `/ba` if you want to commit ALL pending changes
- Use `/s` if you only want to deploy to Staging
