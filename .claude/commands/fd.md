# Full Deploy (All Changes)

**Shortcut:** `/fd` (full deploy)

Commits ALL pending changes and deploys directly to Heroku via git subtree push.

**Run from teeem root. Auto-generate commit messages.**

## 🔄 BRANCH-AWARE DEPLOYMENT

**This command detects your current branch and deploys to the correct environment:**

| Current Branch | Deploys To | Backend URL | Frontend URL |
|----------------|------------|-------------|--------------|
| `rob` | Staging | https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/ | https://teeemrob.vercel.app/ |
| `Live` | Production | https://teeemlive-ce8e2660a615.herokuapp.com/ | https://teeemlive.vercel.app/ |

## Parallel Execution Strategy

### Step 1 - Pre-Flight Checks (RUN IN PARALLEL)
```bash
git branch --show-current
git status --short
cd backend && bin/rails db:migrate:status
```

### Step 2 - Determine Target Environment

**Based on current branch from Step 1:**

| Branch | Remote | Heroku App | Backend URL |
|--------|--------|------------|-------------|
| `rob` | `heroku-rob-dev` | teeem-rob-dev | https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/ |
| `Live` | `heroku-teeemlive` | teeemlive | https://teeemlive-ce8e2660a615.herokuapp.com/ |

**If on `rob` branch only:** Check for merge commits from main:
```bash
git log -1 --merges --oneline | grep -i "merge.*main"
```
If found, warn but proceed.

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

### Step 4 - Push to GitHub (current branch)
```bash
# Use the current branch name (rob or Live)
git pull origin [CURRENT_BRANCH] --rebase
git push origin [CURRENT_BRANCH]
```

### Step 5 - Deploy Backend Directly to Heroku

**IMPORTANT: All git subtree commands MUST run from repo root `/Users/robertharder/GitHub/teeem`**

**Use git subtree to deploy backend folder directly to Heroku:**
```bash
# MUST run from repo root - subtree requires toplevel working tree
cd /Users/robertharder/GitHub/teeem && git subtree split --prefix backend -b temp-backend-deploy

# Force push to appropriate Heroku remote based on branch:
# - rob branch → heroku-rob-dev
# - Live branch → heroku-teeemlive
git push [HEROKU_REMOTE] temp-backend-deploy:main --force

# Clean up temp branch
git branch -D temp-backend-deploy
```

**Heroku remotes must be configured:**
```bash
git remote add heroku-rob-dev https://git.heroku.com/teeem-rob-dev.git
git remote add heroku-teeemlive https://git.heroku.com/teeemlive.git
```

### Step 6 - Verify Deploy & Sync Version
```bash
# Verify backend is up (wait a moment for dyno restart)
sleep 5

# Use the appropriate URL based on branch:
# - rob → https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/version
# - Live → https://teeemlive-ce8e2660a615.herokuapp.com/version
curl -s [BACKEND_URL]/version

# Sync local version to match deployed version
cd backend && bin/rails runner "Version.current.update(current_version: $(curl -s [BACKEND_URL]/version | grep -o '\"version\":\"v[0-9]*\"' | grep -o '[0-9]*'))"
```

**Note:** Version only increments if backend code changed. Frontend-only deploys won't change the version number.

### Step 7 - Restart Local Rails Server (if running)
```bash
# Run migrations and restart local Rails server
cd /Users/robertharder/GitHub/teeem/backend
bin/rails db:migrate
rm -f tmp/pids/server.pid
bin/rails server -p 3001 -d

# Verify local server is running
sleep 2
curl -s http://localhost:3001/version
```

**Note:** This ensures local dev environment has latest migrations and code.

### Step 8 - Report Status

**For rob branch:**
- ✅ Branch: rob
- ✅ Commit: [hash + message]
- ✅ Backend deployed to: teeem-rob-dev (staging)
- ✅ Backend URL: https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/
- ✅ Frontend: https://teeemrob.vercel.app/
- ✅ Version: [version]

**For Live branch:**
- ✅ Branch: Live
- ✅ Commit: [hash + message]
- ✅ Backend deployed to: teeemlive (production)
- ✅ Backend URL: https://teeemlive-ce8e2660a615.herokuapp.com/
- ✅ Frontend: https://teeemlive.vercel.app/
- ✅ Version: [version]

## Environment Reference

| Branch | Heroku Remote | Heroku App | Backend URL | Frontend URL |
|--------|---------------|------------|-------------|--------------|
| `rob` | heroku-rob-dev | teeem-rob-dev | https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/ | https://teeemrob.vercel.app/ |
| `Live` | heroku-teeemlive | teeemlive | https://teeemlive-ce8e2660a615.herokuapp.com/ | https://teeemlive.vercel.app/ |
