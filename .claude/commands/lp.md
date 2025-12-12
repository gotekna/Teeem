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
DEPLOY_DIR=$(mktemp -d)
cp -r backend/* "$DEPLOY_DIR/"
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

## Error Handling

If any step fails:
1. Report which step failed
2. Stay on Live branch
3. Provide recovery instructions

## Notes

- No pre-configured Heroku remote needed - the deploy script creates it on-the-fly
- Frontend deploys automatically via Vercel on GitHub push
- Backend only deploys if changes detected in `backend/` directory
