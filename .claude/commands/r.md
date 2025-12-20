# Reboot Local Servers

**Execute these steps immediately without asking for permission.**

Simple, fast server restart - no git operations.

## Execution Steps

**Step 1: Check System Health & Database**
Run health checks in parallel:
```bash
# Check PostgreSQL status
brew services list | grep postgresql@17

# Check Heroku production status
/opt/homebrew/bin/heroku ps --app teeemlive 2>&1 | head -5

# Check for pending migrations locally
cd /Users/robertharder/GitHub/teeem/backend && bin/rails db:migrate:status 2>&1 | grep "^\s*down" | wc -l
```

If PostgreSQL shows "error" or "stopped", restart it:
```bash
brew services restart postgresql@17
sleep 2
psql -d teeem_development -c "SELECT 1"
```

**Step 2: Kill Existing Servers & Screen Sessions (Parallel)**
Run all kill commands in a SINGLE message:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
screen -X -S backend quit 2>/dev/null || true
screen -X -S frontend quit 2>/dev/null || true
screen -X -S frontend-next quit 2>/dev/null || true
```

**Step 3: Start Servers and Chrome with Debugging (Parallel)**
Run all start commands in a SINGLE message:
```bash
screen -dmS backend bash -c 'cd /Users/robertharder/GitHub/teeem/backend && /Users/robertharder/.rbenv/shims/bundle exec rails server -p 3001'
screen -dmS frontend-next bash -c 'cd /Users/robertharder/GitHub/teeem/frontend-next && npm run dev'
# Only launch Chrome DevTools instance if not already running (persistent profile, won't affect main Chrome)
lsof -i:9222 >/dev/null 2>&1 || /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-debug" http://localhost:3000 &
```

**Step 4: Verify Servers Started (Parallel)**
Run all checks in a SINGLE message:
```bash
sleep 3
lsof -i:3001 | head -2
lsof -i:3000 | head -2
lsof -i:9222 | head -2
screen -ls || true
```

## Final Report Format
```
System Health:
- PostgreSQL: Running ✓ (teeem_development connected)
- Pending Migrations: 0 (all up to date)
- Heroku (teeemlive): web.1 up | worker.1 up

Local Servers:
- Backend (port 3001): Running (PID: X) - screen session: backend
- Frontend Next.js (port 3000): Running (PID: Y) - screen session: frontend-next
- Chrome DevTools (port 9222): Running ✓ - Claude can read console (tabs preserved)

URLs:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Chrome DevTools: http://localhost:9222
- Production: https://teeemlive.vercel.app

View logs:
- Backend: screen -r backend
- Frontend: screen -r frontend-next
- List sessions: screen -ls
- Detach from screen: Ctrl+A then D

⚠️ If pending migrations > 0: Run `cd backend && bin/rails db:migrate`
⚠️ If Heroku web/worker down: Check `/opt/homebrew/bin/heroku logs --app teeemlive --tail`
```

## Performance

**Target Time: ~8-12 seconds**

Breakdown:
- Step 1 (check/restart PostgreSQL): ~3s
- Step 2 (kill servers): ~1s (parallel)
- Step 3 (start servers): ~2s (parallel, background mode)
- Step 4 (verify): ~3s (parallel)

**Speed Optimizations:**
1. Kill all ports in parallel (~1s)
2. Start both servers in parallel (~2s)
3. Use detached screen sessions (don't wait for server startup)
4. Verify both servers in parallel (~3s)
5. No git/deploy overhead

## Notes
- All bash commands are pre-approved (defaultMode: "dontAsk")
- Servers run in detached screen sessions for easy log viewing
- Working directory: /Users/robertharder/GitHub/teeem
- Use rbenv shims path for Rails to avoid bundler conflicts
- Screen sessions persist after terminal closes
- **MUST run independent operations in parallel** (single message, multiple tool calls)
- To view logs: `screen -r backend` or `screen -r frontend-next`
- To kill sessions: `screen -X -S backend quit` or `screen -X -S frontend-next quit`

## Port Configuration
| Service | Port | Screen Session |
|---------|------|----------------|
| Backend (Rails) | 3001 | backend |
| Frontend (Next.js) | 3000 | frontend-next |
| Chrome DevTools | 9222 | - (standalone) |
| Old Frontend (Vite) | 5173 | frontend (legacy) |
