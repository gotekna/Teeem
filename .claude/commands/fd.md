# Full Deploy (All Changes)

**Shortcut:** `/fd` (full deploy)

Commits ALL pending changes and deploys to staging. Use this when you want to deploy everything.

**Run from teeem root. Use 'cd backend &&' for Rails commands. Auto-generate commit messages.**

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

### Step 4 - Push to Rob
```bash
git pull origin rob --rebase
git push origin rob
```

### Step 5 - Deploy Backend to Heroku
```bash
export GIT_HTTP_USER_AGENT="git/2.51.2"
/opt/homebrew/bin/git subtree split --prefix=backend -b backend-deploy-rob
/opt/homebrew/bin/git push heroku backend-deploy-rob:main --force
git branch -D backend-deploy-rob
```

### Step 6 - Verify Deployment (RUN IN PARALLEL)
```bash
heroku ps
curl -s https://teeem-backend-447058022b51.herokuapp.com/ | head -5
curl -s -o /dev/null -w "%{http_code}" https://teeemtest.vercel.app/
curl -s https://teeem-backend-447058022b51.herokuapp.com/version
cat frontend/package.json | grep '"version"' | head -1
heroku pg:info
heroku logs --tail --num 50 | grep -i "migrat\|error\|fail" | head -20
```

### Step 7 - Report Status
- ✅ Branch: rob
- ✅ Commit: [hash + message]
- ✅ Backend: [version from /version endpoint] - https://teeem-backend-447058022b51.herokuapp.com/
  - Dyno status: [web/worker status]
- ✅ Frontend: [version from package.json] - https://teeemtest.vercel.app/
  - Status: [HTTP status code]
- ✅ Migrations: [status]
- ✅ Database: [connection info]
- 🔴 Warnings (if any)

## Branch Strategy

```
Feature → rob (staging) → main (production)
          ↓                   ↑
       Deploy              Create PR
```

**Critical Rule:** Rob and main are independent. NEVER merge main → rob.
