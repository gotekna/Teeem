# Deploy This Chat's Changes to Production

**Shortcut:** `/lc` (Live - this Chat only)

Commits ONLY the changes made in THIS chat session and deploys to production. Stashes any other pending changes from other chats.

**Use `/lp` to commit and deploy ALL pending changes instead.**

## PRODUCTION DEPLOY

This deploys directly to **PRODUCTION**:
- Backend: https://teeemlive-ce8e2660a615.herokuapp.com/
- Frontend: https://teeemlive.vercel.app/

## Instructions

### Step 1 - Confirm on Live Branch
```bash
git checkout Live
git pull origin Live
```

### Step 2 - Identify This Chat's Changes

**CRITICAL: Before committing, identify which files were modified by THIS chat session.**

1. Check git status for all pending changes
2. Review your conversation history to identify which files YOU modified
3. Stash any files that were NOT modified by this chat:
```bash
git stash push -m "Other chats WIP" -- [files not from this chat]
```

### Step 3 - Auto-Generate Commit Message and Commit

**Analyze the remaining changes (this chat only) and auto-generate message:**

Rules (in priority order):
1. Only `package.json` version → `chore: Bump version to X.X.X`
2. `.claude/commands/*` → `chore: Update slash commands`
3. `db/migrate/*` → `feat: Add migration`
4. Backend `.rb` → `feat: Update backend`
5. Frontend `.tsx/.jsx` → `feat: Update frontend`
6. Multiple types → Combine appropriately
7. Default → `chore: Update project files`

**Commit ONLY this chat's changes:**
```bash
git add [specific files from this chat]
git commit -m "[auto-generated message]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 4 - Push to GitHub (Live branch)
```bash
git push origin Live
```

### Step 5 - Deploy Backend (if backend files changed)

**Skip if only frontend files changed.**

**Deploy to Heroku using FAST method (no subtree - avoids segfault crashes):**
```bash
# ULTRA-FAST DEPLOY - direct push from temp directory (~5 seconds total)
# Avoids slow/crashy git subtree split entirely
cd /Users/robertharder/GitHub/teeem

# CRITICAL: Ensure all file writes are flushed to disk before copying
sync
sleep 1

DEPLOY_DIR=$(mktemp -d)
cp -r backend/* "$DEPLOY_DIR/"

# VERIFICATION: Check that latest changes are in copied directory
if git diff --name-only HEAD~1 HEAD | grep "^backend/" > /dev/null; then
  echo "✅ Verifying copied files match git commit..."
  git diff --name-only HEAD~1 HEAD | grep "^backend/" | while read file; do
    if [ -f "$file" ] && [ -f "$DEPLOY_DIR/${file#backend/}" ]; then
      if ! diff -q "$file" "$DEPLOY_DIR/${file#backend/}" > /dev/null 2>&1; then
        echo "⚠️  Warning: $file differs between git and deploy directory"
      fi
    fi
  done
fi

cd "$DEPLOY_DIR"
git init
git add .
git commit -m "Deploy $(date +%Y%m%d-%H%M%S)"
git remote add heroku https://git.heroku.com/teeemlive.git
git push heroku HEAD:main --force
cd /Users/robertharder/GitHub/teeem
rm -rf "$DEPLOY_DIR"
```

### Step 6 - Verify Deploy
```bash
sleep 10
curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version
heroku releases --app teeemlive -n 1
```

### Step 7 - Report Status

**Show Brisbane time and note what was deployed:**
```
========================================
DEPLOYED: HH:MM DD/MM (Brisbane)
Commit: [hash] - [message]
Backend: v[XXX] (if deployed) or "no changes"
Frontend: Pushed to Vercel (auto-deploy)
Heroku: v[XXX]
========================================

Note: Other chats' changes stashed (not deployed)
```

## Stashed Changes

If changes were stashed, remind user:
- `git stash list` to see stashed changes
- `git stash pop` to restore most recent stash
- Other chats can use `/lp` to deploy their changes

## Error Handling

If any step fails:
1. Report which step failed
2. Stay on Live branch
3. Restore stashed changes if needed: `git stash pop`
4. Provide recovery instructions

## Notes

- No pre-configured Heroku remote needed - the deploy script creates it on-the-fly
- Frontend deploys automatically via Vercel on GitHub push
- Backend only deploys if changes detected in `backend/` directory
