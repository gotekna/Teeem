# Deploy This Chat's Changes

**Shortcut:** `/d` (single chat deploy)

Commits ONLY files worked on in THIS chat session, then deploys directly to Heroku. Use `/fd` to commit everything.

## 🔴 STAGING ONLY - NEVER DEPLOY TO LIVE

**This command deploys to STAGING (rob branch) ONLY.**

- ✅ Staging Frontend: https://teeemrob.vercel.app/
- ✅ Staging Backend: https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/
- ❌ NEVER push to main/Live branch
- ❌ NEVER deploy to https://teeem.vercel.app/ (production)

**To deploy to production:** Create a PR from rob → main (Live branch).

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

### Step 4 - Push to GitHub (rob branch)
```bash
git pull origin rob --rebase
git push origin rob
```

### Step 5 - Deploy Backend Directly to Heroku

**Use git subtree to deploy backend folder directly to Heroku:**
```bash
# Create temp branch with just backend contents
git subtree split --prefix backend -b temp-backend-deploy

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
- ✅ Committed: [list of files]
- ✅ NOT committed: [remaining uncommitted files]
- ✅ Backend deployed to Heroku: [version]
- ✅ Backend URL: https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/
- ✅ Frontend: https://teeemrob.vercel.app/ (auto-deploys via Vercel on push)
- ✅ Local version synced to: [version]

## Quick Reference

| Command | What it does |
|---------|-------------|
| `/d` | Commit THIS chat's files only + deploy to Heroku |
| `/fd` | Commit ALL changes + deploy to Heroku |
