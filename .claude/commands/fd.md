# Full Deploy (All Changes)

**Shortcut:** `/fd` (full deploy)

Commits ALL pending changes and deploys directly to Heroku staging via git subtree push.

**Run from teeem root. Auto-generate commit messages.**

## 🔴 STAGING ONLY - NEVER DEPLOY TO LIVE

**This command deploys to STAGING (rob branch) ONLY.**

- ✅ Staging Frontend: https://teeemrob.vercel.app/
- ✅ Staging Backend: https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/
- ❌ NEVER push to main/Live branch
- ❌ NEVER deploy to https://teeem.vercel.app/ (production)

**To deploy to production:** Create a PR from rob → main (Live branch).

## Parallel Execution Strategy

### Step 1 - Pre-Flight Checks (RUN IN PARALLEL)
```bash
git branch --show-current
git status --short
cd backend && bin/rails db:migrate:status
```

### Step 2 - Verify No Main Merge (ONLY check if recent merge from main)

**ONLY block if someone just merged main into rob:**
```bash
# Check if last commit is a merge from main
git log -1 --merges --oneline | grep -i "merge.*main"
```

If this returns a result, STOP and warn:
```
❌ BLOCKED: Rob branch has a merge commit from main!
This violates the branch strategy. Rob should stay independent.
Proper flow: rob → main (via PR), NEVER main → rob
```

**Otherwise, proceed with deployment** (ignore if main and rob have different commits - that's normal)

### Step 3 - Auto-Generate Commit Message and Commit

**Analyze git status and auto-generate message:**

Rules (in priority order):
1. Only `package.json` version → `chore: Bump version to X.X.X`
2. `.claude/commands/*` → `chore: Update slash commands`
3. `db/migrate/*` → `feat: Add migration`
4. Backend `.rb` → `feat: Update backend`
5. Frontend `.tsx/.jsx` → `feat: Update frontend`
6. Multiple types → Combine appropriately
7. Default → `chore: Update project files`

**Auto-commit ALL changes:**
```bash
git add -A
git commit -m "[auto-generated message]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 4 - Push to GitHub (rob branch)
```bash
git pull origin rob --rebase
git push origin rob
```

### Step 5 - Deploy Backend Directly to Heroku

**IMPORTANT: All git subtree commands MUST run from repo root `/Users/robertharder/GitHub/teeem`**

**Use git subtree to deploy backend folder directly to Heroku:**
```bash
# MUST run from repo root - subtree requires toplevel working tree
cd /Users/robertharder/GitHub/teeem && git subtree split --prefix backend -b temp-backend-deploy

# Force push to Heroku (heroku-rob-dev remote)
git push heroku-rob-dev temp-backend-deploy:main --force

# Clean up temp branch
git branch -D temp-backend-deploy
```

**Note:** The `heroku-rob-dev` remote should be configured as:
```bash
git remote add heroku-rob-dev https://git.heroku.com/teeem-rob-dev.git
```

### Step 6 - Verify Deploy & Sync Version
```bash
# Verify backend is up (wait a moment for dyno restart)
sleep 5
curl -s https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/version

# Sync local version to match staging
cd backend && bin/rails runner "Version.current.update(current_version: $(curl -s https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/version | grep -o '\"version\":\"v[0-9]*\"' | grep -o '[0-9]*'))"
```

**Note:** Version only increments if backend code changed. Frontend-only deploys won't change the version number.

### Step 7 - Report Status
- ✅ Branch: rob
- ✅ Commit: [hash + message]
- ✅ Backend deployed to Heroku: [version from /version endpoint]
- ✅ Backend URL: https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/
- ✅ Frontend: https://teeemrob.vercel.app/ (auto-deploys via Vercel on push)
- ✅ Local version synced to: [version]
- 🔴 Warnings (if any)

## Branch Strategy

```
Feature → rob (staging) → main (production)
          ↓                   ↑
       Direct Heroku      Create PR
       subtree push
```

**Critical Rule:** Rob and main are independent. NEVER merge main → rob.
