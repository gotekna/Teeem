# Deploy This Chat's Changes

**Shortcut:** `/d` (single chat deploy)

Commits ONLY files worked on in THIS chat session, then deploys directly to Heroku. Use `/fd` to commit everything.

## 🔄 BRANCH-AWARE DEPLOYMENT

**This command detects your current branch and deploys to the correct environment:**

| Current Branch | Deploys To | Backend URL | Frontend URL |
|----------------|------------|-------------|--------------|
| `rob` | Staging | https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/ | https://teeemrob.vercel.app/ |
| `Live` | Production | https://teeemlive-ce8e2660a615.herokuapp.com/ | https://teeemlive.vercel.app/ |

## How It Works

1. **ASK which files to commit** - Show `git status` and ask user to specify files
2. Stage only those files
3. Push to GitHub and deploy directly to Heroku via git subtree

## Instructions

### Step 1 - Show Current Changes
```bash
git branch --show-current
git status --short
```

### Step 2 - Ask User Which Files

**Use AskUserQuestion:**
- Show the list of changed files from git status
- Ask: "Which files from this chat should I commit?"
- Options:
  - List the specific files that were modified
  - "All of these" (if user confirms all shown are from this chat)
  - "Let me specify" (user types file paths)

### Step 3 - Stage Only Specified Files
```bash
git add [user-specified-files]
git commit -m "[auto-generated message based on files]

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

### Step 7 - Report Status

**For rob branch:**
- ✅ Branch: rob
- ✅ Committed: [list of files]
- ✅ NOT committed: [remaining uncommitted files]
- ✅ Backend deployed to: teeem-rob-dev (staging)
- ✅ Backend URL: https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/
- ✅ Frontend: https://teeemrob.vercel.app/
- ✅ Version: [version]

**For Live branch:**
- ✅ Branch: Live
- ✅ Committed: [list of files]
- ✅ NOT committed: [remaining uncommitted files]
- ✅ Backend deployed to: teeemlive (production)
- ✅ Backend URL: https://teeemlive-ce8e2660a615.herokuapp.com/
- ✅ Frontend: https://teeemlive.vercel.app/
- ✅ Version: [version]

## Quick Reference

| Command | What it does |
|---------|-------------|
| `/d` | Commit THIS chat's files only + deploy to current branch's Heroku |
| `/fd` | Commit ALL changes + deploy to current branch's Heroku |

## Environment Reference

| Branch | Heroku Remote | Heroku App | Backend URL | Frontend URL |
|--------|---------------|------------|-------------|--------------|
| `rob` | heroku-rob-dev | teeem-rob-dev | https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/ | https://teeemrob.vercel.app/ |
| `Live` | heroku-teeemlive | teeemlive | https://teeemlive-ce8e2660a615.herokuapp.com/ | https://teeemlive.vercel.app/ |
