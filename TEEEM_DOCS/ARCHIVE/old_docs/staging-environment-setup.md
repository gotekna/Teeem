# Staging Environment Setup Guide

This document explains how to set up the dedicated staging environment for the `rob` branch.

## Overview

- **Production**: `main` branch → https://teeem.vercel.app
- **Staging**: `rob` branch → https://teeem-staging.vercel.app (or custom domain)

## Architecture

The staging environment is a completely separate Vercel project with:
- Its own project ID
- Its own environment variables
- Its own deployment history
- Automatic deployments from the `rob` branch

## Setup Instructions

### Step 1: Create a New Vercel Project for Staging

You have two options:

#### Option A: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/jakes-projects-b6cf0fcb
2. Click "Add New" → "Project"
3. Choose "Import Git Repository" and select the teeem repository
4. Configure the project:
   - **Project Name**: `teeem-staging`
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. **IMPORTANT**: Set the Git Branch to `rob` (not `main`)
6. Add environment variables (see Step 3 below)
7. Click "Deploy"
8. After deployment, copy the Project ID from Settings → General

#### Option B: Via Vercel CLI

```bash
cd /Users/jakebaird/teeem/frontend

# Create new project linked to 'rob' branch
vercel link --project teeem-staging

# Get the project ID
vercel inspect --scope jakes-projects-b6cf0fcb

# Deploy once to initialize
vercel --prod
```

### Step 2: Get the Staging Project ID

After creating the project, get the Project ID:

1. Go to https://vercel.com/jakes-projects-b6cf0fcb/teeem-staging
2. Click "Settings" → "General"
3. Copy the "Project ID" (format: `prj_xxxxxxxxxxxxxxxxxxxxx`)

### Step 3: Configure Environment Variables

You need to decide: Should staging use the production backend or a separate staging backend?

#### Option 1: Staging Uses Production Backend (Simpler)

Set the same API URL as production:

```bash
cd /Users/jakebaird/teeem/frontend
vercel env add VITE_API_URL production
# When prompted, enter: https://teeem-backend-447058022b51.herokuapp.com
```

Also add other required variables:
```bash
vercel env add CLOUDINARY_CLOUD_NAME production
# Enter the same value as production

vercel env add VITE_XERO_CLIENT_ID production
# Enter the same value as production
```

#### Option 2: Staging Uses Separate Backend (Recommended for True Staging)

If you want to create a separate staging backend:

1. Create new Heroku app: `teeem-backend-staging`
2. Deploy backend to staging
3. Set different API URL:

```bash
cd /Users/jakebaird/teeem/frontend
vercel env add VITE_API_URL production
# When prompted, enter: https://teeem-backend-staging.herokuapp.com
```

### Step 4: Add GitHub Secret

Add the staging project ID to GitHub secrets:

1. Go to https://github.com/YOUR_USERNAME/teeem/settings/secrets/actions
2. Click "New repository secret"
3. Name: `VERCEL_STAGING_PROJECT_ID`
4. Value: `prj_xxxxxxxxxxxxxxxxxxxxx` (from Step 2)
5. Click "Add secret"

### Step 5: Test the Setup

1. Create or switch to the `rob` branch:
   ```bash
   git checkout -b rob
   # or: git checkout rob
   ```

2. Make a small change to the frontend:
   ```bash
   echo "// Staging test" >> frontend/src/App.jsx
   git add frontend/src/App.jsx
   git commit -m "Test staging deployment"
   git push origin rob
   ```

3. Check GitHub Actions:
   - Go to https://github.com/YOUR_USERNAME/teeem/actions
   - You should see "Deploy Staging (Rob's Branch) to Vercel" running

4. Once deployed, visit your staging URL

## Workflow Details

The staging deployment workflow (`.github/workflows/deploy-staging.yml`) automatically triggers when:

1. Code is pushed to the `rob` branch
2. Changes are made to files in the `frontend/` directory
3. The workflow file itself is modified

## Environment Comparison

| Feature | Production | Staging |
|---------|-----------|---------|
| Branch | `main` | `rob` |
| URL | https://teeem.vercel.app | https://teeem-staging.vercel.app |
| Project ID | `prj_mQk4ClT5cVPRAcmEDigB3LBAb0Gl` | `${{ secrets.VERCEL_STAGING_PROJECT_ID }}` |
| Backend API | https://teeem-backend-447058022b51.herokuapp.com | (Your choice - same or separate) |
| Deployment | Manual or on push to main | Automatic on push to rob |

## Custom Domain (Optional)

To use a custom domain for staging:

1. Go to Vercel Dashboard → teeem-staging → Settings → Domains
2. Add domain: `staging.teeem.com` (or your preferred subdomain)
3. Update DNS records as instructed by Vercel
4. Update the workflow file to reflect the new URL

## Troubleshooting

### Deployment Fails with "Project not found"

- Make sure `VERCEL_STAGING_PROJECT_ID` is set correctly in GitHub secrets
- Verify the project exists in your Vercel dashboard

### Environment Variables Not Working

- Check that environment variables are set for "Production" environment in Vercel
- Run `vercel env ls` in the `frontend/` directory to verify

### Changes Not Deploying

- Verify you pushed to the `rob` branch: `git branch -v`
- Check GitHub Actions logs for errors
- Ensure changes are in the `frontend/` directory

### CORS Errors

If staging connects to production backend, you may need to update CORS:

1. Edit `backend/config/initializers/cors.rb`
2. Add staging domain to allowed origins:
   ```ruby
   origins /https:\/\/teeem(-staging)?(-.*)?\.vercel\.app$/
   ```
3. Deploy backend changes

## Maintenance

### Syncing Staging with Main

To keep the `rob` branch updated with `main`:

```bash
git checkout rob
git merge main
git push origin rob
```

### Deleting the Staging Environment

If you need to remove the staging environment:

1. Delete the Vercel project from the dashboard
2. Delete the `VERCEL_STAGING_PROJECT_ID` GitHub secret
3. Delete the workflow file: `.github/workflows/deploy-staging.yml`
4. Optionally delete the `rob` branch

## Benefits of This Setup

1. **Isolated Testing**: Rob can test features without affecting production
2. **Automatic Deployment**: Push to `rob` branch = instant staging deployment
3. **Separate Data**: Can use different backend/database if needed
4. **No Conflicts**: Production and staging deployments are completely independent
5. **Easy Rollback**: Production is unaffected by staging experiments
6. **Preview Before Merge**: Test features before merging to main

## Next Steps

1. Complete Steps 1-4 above to set up the staging project
2. Test the deployment by pushing to the `rob` branch
3. Document the staging URL for team members
4. Consider setting up a staging backend if needed
5. Update CORS configuration if using production backend
