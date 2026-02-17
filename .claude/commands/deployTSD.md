# Deploy to teeem-sam-dev (Fast Method)

Deploy the backend to teeem-sam-dev Heroku app using the fast method.

**Target:** teeem-sam-dev Heroku app
**Time:** ~2-3 minutes

## Deploy Script

```bash
cd /Users/robertharder/GitHub/teeem
sync && sleep 1

DEPLOY_DIR=$(mktemp -d)
rsync -a --exclude='.git' --exclude-from=backend/.slugignore backend/ "$DEPLOY_DIR/"

# ⚠️ NEVER use 'cd "$DEPLOY_DIR"' - it breaks VS Code's working directory tracking
# Use 'git -C' to run git commands in temp dir without changing cwd
git -C "$DEPLOY_DIR" init
git -C "$DEPLOY_DIR" add .
git -C "$DEPLOY_DIR" commit -m "Deploy to sam-dev $(date +%Y%m%d-%H%M%S)"
git -C "$DEPLOY_DIR" remote add heroku https://git.heroku.com/teeem-sam-dev.git
git -C "$DEPLOY_DIR" push heroku HEAD:main --force

rm -rf "$DEPLOY_DIR"
```

## Report

Show deployment summary with time (Brisbane timezone).
