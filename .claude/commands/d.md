# Quick Deploy to Rob Branch

**Shortcut:** `/d`

## What This Command Does

1. Commit all changes to git
2. Push to `rob` branch
3. Deploy backend to Heroku

**Note:** This command does NOT restart local servers. Use `/r` for full reboot + deploy.

## Execution Steps

### Step 1: Navigate to Repo Root
```bash
cd /Users/robertharder/Documents/Documents\ -\ Robert\'s\ MacBook\ Pro/GitHub/trapid
```

### Step 2: Git Commit and Push
```bash
git add -A
git commit -m "chore: Quick deploy from /d" || echo "No changes to commit"
git push origin rob
```

### Step 3: Deploy to Heroku
```bash
git subtree push --prefix backend heroku main
```

### Step 4: Verify Deployment
```bash
sleep 2
curl -s https://trapid-backend-447058022b51.herokuapp.com/ | head -c 100
echo ""
echo "✅ Deployment complete!"
```

## When to Use

- **Use `/d`**: When you want to commit + deploy without restarting local servers
- **Use `/r`**: When you want to restart local servers AND deploy

## Notes

- Git commit will not fail if there are no changes
- Uses absolute path to avoid directory issues
- All commands have pre-approved permissions (no prompts)
