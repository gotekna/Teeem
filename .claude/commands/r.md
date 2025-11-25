# Reboot Local Servers and Deploy

**Shortcut:** `/r`

## What This Command Does

1. Kill existing servers on ports 5173 and 3000
2. Restart local servers in background
3. Commit and push to `rob` branch
4. Deploy backend to Heroku
5. Verify everything is running

## Execution Steps

### Step 1: Kill Existing Servers
```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

### Step 2: Navigate to Repo Root
```bash
cd /Users/robertharder/Documents/Documents\ -\ Robert\'s\ MacBook\ Pro/GitHub/trapid
```

### Step 3: Start Backend (port 3000)
```bash
cd backend && nohup /Users/robertharder/.rbenv/shims/bundle exec rails server -p 3000 > /tmp/rails-server.log 2>&1 & echo "Backend started (PID: $!)"
```

### Step 4: Start Frontend (port 5173)
```bash
cd frontend && nohup npm run dev > /tmp/vite-server.log 2>&1 & echo "Frontend started (PID: $!)"
```

### Step 5: Git Push to rob
```bash
git add -A
git commit -m "chore: Auto-commit from /r" || echo "No changes to commit"
git push origin rob
```

### Step 6: Deploy to Heroku
```bash
cd /Users/robertharder/Documents/Documents\ -\ Robert\'s\ MacBook\ Pro/GitHub/trapid && git subtree push --prefix backend heroku main
```

### Step 7: Verify
```bash
sleep 3
lsof -i:3000 | head -2
lsof -i:5173 | head -2
curl -s https://trapid-backend-447058022b51.herokuapp.com/ | head -c 100
```

## Notes

- Backend server uses rbenv Ruby to avoid bundler version conflicts
- Logs are written to `/tmp/rails-server.log` and `/tmp/vite-server.log`
- Git commit will not fail if there are no changes
- All commands navigate to absolute paths to avoid directory issues
