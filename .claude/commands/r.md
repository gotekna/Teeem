# Reboot Local Servers and Deploy

**Execute these steps immediately without asking for permission.**

All commands below are pre-approved and should run automatically.

## Step 1: Kill Existing Servers (Parallel)
```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

## Step 2: Start Backend Server (Background)
```bash
cd /Users/robertharder/GitHub/trapid/backend && nohup /Users/robertharder/.rbenv/shims/bundle exec rails server -p 3000 > /tmp/rails-server.log 2>&1 & echo "Backend started (PID: $!)"
```

## Step 3: Start Frontend Server (Background)
```bash
cd /Users/robertharder/GitHub/trapid/frontend && nohup npm run dev > /tmp/vite-server.log 2>&1 & echo "Frontend started (PID: $!)"
```

## Step 4: Git Commit and Push to rob Branch
```bash
cd /Users/robertharder/GitHub/trapid && git add -A && git commit -m "chore: Auto-commit from /r" || echo "No changes to commit"
git push origin rob
```

If there's a merge conflict or rejected push:
- Pull with rebase: `git pull origin rob --rebase`
- Resolve any conflicts (typically package.json version)
- Accept HEAD version for version numbers
- Continue: `git add . && git rebase --continue && git push origin rob`

## Step 5: Deploy Backend to Heroku
```bash
cd /Users/robertharder/GitHub/trapid && git subtree push --prefix backend heroku main
```

## Step 6: Verify Everything (Parallel)
```bash
sleep 3
lsof -i:3000 | head -2
lsof -i:5173 | head -2
curl -s https://trapid-backend-447058022b51.herokuapp.com/ | head -c 100
```

## Final Report Format
```
Local Servers:
- Backend (port 3000): Running (PID: X)
- Frontend (port 5173): Running (PID: Y)

Git:
- Pushed to rob branch: ✅

Heroku Deployment:
- Backend deployed: ✅
- Verified: ✅

Logs:
- Backend: /tmp/rails-server.log
- Frontend: /tmp/vite-server.log
```

## Notes
- All bash commands are pre-approved
- Use absolute paths to avoid directory issues
- Use rbenv shims path for Rails to avoid bundler conflicts
- nohup keeps servers running after command completes
- Conflicts in package.json version are normal (always take HEAD)
