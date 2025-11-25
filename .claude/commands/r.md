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

### Step 2: Start Backend (port 3000)
```bash
cd backend && bin/rails s -p 3000 &
```

### Step 3: Start Frontend (port 5173)
```bash
cd frontend && npm run dev &
```

### Step 4: Git Push to rob
```bash
git add -A
git commit -m "chore: Auto-commit from /r"
git push origin rob
```

### Step 5: Deploy to Heroku
```bash
git subtree push --prefix backend heroku main
```

### Step 6: Verify
```bash
heroku ps -a trapid-backend
lsof -i:5173 | head -2
lsof -i:3000 | head -2
curl -s https://trapid-backend-447058022b51.herokuapp.com/ | head -c 100
```
