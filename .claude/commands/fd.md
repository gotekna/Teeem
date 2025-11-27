# Full Deploy (All Changes)

**Shortcut:** `/fd` (full deploy)

Commits ALL pending changes and pushes to trigger GitHub Actions deployment to staging.

**Run from teeem root. Auto-generate commit messages.**

## 🔴 STAGING ONLY - NEVER DEPLOY TO LIVE

**This command deploys to STAGING (rob branch) ONLY.**

- ✅ Staging Frontend: https://teeemrob.vercel.app/
- ✅ Staging Backend: https://teeem-backend-39604ccca45a.herokuapp.com/
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

### Step 2 - Check Root/Backend Sync (CRITICAL)

**Heroku deploys from ROOT, not backend/. Check for drift:**
```bash
# Check if shared folders are in sync
diff -rq app/models/ backend/app/models/ 2>/dev/null | grep -v "Only in" | head -10
diff -rq app/controllers/ backend/app/controllers/ 2>/dev/null | grep -v "Only in" | head -10
diff -rq app/services/ backend/app/services/ 2>/dev/null | grep -v "Only in" | head -10
```

If ANY files differ, **STOP and warn:**
```
⚠️ WARNING: Root and backend folders are OUT OF SYNC!
Files that differ:
[list differing files]

Heroku deploys from ROOT (app/), not backend/app/.
If you edited backend/ but not root/, your changes WON'T deploy!

Fix: Copy changes from backend/ to root/ (or vice versa) before deploying.
```

**Ask user:** "Should I sync these files before deploying? (copy backend → root)"

### Step 3 - Verify No Main Merge (ONLY check if recent merge from main)

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

### Step 4 - Auto-Generate Commit Message and Commit

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

### Step 5 - Push to Rob (GitHub Actions handles deployment)
```bash
git pull origin rob --rebase
git push origin rob
```

### Step 6 - Monitor GitHub Actions Deployment
```bash
# Wait for workflows to start
sleep 5
gh run list --limit 3
```

### Step 7 - Wait and Verify Deployment (RUN IN PARALLEL after ~60s)
```bash
# Check GitHub Actions status
gh run list --limit 2

# Verify backend is up
curl -s https://teeem-backend-39604ccca45a.herokuapp.com/version

# Check frontend
curl -s -o /dev/null -w "%{http_code}" https://teeem.vercel.app/
```

### Step 8 - Sync Local Version with Staging

**After successful deploy, sync local version number to match staging:**
```bash
# Get staging version number
STAGING_VERSION=$(curl -s https://teeem-backend-39604ccca45a.herokuapp.com/version | grep -o '"version":"v[0-9]*"' | grep -o '[0-9]*')

# Update local database to match
cd backend && bin/rails runner "Version.current.update(current_version: ${STAGING_VERSION})"
```

This keeps local and staging version numbers in sync.

### Step 9 - Report Status
- ✅ Branch: rob
- ✅ Commit: [hash + message]
- ✅ GitHub Actions: [status - in_progress/success/failure]
- ✅ Backend: [version from /version endpoint] - https://teeem-backend-39604ccca45a.herokuapp.com/
- ✅ Frontend: https://teeemrob.vercel.app/ (auto-deploys via Vercel)
- ✅ Local version synced to: [version]
- 🔴 Warnings (if any)

## Branch Strategy

```
Feature → rob (staging) → main (production)
          ↓                   ↑
       Push triggers       Create PR
       GitHub Actions
```

**Critical Rule:** Rob and main are independent. NEVER merge main → rob.
