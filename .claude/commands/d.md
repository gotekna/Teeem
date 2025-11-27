# Deploy This Chat's Changes

**Shortcut:** `/d` (single chat deploy)

Commits ONLY files worked on in THIS chat session, then pushes to trigger GitHub Actions deployment. Use `/fd` to commit everything.

## How It Works

1. **ASK which files to commit** - Show `git status` and ask user to specify files
2. Stage only those files
3. Push to trigger GitHub Actions (auto-deploys backend to Heroku)

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

### Step 4 - Push (GitHub Actions handles deployment)
```bash
git pull origin rob --rebase
git push origin rob
```

### Step 5 - Monitor Deployment
```bash
# Wait for GitHub Actions to start
sleep 5
gh run list --limit 3
```

### Step 6 - Report Status
- ✅ Branch: rob
- ✅ Committed: [list of files]
- ✅ NOT committed: [remaining uncommitted files]
- ✅ GitHub Actions triggered - backend will auto-deploy to Heroku
- ✅ Frontend auto-deploying via Vercel

## Quick Reference

| Command | What it does |
|---------|-------------|
| `/d` | Commit THIS chat's files only + push (triggers deploy) |
| `/fd` | Commit ALL changes + push (triggers deploy) |
| `/deploy no-commit` | Deploy without committing |
