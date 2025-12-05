# Deploy Live Branch to Production

**Shortcut:** `/l` (Live to Production)

Commits ALL pending changes and deploys the `Live` branch backend to production Heroku (`teeemlive`) using git subtree.

**Run from teeem root. Auto-generate commit messages.**

## PRODUCTION DEPLOY

This deploys directly to **PRODUCTION**:
- Backend: https://teeem-backend-39604ccca45a.herokuapp.com/
- Frontend: https://teeemlive.vercel.app/

## Instructions

### Step 1 - Confirm on Live Branch
```bash
git checkout Live
git pull origin Live
```

### Step 2 - Auto-Generate Commit Message and Commit

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

### Step 3 - Push to GitHub (Live branch)
```bash
git push origin Live
```

### Step 4 - Deploy Backend to Production via Git Subtree

**IMPORTANT: All git subtree commands MUST run from repo root `/Users/robertharder/GitHub/teeem`**

```bash
cd /Users/robertharder/GitHub/teeem && git subtree split --prefix backend -b temp-live-deploy
git push heroku-teeemlive temp-live-deploy:main --force
git branch -D temp-live-deploy
```

### Step 5 - Verify Backend Deploy
```bash
sleep 10
curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version
heroku releases --app teeemlive -n 1
```

### Step 6 - Report Deploy Started

**Immediately after pushing, show deploy initiated status with Brisbane time:**
```
========================================
DEPLOY STARTED
Backend: v[XXX] (pushing to Heroku...)
Frontend: ⏳ building
Heroku: v[XXX]
Started: H:MM D/M (Brisbane time)
========================================
```

### Step 7 - Check Vercel Frontend Deploy

**Wait for Vercel to finish deploying the frontend:**

1. Check latest Vercel deployment status:
```bash
vercel inspect teeemlive.vercel.app
```

2. If status shows "Building" or "Queued", wait 15 seconds and check again:
```bash
sleep 15
vercel inspect teeemlive.vercel.app
```

3. Repeat until status shows "● Ready" (max 2 minutes total wait)

4. Report each check with timestamp:
```
=== Vercel Check [N] === HH:MM:SS
Status: [Building/Queued/Ready]
```

### Step 8 - Report Final Status

**Show TWO timestamps - when deploy started AND when it completed:**
```
========================================
Backend: v[XXX]
Frontend: v[XX] ✓ deployed
Heroku: v[XXX]
Started: H:MM D/M
Completed: H:MM D/M
========================================
```

Get values from:
- Backend version: from /version endpoint (use correct URL: teeemlive-ce8e2660a615.herokuapp.com)
- Frontend: Show "✓ deployed" when Vercel shows Ready, or "⏳ building" if still in progress
- Heroku release: from `heroku releases --app teeemlive -n 1`
- Started: Brisbane time when git push was initiated
- Completed: Brisbane time when Vercel shows Ready

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
