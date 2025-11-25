# Commit and Deploy to Staging

Complete deployment workflow: commit changes, deploy to rob branch, update Heroku in correct order.

**Execute these steps immediately without asking:**

## 0. CRITICAL SAFEGUARDS

**NEVER merge main into rob branch!**
- Rob is staging (ahead of main with experimental features)
- Main is production (stable, tested code)
- Flow: rob → main (via PR), NEVER main → rob

```bash
# Check if we're about to merge main into rob (BLOCK THIS)
if git branch --show-current | grep -q "rob"; then
  if git log HEAD..main --oneline | grep -q .; then
    echo "❌ BLOCKED: Main has commits not in rob. Do NOT merge main into rob!"
    echo "Proper flow: Create PR from rob → main instead"
    exit 1
  fi
fi
```

## 1. Pre-Flight Checks

```bash
# Check current branch
git branch --show-current

# Verify we're on rob branch
if ! git branch --show-current | grep -q "rob"; then
  echo "⚠️  Not on rob branch. Switch to rob? (yes/no)"
  # Wait for user confirmation
fi

# Check for uncommitted changes
git status --short

# Check for pending migrations
cd backend && bin/rails db:migrate:status
```

## 2. Commit Changes

If uncommitted changes exist:
- Ask user for commit message (one-line summary)
- Create commit using conventional format:
  ```bash
  git add .
  git commit -m "$(cat <<'COMMIT_EOF'
  [user's message]
  
  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  
  Co-Authored-By: Claude <noreply@anthropic.com>
  COMMIT_EOF
  )"
  ```

## 3. Push to Rob Branch

```bash
# DON'T pull from main - rob should stay independent
git pull origin rob --rebase

# Push changes
git push origin rob
```

## 4. Deploy Backend to Heroku

**CRITICAL ORDER - Use exact commands:**

```bash
export GIT_HTTP_USER_AGENT="git/2.51.2"
/opt/homebrew/bin/git subtree split --prefix=backend -b backend-deploy-rob
/opt/homebrew/bin/git push heroku backend-deploy-rob:main --force
git branch -D backend-deploy-rob
```

## 5. Verify Deployment

### Backend (Heroku)
```bash
# Check Heroku status
heroku ps

# Check for migration errors in logs (last 50 lines)
heroku logs --tail --num 50 | grep -i "migrat\|error\|fail"

# Test health check endpoint
curl -s https://trapid-backend-447058022b51.herokuapp.com/ | head -5
```

### Frontend (Vercel)
```bash
# Check Vercel authentication
vercel whoami

# List recent deployments (shows status of rob branch)
vercel ls

# Wait 30 seconds for Vercel to trigger, then check again
sleep 30 && vercel ls
```

## 6. Report Status

Provide comprehensive summary:
- ✅ Branch: rob (confirmed not merged with main)
- ✅ Commit: [commit hash + message]
- ✅ Backend deployed to Heroku: [dyno status]
- ✅ Frontend deploying via Vercel: [deployment status]
- ✅ Migrations: [status from logs]
- ✅ Health check: [API response]
- 🔴 Any errors or warnings

## Branch Strategy (IMPORTANT)

```
Feature Branch → rob (staging) → main (production)
                  ↓                    ↑
              Deploy to              Create PR
              Heroku Staging         when ready
```

**DO:**
- ✅ Develop on feature branches
- ✅ Merge features into rob for testing
- ✅ Create PR from rob → main when stable
- ✅ Keep rob ahead of main

**DON'T:**
- ❌ Merge main into rob
- ❌ Deploy main directly to staging
- ❌ Skip testing on rob before main

## Notes

- Frontend deploys automatically via Vercel when rob branch is pushed
- Vercel deployment takes ~30-60 seconds after git push
- Migrations run automatically on Heroku during deployment
- If migrations fail, check logs and rollback if needed
- Use `heroku releases:rollback` if critical issues occur
