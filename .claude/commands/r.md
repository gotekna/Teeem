# Reboot Local Servers

**Execute these steps immediately without asking for permission.**

Simple, fast server restart - no git operations.

## Execution Steps

**Step 1: Kill Existing Servers & Screen Sessions (Parallel)**
Run all kill commands in a SINGLE message:
```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
screen -X -S backend quit 2>/dev/null || true
screen -X -S frontend quit 2>/dev/null || true
```

**Step 2: Start Both Servers in Screen (Parallel)**
Run both start commands in a SINGLE message:
```bash
screen -dmS backend bash -c 'cd /Users/robertharder/GitHub/trapid/backend && /Users/robertharder/.rbenv/shims/bundle exec rails server -p 3000'
screen -dmS frontend bash -c 'cd /Users/robertharder/GitHub/trapid/frontend && npm run dev'
```

**Step 3: Verify Servers Started (Parallel)**
Run all checks in a SINGLE message:
```bash
sleep 3
lsof -i:3000 | head -2
lsof -i:5173 | head -2
screen -ls || true
```

## Final Report Format
```
Local Servers:
- Backend (port 3000): Running (PID: X) - screen session: backend
- Frontend (port 5173): Running (PID: Y) - screen session: frontend

View logs:
- Backend: screen -r backend
- Frontend: screen -r frontend
- List sessions: screen -ls
- Detach from screen: Ctrl+A then D
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
3. ✅ Use detached screen sessions (don't wait for server startup)
4. ✅ Verify both servers in parallel (~3s)
5. ✅ No git/deploy overhead

## Notes
- All bash commands are pre-approved (defaultMode: "dontAsk")
- Servers run in detached screen sessions for easy log viewing
- Working directory: /Users/robertharder/GitHub/trapid
- Use rbenv shims path for Rails to avoid bundler conflicts
- Screen sessions persist after terminal closes
- **MUST run independent operations in parallel** (single message, multiple tool calls)
- To view logs: `screen -r backend` or `screen -r frontend`
- To kill sessions: `screen -X -S backend quit` or `screen -X -S frontend quit`
