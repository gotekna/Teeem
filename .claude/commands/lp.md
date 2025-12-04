# Live Push - Deploy to Production

**Shortcut:** `/lp` (Live Push)

Commits ALL pending changes and deploys to production. Same as `/l`.

**Run from teeem root. Auto-generate commit messages.**

## PRODUCTION DEPLOY

This command deploys directly to PRODUCTION:
- Backend: https://teeem-backend-39604ccca45a.herokuapp.com/
- Frontend: https://teeemlive.vercel.app/

## Complete Workflow

### Step 1 - Pre-Flight Checks (RUN IN PARALLEL)
```bash
git branch --show-current
git status --short
cd backend && bin/rails db:migrate:status
```

### Step 2 - Ensure on Live Branch
```bash
git checkout Live
git pull origin Live
```

### Step 3 - Auto-Generate Commit Message and Commit

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

### Step 4 - Push to GitHub (Live branch)
```bash
git push origin Live
```

### Step 5 - Deploy Backend to Production via Git Subtree

**IMPORTANT: All git subtree commands MUST run from repo root `/Users/robertharder/GitHub/teeem`**

```bash
cd /Users/robertharder/GitHub/teeem && git subtree split --prefix backend -b temp-live-deploy
git push heroku-teeemlive temp-live-deploy:main --force
git branch -D temp-live-deploy
```

### Step 6 - Verify Production Deploy
```bash
sleep 10
curl -s https://teeem-backend-39604ccca45a.herokuapp.com/version
```

### Step 7 - Report Status

**Production (Live):**
- ✅ Branch: Live
- ✅ Commit: [hash + message]
- ✅ Backend deployed to: teeemlive (production)
- ✅ Version: [version from /version endpoint]
- ✅ Production Backend: https://teeem-backend-39604ccca45a.herokuapp.com/
- ✅ Production Frontend: https://teeemlive.vercel.app/

## Error Handling

If any step fails:
1. Report which step failed
2. Stay on Live branch
3. Provide recovery instructions

## Heroku Remote Required

```bash
git remote add heroku-teeemlive https://git.heroku.com/teeemlive.git
```

Verify with: `git remote -v | grep heroku`
