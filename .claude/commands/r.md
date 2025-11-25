# Reboot Local Development Environment

Restart local servers on ports 3000 (backend) and 5173 (frontend), then verify Heroku and Postgres are running.

**Execute these steps immediately without asking:**

## Parallel Execution Strategy

**Step 1 - Kill processes (run in parallel):**
```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```
Both can run simultaneously - independent operations.

**Step 2 - Start servers (run in parallel with run_in_background: true):**
```bash
# Backend
cd backend && /Users/robertharder/.rbenv/shims/bundle exec rails server

# Frontend  
cd frontend && npm run dev
```
Start both at the same time in background mode.

**Step 3 - Check services (run in parallel after 5 second wait):**
```bash
# Wait for servers to initialize
sleep 5

# Check Heroku dyno status (use heroku without full path)
heroku ps

# Check Postgres status
heroku pg:info

# Verify local Postgres
psql --version
```
All three checks are independent - run simultaneously.

**Step 4 - Monitor server startup (run in parallel):**
Use BashOutput tool to check both server logs:
- Backend: Look for "Listening on" or "Ctrl-C to shutdown"
- Frontend: Look for "Local: http://localhost:5173"

**Step 5 - Report status:**
- ✅ Frontend: http://localhost:5173 [startup status]
- ✅ Backend: http://localhost:3000 [startup status]
- ✅ Heroku: [dyno status]
- ✅ Postgres: [local + remote status]

## Performance Notes

**Sequential (OLD way):** ~15-20 seconds
- Kill port 3000 (1s) → Kill port 5173 (1s) → Start backend (3s) → Start frontend (3s) → Wait (5s) → Check Heroku (2s) → Check Postgres (2s)

**Parallel (NEW way):** ~8-10 seconds  
- Kill both ports simultaneously (1s) → Start both servers simultaneously (3s) → Check all services simultaneously (2s)

**Implementation for Claude:**
- Use single message with multiple Bash tool calls for parallel execution
- Mark servers with `run_in_background: true`
- Don't wait between independent operations
- Only sequential dependency: kill → start → check
- Use `heroku` command without full path (it's in PATH and pre-approved)
