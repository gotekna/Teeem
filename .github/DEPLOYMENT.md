# Automated Deployment Setup

## GitHub Actions Auto-Deploy

This project uses GitHub Actions to automatically deploy to Heroku staging when you push to the `rob` branch.

### Setup Instructions

1. **Get your Heroku API Key:**
   ```bash
   heroku auth:token
   ```

2. **Add secrets to GitHub:**
   - Go to: https://github.com/abodable-dev/teeem/settings/secrets/actions
   - Click "New repository secret"
   - Add these secrets:
     - `HEROKU_API_KEY`: Your Heroku API token from step 1
     - `HEROKU_EMAIL`: Your Heroku account email

3. **That's it!** Now every time you push to the `rob` branch, it will automatically deploy to Heroku.

### Manual Deployment (if needed)

If you need to deploy manually:

```bash
# Login to Heroku first
heroku login

# Then deploy
export GIT_HTTP_USER_AGENT="git/2.51.2"
git push heroku rob:main
```

### Check Deployment Status

View the deployment in GitHub Actions:
https://github.com/abodable-dev/teeem/actions

View Heroku logs:
```bash
heroku logs --tail -a teeemlive
```

### How It Works

1. You commit and push to the `rob` branch
2. GitHub Actions automatically triggers
3. Code is deployed to Heroku staging
4. Migrations run automatically (via Procfile release command)
5. App restarts with new code

No manual intervention needed!
