# Reboot Local Servers

**Execute these steps immediately without asking for permission.**

Simple, fast server restart - no git operations.

## Execution Steps

**Step 1: Kill Existing Servers (Parallel)**
Run both kill commands in a SINGLE message:
```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

**Step 2: Start Both Servers (Parallel)**
Run both start commands in a SINGLE message:
```bash
(cd backend && nohup /Users/robertharder/.rbenv/shims/bundle exec rails server -p 3000 > /tmp/rails-server.log 2>&1 &)
(cd frontend && nohup npm run dev > /tmp/vite-server.log 2>&1 &)
```

**Step 3: Verify Servers Started (Parallel)**
Run all checks in a SINGLE message:
```bash
sleep 3
lsof -i:3000 | head -2
lsof -i:5173 | head -2
```

## Final Report Format
```
Local Servers:
- Backend (port 3000): Running (PID: X)
- Frontend (port 5173): Running (PID: Y)

Logs:
- Backend: /tmp/rails-server.log
- Frontend: /tmp/vite-server.log
```

## Performance

**Target Time: ~5-8 seconds** 🚀

Breakdown:
- Step 1 (kill servers): ~1s (parallel)
- Step 2 (start servers): ~2s (parallel, background mode)
- Step 3 (verify): ~3s (parallel)

**Speed Optimizations:**
1. ✅ Kill both ports in parallel (~1s)
2. ✅ Start both servers in parallel (~2s)
3. ✅ Use nohup + background mode (don't wait for server startup)
4. ✅ Verify both servers in parallel (~3s)
5. ✅ No git/deploy overhead

## Notes
- All bash commands are pre-approved (defaultMode: "dontAsk")
- Uses subshells `(cd dir && ...)` to isolate directory changes
- Working directory: /Users/robertharder/GitHub/trapid
- Use rbenv shims path for Rails to avoid bundler conflicts
- nohup keeps servers running after command completes
- **MUST run independent operations in parallel** (single message, multiple tool calls)
