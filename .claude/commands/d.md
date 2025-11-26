# Deploy This Chat's Changes

**Shortcut:** `/d` (single chat deploy)

Commits ONLY files worked on in THIS chat session, then deploys. Use `/fd` to commit everything.

## How It Works

1. **ASK which files to commit** - Show `git status` and ask user to specify files
2. Stage only those files
3. Deploy to staging

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

### Step 4 - Push and Deploy
```bash
git pull origin rob --rebase
git push origin rob
export GIT_HTTP_USER_AGENT="git/2.51.2"
/opt/homebrew/bin/git subtree split --prefix=backend -b backend-deploy-rob
/opt/homebrew/bin/git push heroku backend-deploy-rob:main --force
git branch -D backend-deploy-rob
```

### Step 5 - Verify Deployment
```bash
heroku ps
curl -s https://teeem-backend-39604ccca45a.herokuapp.com/version
curl -s -o /dev/null -w "%{http_code}" https://trapidtest.vercel.app/
```

### Step 6 - Report Status
- ✅ Branch: rob
- ✅ Committed: [list of files]
- ✅ NOT committed: [remaining uncommitted files]
- ✅ Backend deployed
- ✅ Frontend auto-deploying via Vercel

## Quick Reference

| Command | What it does |
|---------|-------------|
| `/d` | Commit THIS chat's files only + deploy |
| `/fd` | Commit ALL changes + deploy |
| `/deploy no-commit` | Deploy without committing |
