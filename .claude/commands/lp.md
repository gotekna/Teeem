# Deploy ALL Changes to Production

**Shortcut:** `/lp` (Live Push - Everything)

Commits ALL pending changes from ALL chat sessions and deploys to production.

**Use `/l` to commit and deploy only THIS chat's changes instead.**

## PRODUCTION DEPLOY

This deploys directly to **PRODUCTION**:
- Backend: https://teeemlive-ce8e2660a615.herokuapp.com/
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

### Step 4 - Detect What Changed

Check which parts of the codebase have changes:
```bash
# Check for backend changes (staged + unstaged)
git diff --name-only HEAD | grep -q "^backend/" && echo "BACKEND_CHANGED=true" || echo "BACKEND_CHANGED=false"

# Check for frontend changes
git diff --name-only HEAD | grep -q "^frontend-next/" && echo "FRONTEND_CHANGED=true" || echo "FRONTEND_CHANGED=false"
```

### Step 5 - Auto-Generate Commit Message and Commit

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

### Step 6 - Push to GitHub (Live branch)
```bash
git push origin Live
```

### Step 7 - Deploy Backend (ONLY if backend changed)

**Skip this step if no backend files changed.**

If backend changed, deploy to Heroku:
```bash
cd /Users/robertharder/GitHub/teeem && git subtree split --prefix backend --rejoin -b backend-heroku && git push heroku-teeemlive backend-heroku:main --force
```

Note: First deploy is slow (~60s), subsequent deploys are fast (~10-15s)

### Step 8 - Verify Deploy
```bash
sleep 10
curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version
heroku releases --app teeemlive -n 1
```

### Step 9 - Report Status

**Show Brisbane time:**
```
========================================
DEPLOYED: HH:MM DD/MM (Brisbane)
Commit: [hash] - [message]
Backend: v[XXX] or "No changes"
Frontend: Auto-deploy via Vercel (skips if no changes)
Heroku: v[XXX]
Files: [count] files changed
========================================
```

## Smart Deploy Logic

| Backend Changed | Frontend Changed | Action |
|-----------------|------------------|--------|
| Yes | Yes | Deploy backend to Heroku, Vercel auto-deploys frontend |
| Yes | No | Deploy backend to Heroku, Vercel auto-skips |
| No | Yes | Skip Heroku, Vercel auto-deploys frontend |
| No | No | Nothing to deploy |

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
