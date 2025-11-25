# Reboot Local Servers and Deploy

**Execute these steps immediately without asking for permission.**

All commands below are pre-approved and should run automatically.

## CRITICAL: Use Parallel Execution

**Step 1: Kill Existing Servers**
Run BOTH in a SINGLE message (parallel):
```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

**Step 2: Start BOTH Servers Simultaneously**
Run BOTH in a SINGLE message (parallel):
```bash
# Backend (use subshell to isolate directory change)
(cd backend && nohup /Users/robertharder/.rbenv/shims/bundle exec rails server -p 3000 > /tmp/rails-server.log 2>&1 &)

# Frontend (use subshell to isolate directory change)
(cd frontend && nohup npm run dev > /tmp/vite-server.log 2>&1 &)
```

**Step 3: Git Operations (Sequential - Required)**
```bash
git add -A && git commit -m "chore: Auto-commit from /r" || echo "No changes to commit"
```

Then separately:
```bash
git push origin rob
```

If rejected, handle conflict:
```bash
git pull origin rob --rebase
# Resolve conflicts (accept HEAD for package.json version)
git add . && git rebase --continue && git push origin rob
```

**Step 4: Deploy to Heroku (Sequential - Required)**
```bash
git subtree push --prefix backend heroku main
```

**Step 5: Verify Everything**
Run ALL THREE in a SINGLE message (parallel):
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

## Performance Optimization

**Target Time: ~10-15 seconds** (down from ~25-30 seconds)

Breakdown:
- Step 1 (kill servers): ~1s (parallel)
- Step 2 (start servers): ~2s (parallel, background mode)
- Step 3 (git commit + push): ~2-3s (sequential, required)
- Step 4 (Heroku deploy): ~5-10s (sequential, required - slowest step)
- Step 5 (verify): ~3s (parallel)

**Key Speed Improvements:**
1. ✅ Kill both ports in single message (parallel)
2. ✅ Start both servers in single message (parallel)
3. ✅ Use nohup + background mode (don't wait for server startup)
4. ✅ Verify all 3 checks in single message (parallel)
5. ⏱️ Heroku deployment is unavoidable bottleneck (~5-10s)

## Notes
- All bash commands are pre-approved
- Uses relative paths (cd backend, cd frontend) which are pre-approved
- Working directory must be /Users/robertharder/GitHub/trapid
- Use rbenv shims path for Rails to avoid bundler conflicts
- nohup keeps servers running after command completes
- Conflicts in package.json version are normal (always take HEAD)
- **MUST run independent operations in parallel** (single message, multiple tool calls)
