# Deploy This Chat's Changes

**Shortcut:** `/d` (single chat deploy)

Commits ONLY files worked on in THIS chat session, then pushes to trigger GitHub Actions deployment. Use `/fd` to commit everything.

## 🔴 STAGING ONLY - NEVER DEPLOY TO LIVE

**This command deploys to STAGING (rob branch) ONLY.**

- ✅ Staging Frontend: https://teeemrob.vercel.app/
- ✅ Staging Backend: https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/
- ❌ NEVER push to main/Live branch
- ❌ NEVER deploy to https://teeem.vercel.app/ (production)

**To deploy to production:** Create a PR from rob → main (Live branch).

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

### Step 2 - Check Root/Backend Sync (CRITICAL)

**Heroku deploys from ROOT, not backend/. Check for drift:**
```bash
# Check if shared folders are in sync
diff -rq app/models/ backend/app/models/ 2>/dev/null | grep -v "Only in" | head -10
diff -rq app/controllers/ backend/app/controllers/ 2>/dev/null | grep -v "Only in" | head -10
diff -rq app/services/ backend/app/services/ 2>/dev/null | grep -v "Only in" | head -10
```

If ANY files differ, **STOP and warn:**
```
⚠️ WARNING: Root and backend folders are OUT OF SYNC!
Files that differ:
[list differing files]

Heroku deploys from ROOT (app/), not backend/app/.
If you edited backend/ but not root/, your changes WON'T deploy!

Fix: Copy changes from backend/ to root/ (or vice versa) before deploying.
```

**Ask user:** "Should I sync these files before deploying? (copy backend → root)"

### Step 3 - Ask User Which Files

**Use AskUserQuestion:**
- Show the list of changed files from git status
- Ask: "Which files from this chat should I commit?"
- Options:
  - List the specific files that were modified
  - "All of these" (if user confirms all shown are from this chat)
  - "Let me specify" (user types file paths)

### Step 4 - Stage Only Specified Files
```bash
git add [user-specified-files]
git commit -m "[auto-generated message based on files]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 5 - Push (GitHub Actions handles deployment)
```bash
git pull origin rob --rebase
git push origin rob
```

### Step 6 - Monitor Deployment & Trigger if Needed
```bash
# Wait for GitHub Actions to start
sleep 5
gh run list --limit 3 --branch rob
```

**If workflow didn't auto-trigger** (check if latest run matches your commit):
```bash
# Manually trigger the deploy workflow
gh workflow run "Deploy Backend Staging (Rob's Branch) to Heroku" --ref rob

# Wait and verify it started
sleep 5
gh run list --limit 3 --branch rob
```

### Step 7 - Wait for Deploy & Sync Local Version

**Wait for workflow to complete (~60s), then sync local version:**
```bash
# Wait for deploy to finish
sleep 60

# Check staging version
curl -s https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/version

# Sync local to match staging
cd backend && bin/rails runner "Version.current.update(current_version: $(curl -s https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/version | grep -o '\"version\":\"v[0-9]*\"' | grep -o '[0-9]*'))"
```

**Note:** Version only increments if backend code changed. Frontend-only deploys won't change the version number.

### Step 8 - Report Status
- ✅ Branch: rob
- ✅ Committed: [list of files]
- ✅ NOT committed: [remaining uncommitted files]
- ✅ GitHub Actions triggered - backend will auto-deploy to Heroku
- ✅ Frontend auto-deploying via Vercel
- ✅ Local version synced to: [version]

## Quick Reference

| Command | What it does |
|---------|-------------|
| `/d` | Commit THIS chat's files only + push (triggers deploy) |
| `/fd` | Commit ALL changes + push (triggers deploy) |
| `/deploy no-commit` | Deploy without committing |
