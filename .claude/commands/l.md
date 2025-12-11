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

### Step 2 - Commit This Chat's Changes

**Auto-generate commit message based on changes:**

Rules (in priority order):
1. Only `package.json` version -> `chore: Bump version to X.X.X`
2. `.claude/commands/*` -> `chore: Update slash commands`
3. `db/migrate/*` -> `feat: Add migration`
4. Backend `.rb` -> `feat: Update backend`
5. Frontend `.tsx/.jsx` -> `feat: Update frontend`
6. Multiple types -> Combine appropriately
7. Default -> `chore: Update project files`

```bash
git add -A
git commit -m "[auto-generated message]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 3 - Push to GitHub (Live branch)
```bash
git push origin Live
```

### Step 4 - Deploy Backend to Production via Git Subtree (FAST)

**IMPORTANT: Uses --rejoin for faster subsequent deploys**

```bash
cd /Users/robertharder/GitHub/teeem && git subtree split --prefix backend --rejoin -b backend-heroku && git push heroku-teeemlive backend-heroku:main --force
```

Note: First deploy is slow (~60s), subsequent deploys are fast (~10-15s)

### Step 5 - Verify Deploy
```bash
sleep 10
curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version
heroku releases --app teeemlive -n 1
```

### Step 6 - Report Status

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
