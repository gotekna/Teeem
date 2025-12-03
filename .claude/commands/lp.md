# Live Push - Full Deploy to Staging then Production

**Shortcut:** `/lp` (Live Push)

Commits ALL pending changes, deploys to staging (rob), merges into Live, deploys to production, and stays on Live branch.

**Run from teeem root. Auto-generate commit messages.**

## 🔴 PRODUCTION DEPLOY - THIS WILL DEPLOY TO LIVE

This command:
1. Deploys all changes to STAGING first (like `/fd`)
2. Merges rob → Live
3. Deploys Live to PRODUCTION
4. Stays on Live branch (for continued Live work)

## Complete Workflow

### Phase 1: Full Deploy to Staging (Same as /fd)

#### Step 1.1 - Pre-Flight Checks (RUN IN PARALLEL)
```bash
git branch --show-current
git status --short
cd backend && bin/rails db:migrate:status
```

#### Step 1.2 - Verify No Main Merge

**ONLY block if someone just merged main into rob:**
```bash
git log -1 --merges --oneline | grep -i "merge.*main"
```

If this returns a result, STOP and warn:
```
❌ BLOCKED: Rob branch has a merge commit from main!
```

#### Step 1.3 - Auto-Generate Commit Message and Commit

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

#### Step 1.4 - Push to GitHub (rob branch)
```bash
git pull origin rob --rebase
git push origin rob
```

#### Step 1.5 - Deploy Backend to Staging Heroku

**IMPORTANT: All git subtree commands MUST run from repo root `/Users/robertharder/GitHub/teeem`**

```bash
cd /Users/robertharder/GitHub/teeem && git subtree split --prefix backend -b temp-backend-deploy
git push heroku-rob-dev temp-backend-deploy:main --force
git branch -D temp-backend-deploy
```

#### Step 1.6 - Verify Staging Deploy
```bash
sleep 5
curl -s https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/version
```

### Phase 2: Merge Rob into Live

#### Step 2.1 - Switch to Live and Pull Latest
```bash
git checkout Live
git pull origin Live
```

#### Step 2.2 - Merge Rob Changes into Live
```bash
git merge rob -m "Merge rob into Live for production deploy

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Step 2.3 - Push Live to GitHub
```bash
git push origin Live
```

### Phase 3: Deploy Live to Production (Same as /l)

#### Step 3.1 - Deploy Backend to Production via Git Subtree

**IMPORTANT: All git subtree commands MUST run from repo root `/Users/robertharder/GitHub/teeem`**

```bash
cd /Users/robertharder/GitHub/teeem && git subtree split --prefix backend -b temp-live-deploy
git push heroku-teeemlive temp-live-deploy:main --force
git branch -D temp-live-deploy
```

#### Step 3.2 - Verify Production Deploy
```bash
sleep 10
curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version
```

### Step 4 - Report Status

Report combined status:

**Staging (rob):**
- ✅ Commit: [hash + message]
- ✅ Backend deployed to: teeem-rob-dev
- ✅ Staging Backend: https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/
- ✅ Staging Frontend: https://teeemrob.vercel.app/

**Production (Live):**
- ✅ Branch: Live (merged from rob)
- ✅ Backend deployed to: teeemlive
- ✅ Version: [version from /version endpoint]
- ✅ Production Backend: https://teeemlive-ce8e2660a615.herokuapp.com/
- ✅ Production Frontend: https://teeemlive.vercel.app/

**Current Branch:**
- ✅ Staying on: Live (for continued development)

## Error Handling

If any step fails:
1. Report which phase/step failed
2. Stay on current branch
3. Provide recovery instructions

## Heroku Remotes Required

```bash
git remote add heroku-rob-dev https://git.heroku.com/teeem-rob-dev.git
git remote add heroku-teeemlive https://git.heroku.com/teeemlive.git
```

Verify with: `git remote -v | grep heroku`
