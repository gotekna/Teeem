# Commit and Deploy to Staging

Complete deployment workflow: commit changes, deploy to rob branch, update Heroku in correct order.

**Run from trapid root. Use 'cd backend &&' for Rails commands. Auto-generate commit messages.**

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

**Auto-commit:**
```bash
git add .
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
curl -s https://trapid-backend-447058022b51.herokuapp.com/ | head -5
heroku pg:info
heroku logs --tail --num 50 | grep -i "migrat\|error\|fail" | head -20
```

### Step 7 - Report Status
- ✅ Branch: rob
- ✅ Commit: [hash + message]
- ✅ Backend: [dyno status]
- ✅ Frontend: Auto-deploys via GitHub
- ✅ Migrations: [status]
- ✅ Health check: [response]
- 🔴 Warnings (if any)

### Step 8 - Maintenance (IF WARNINGS)

**Use AskUserQuestion if warnings detected:**

Options:
- "Yes - Update Ruby and dependencies"
- "No - Skip for now"

**If Yes:**
```bash
rbenv install 3.3.10 && rbenv global 3.3.10
cd backend && bundle update && bundle audit --update
git add backend/Gemfile.lock
git commit -m "chore: Update dependencies

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin rob

# Redeploy
export GIT_HTTP_USER_AGENT="git/2.51.2"
/opt/homebrew/bin/git subtree split --prefix=backend -b backend-deploy-rob
/opt/homebrew/bin/git push heroku backend-deploy-rob:main --force
git branch -D backend-deploy-rob
```

## Branch Strategy

```
Feature → rob (staging) → main (production)
          ↓                   ↑
       Deploy              Create PR
```

**Critical Rule:** Rob and main are independent. NEVER merge main → rob.

## Implementation Notes

**Pre-Approved Patterns:**
- ✅ `cd backend && bin/rails [cmd]`
- ✅ `cd frontend && npm run dev`
- ✅ `git add .` / `git commit` / `git push`
- ✅ `heroku ps` / `heroku pg:info`

**Key Rules:**
1. Run from trapid root
2. Auto-generate commit message (never ask)
3. Only block if actual merge from main detected
4. Ignore if main has different commits (that's normal)
5. Use parallel execution where possible

**Performance:** ~35-45 seconds (or ~2-3 min with maintenance)
