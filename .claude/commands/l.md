# Deploy THIS Chat's Changes to Production

**Shortcut:** `/l` (Live - This Chat Only)

Commits only THIS chat session's changes and deploys to production.

**Use `/lp` to commit ALL pending changes from ALL sessions instead.**

## PRODUCTION DEPLOY

- Backend: Heroku (`teeemlive`) - manual deploy via subtree
- Frontend: Vercel - auto-deploys from GitHub push

## Instructions

### Step 1 - Pre-Flight Checks
```bash
git branch --show-current
git status --short
```

### Step 2 - Commit This Chat's Changes

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

### Step 3 - Push to GitHub
```bash
git push origin Live
```
*Vercel auto-deploys frontend from this push*

### Step 4 - Deploy Backend (ONLY if backend changed)

**Check if backend files were in the commit:**
```bash
git diff --name-only HEAD~1 HEAD | grep -q "^backend/" && echo "BACKEND: Deploy needed" || echo "BACKEND: No changes, skip Heroku"
```

**If backend changed**, deploy to Heroku:
```bash
cd /Users/robertharder/GitHub/teeem && git subtree split --prefix backend --rejoin -b backend-heroku && git push heroku-teeemlive backend-heroku:main --force
```

**If no backend changes, skip this step entirely.**

### Step 5 - Report Status

**Show Brisbane time:**
```
========================================
DEPLOYED: HH:MM DD/MM (Brisbane)
Commit: [hash] - [message]
Backend: v[XXX] or "No changes - skipped"
Frontend: Auto-deployed via Vercel
Heroku: v[XXX] or "Skipped"
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
