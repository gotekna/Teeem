# Deploy ALL Changes to Production

**Shortcut:** `/lp` (Live Push - Everything)

Commits ALL pending changes from ALL chat sessions and deploys to production.

**Use `/l` to commit and deploy only THIS chat's changes instead.**

## PRODUCTION DEPLOY

This deploys directly to **PRODUCTION**:
- Backend: https://teeem-backend-39604ccca45a.herokuapp.com/
- Frontend: https://teeemlive.vercel.app/

## Instructions

### Step 1 - Pre-Flight Checks
```bash
git branch --show-current
git status --short
```

### Step 2 - Ensure on Live Branch
```bash
git checkout Live
git pull origin Live
```

### Step 3 - Pop Any Stashed Changes

**Include any stashed work from other chats:**
```bash
git stash list
# If there are stashes from other chats, pop them:
git stash pop
```

### Step 4 - Auto-Generate Commit Message and Commit

**Analyze ALL changes and auto-generate message:**

Rules (in priority order):
1. Only `package.json` version → `chore: Bump version to X.X.X`
2. `.claude/commands/*` → `chore: Update slash commands`
3. `db/migrate/*` → `feat: Add migration`
4. Backend `.rb` → `feat: Update backend`
5. Frontend `.tsx/.jsx` → `feat: Update frontend`
6. Multiple types → Combine appropriately
7. Default → `chore: Update project files`

**Auto-commit ALL changes (including untracked):**
```bash
git add -A
git commit -m "[auto-generated message]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 5 - Push to GitHub (Live branch)
```bash
git push origin Live
```

### Step 6 - Deploy Backend to Production via Git Subtree

**IMPORTANT: All git subtree commands MUST run from repo root `/Users/robertharder/GitHub/teeem`**

```bash
cd /Users/robertharder/GitHub/teeem && git subtree split --prefix backend -b temp-live-deploy
git push heroku-teeemlive temp-live-deploy:main --force
git branch -D temp-live-deploy
```

### Step 7 - Verify Deploy
```bash
sleep 10
curl -s https://teeem-backend-39604ccca45a.herokuapp.com/version
heroku releases --app teeemlive -n 1
```

### Step 8 - Report Status

**Show Brisbane time:**
```
========================================
DEPLOYED: HH:MM DD/MM (Brisbane)
Commit: [hash] - [message]
Backend: v[XXX]
Frontend: Pushed to Vercel (auto-deploy)
Heroku: v[XXX]
Files: [count] files changed
========================================
```

## Error Handling

If any step fails:
1. Report which step failed
2. Stay on Live branch
3. Provide recovery instructions

## Heroku Remote Setup

The `heroku-teeemlive` remote must be configured:
```bash
git remote add heroku-teeemlive https://git.heroku.com/teeemlive.git
```

Verify with: `git remote -v | grep teeemlive`
