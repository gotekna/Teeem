# Deploy to Sam's Dev Environment

**Shortcut:** `/s` (Sam deploy)

Deploys to `teeem-sam-dev` with a visual progress bar.

## Environment Details

| Item | Value |
|------|-------|
| Heroku App | `teeem-sam-dev` |
| Heroku Remote | `heroku-sam-dev` |
| Backend URL | https://teeem-sam-dev-7f131d00a67d.herokuapp.com/ |
| Frontend URL | https://teeem-sam-dev.vercel.app/ |

## Instructions

### Step 1 - Show Progress Header
```
╔════════════════════════════════════════════════════════════╗
║           DEPLOYING TO TEEEM-SAM-DEV                       ║
╚════════════════════════════════════════════════════════════╝
```

### Step 2 - Git Status (with progress)
```
[░░░░░░░░░░] 0% - Checking git status...
```

Run:
```bash
git branch --show-current
git status --short
```

Then show:
```
[██░░░░░░░░] 10% - Git status complete
```

### Step 3 - Ask User Which Files to Commit

**Use AskUserQuestion:**
- Show the list of changed files
- Ask: "Which files should I commit for this deploy?"
- Options: specific files, "all", or "none" (deploy existing commits only)

### Step 4 - Commit Changes (if any)
```
[████░░░░░░] 20% - Staging files...
[█████░░░░░] 30% - Creating commit...
```

```bash
git add [user-specified-files]
git commit -m "[auto-generated message]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 5 - Push to GitHub
```
[██████░░░░] 40% - Pushing to GitHub...
```

```bash
git pull origin SamTestMerge --rebase
git push origin SamTestMerge
```

```
[███████░░░] 50% - GitHub push complete
```

### Step 6 - Deploy Backend to Heroku
```
[████████░░] 60% - Creating backend subtree...
```

**IMPORTANT: Run from repo root**
```bash
cd /Users/samharder/Documents/GitHub/TeknaTrapid && git subtree split --prefix backend -b temp-backend-deploy
```

```
[█████████░] 70% - Pushing to Heroku (teeem-sam-dev)...
```

```bash
git push heroku-sam-dev temp-backend-deploy:main --force
```

```
[██████████] 80% - Cleaning up temp branch...
```

```bash
git branch -D temp-backend-deploy
```

### Step 7 - Verify Deployment
```
[██████████] 90% - Verifying deployment...
```

```bash
sleep 10
curl -s https://teeem-sam-dev-7f131d00a67d.herokuapp.com/version
```

### Step 8 - Complete!
```
[██████████] 100% - DEPLOY COMPLETE!

╔════════════════════════════════════════════════════════════╗
║                    ✅ DEPLOY SUCCESSFUL                    ║
╠════════════════════════════════════════════════════════════╣
║  Branch:    SamTestMerge                                   ║
║  Heroku:    teeem-sam-dev                                  ║
║  Backend:   https://teeem-sam-dev-7f131d00a67d.herokuapp.com/
║  Frontend:  https://teeem-sam-dev.vercel.app/              ║
║  Version:   [version from curl]                            ║
║  Time:      [Brisbane Time - e.g., 2025-12-08 3:45 PM AEST]║
╚════════════════════════════════════════════════════════════╝
```

## Progress Bar Reference

| Stage | Progress | Description |
|-------|----------|-------------|
| Start | 0% | Checking git status |
| Status | 10% | Git status complete |
| Stage | 20% | Staging files |
| Commit | 30% | Creating commit |
| Push | 40% | Pushing to GitHub |
| GitHub | 50% | GitHub push complete |
| Subtree | 60% | Creating backend subtree |
| Heroku | 70% | Pushing to Heroku |
| Cleanup | 80% | Cleaning up temp branch |
| Verify | 90% | Verifying deployment |
| Done | 100% | Deploy complete |

## Error Handling

If any step fails, show:
```
[██████░░░░] XX% - ❌ FAILED at: [step name]

Error: [error message]

Troubleshooting:
- Check Heroku logs: heroku logs --tail --app teeem-sam-dev
- Verify remote: git remote -v | grep sam
- Check Heroku status: heroku ps --app teeem-sam-dev
```

## Quick Commands Reference

```bash
# Check Sam's dev logs
heroku logs --tail --app teeem-sam-dev

# Restart Sam's dev
heroku ps:restart --app teeem-sam-dev

# Open Sam's dev console
heroku run rails console --app teeem-sam-dev

# Check Sam's dev status
heroku ps --app teeem-sam-dev
```
