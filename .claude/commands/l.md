# Deploy THIS Chat's Changes to Production

**Shortcut:** `/l` (Live - This Chat Only)

Commits only THIS chat session's changes and deploys to production.

**Use `/lp` to commit ALL pending changes from ALL sessions instead.**

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

### Step 2 - Detect What Changed

Check which parts of the codebase have changes:
```bash
# Check for backend changes
git diff --name-only HEAD | grep -q "^backend/" && echo "BACKEND_CHANGED=true" || echo "BACKEND_CHANGED=false"

# Check for frontend changes
git diff --name-only HEAD | grep -q "^frontend-next/" && echo "FRONTEND_CHANGED=true" || echo "FRONTEND_CHANGED=false"
```

### Step 3 - Commit This Chat's Changes

**Auto-generate commit message based on changes:**

Rules (in priority order):
1. Only `package.json` version → `chore: Bump version to X.X.X`
2. `.claude/commands/*` → `chore: Update slash commands`
3. `db/migrate/*` → `feat: Add migration`
4. Backend `.rb` → `feat: Update backend`
5. Frontend `.tsx/.jsx` → `feat: Update frontend`
6. Multiple types → Combine appropriately
7. Default → `chore: Update project files`

```bash
git add -A
git commit -m "[auto-generated message]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 4 - Push to GitHub (Live branch)
```bash
git push origin Live
```

### Step 5 - Deploy Backend (ONLY if backend changed)

**Skip this step if no backend files changed.**

If backend changed, deploy to Heroku:
```bash
cd /Users/robertharder/GitHub/teeem && git subtree split --prefix backend --rejoin -b backend-heroku && git push heroku-teeemlive backend-heroku:main --force
```

Note: First deploy is slow (~60s), subsequent deploys are fast (~10-15s)

### Step 6 - Verify Deploy
```bash
sleep 10
curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version
heroku releases --app teeemlive -n 1
```

### Step 7 - Report Status

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
