# 🚀 Deployment Setup Instructions

This document explains how to configure automatic deployments to staging environments.

## Overview

The GitHub Actions workflow (`.github/workflows/deploy-staging.yml`) automatically deploys both frontend and backend when you push to the `rob` branch.

**Deployment Flow:**
1. Push code to `rob` branch
2. GitHub Actions triggers automatically
3. Backend deploys to Heroku (`trapid-backend`)
4. Database migrations run automatically
5. Frontend deploys to Vercel (`trapid-staging`)

---

## Required GitHub Secrets

You need to configure these secrets in your GitHub repository settings.

### How to Add Secrets to GitHub

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret below

---

## Secret 1: HEROKU_API_KEY

**What it is:** Your Heroku API key for authentication

**How to get it:**
1. Go to https://dashboard.heroku.com/account
2. Scroll down to **API Key** section
3. Click **Reveal** to see your API key
4. Copy the key

**GitHub Secret:**
- **Name:** `HEROKU_API_KEY`
- **Value:** Your Heroku API key (looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

---

## Secret 2: VERCEL_TOKEN

**What it is:** Your Vercel authentication token

**How to get it:**
1. Go to https://vercel.com/account/tokens
2. Click **Create Token**
3. Give it a name (e.g., "GitHub Actions Deploy")
4. Set scope to **Full Account**
5. Click **Create Token**
6. Copy the token immediately (you won't see it again)

**GitHub Secret:**
- **Name:** `VERCEL_TOKEN`
- **Value:** Your Vercel token (looks like: `aBcDeFgHiJkLmNoPqRsTuVwXyZ123456`)

---

## Secret 3: VERCEL_ORG_ID

**What it is:** Your Vercel organization/team ID

**How to get it:**
1. Go to your Vercel project: https://vercel.com/dashboard
2. Click on your **trapid-staging** project
3. Go to **Settings** → **General**
4. Scroll down to **Project ID** section
5. You'll see both **Project ID** and **Organization ID**
6. Copy the **Organization ID** (also called Team ID)

**Alternative method:**
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Navigate to your frontend directory
cd frontend

# Link to your project (if not already linked)
vercel link

# View the project settings (includes org ID)
cat .vercel/project.json
```

The `.vercel/project.json` file contains:
```json
{
  "orgId": "team_xxxxxxxxxxxxx",
  "projectId": "prj_xxxxxxxxxxxxx"
}
```

**GitHub Secret:**
- **Name:** `VERCEL_ORG_ID`
- **Value:** Your org ID (looks like: `team_xxxxxxxxxxxxx`)

---

## Secret 4: VERCEL_PROJECT_ID

**What it is:** Your Vercel project ID for trapid-staging

**How to get it:**
1. Same location as above (Vercel project settings)
2. Copy the **Project ID**

**Or from CLI:**
```bash
cat frontend/.vercel/project.json
```

**GitHub Secret:**
- **Name:** `VERCEL_PROJECT_ID`
- **Value:** Your project ID (looks like: `prj_xxxxxxxxxxxxx`)

---

## Verification Checklist

After adding all secrets, verify:

- [ ] `HEROKU_API_KEY` added to GitHub secrets
- [ ] `VERCEL_TOKEN` added to GitHub secrets
- [ ] `VERCEL_ORG_ID` added to GitHub secrets
- [ ] `VERCEL_PROJECT_ID` added to GitHub secrets
- [ ] All secrets show green checkmark in GitHub settings
- [ ] Workflow file committed (`.github/workflows/deploy-staging.yml`)

---

## Testing the Auto-Deploy

Once all secrets are configured:

1. Make a small change to any file
2. Commit and push to `rob` branch:
   ```bash
   git add .
   git commit -m "test: Verify auto-deploy workflow"
   git push origin rob
   ```
3. Go to GitHub → **Actions** tab
4. Watch the workflow run in real-time
5. Verify deployments:
   - Backend: https://trapid-backend-447058022b51.herokuapp.com/
   - Frontend: https://trapid-staging.vercel.app/

---

## Troubleshooting

### Workflow Not Triggering
- Check that you pushed to the `rob` branch (not `main`)
- Verify workflow file exists at `.github/workflows/deploy-staging.yml`
- Check GitHub Actions tab for any error messages

### Heroku Deployment Failing
- Verify `HEROKU_API_KEY` is correct
- Check Heroku app name is `trapid-backend`
- Ensure you have access to the Heroku app
- Check Heroku logs: `heroku logs --tail --app trapid-backend`

### Vercel Deployment Failing
- Verify all three Vercel secrets are correct
- Check that `working-directory: frontend` matches your folder structure
- Ensure Vercel project exists and you have access
- Check Vercel deployment logs in Vercel dashboard

### Database Migrations Not Running
- Check Heroku logs for migration output
- Manually run migrations: `heroku run bin/rails db:migrate --app trapid-backend`
- Verify database is accessible: `heroku pg:info --app trapid-backend`

---

## Alternative: Heroku Dashboard Auto-Deploy

If you prefer not to use GitHub Actions, you can enable auto-deploy via Heroku dashboard:

1. Go to https://dashboard.heroku.com/apps/trapid-backend
2. Click **Deploy** tab
3. Under **Deployment method**, click **GitHub**
4. Connect your GitHub account if not connected
5. Search for and connect the `trapid` repository
6. Under **Automatic deploys**, select `rob` branch
7. Click **Enable Automatic Deploys**

**Note:** This only deploys the backend. Frontend on Vercel should auto-deploy if connected to GitHub.

---

## Current Deployment URLs

- **Backend (Heroku):** https://trapid-backend-447058022b51.herokuapp.com/
- **Frontend (Vercel):** https://trapid-staging.vercel.app/
- **Dashboard:** https://trapid-staging.vercel.app/dashboard

---

## Support

If you encounter any issues:
1. Check GitHub Actions logs (Actions tab)
2. Check Heroku logs: `heroku logs --tail --app trapid-backend`
3. Check Vercel deployment logs in Vercel dashboard
4. Verify all secrets are correctly configured
