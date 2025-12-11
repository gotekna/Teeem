# Staging Environment Quick Start

This is your checklist to get the staging environment up and running in 5 minutes.

## Quick Setup Checklist

- [ ] **Step 1**: Create Vercel project for staging
- [ ] **Step 2**: Get staging project ID
- [ ] **Step 3**: Add GitHub secret
- [ ] **Step 4**: Configure environment variables
- [ ] **Step 5**: Test deployment

## Step 1: Create Vercel Project (2 minutes)

Go to: https://vercel.com/jakes-projects-b6cf0fcb/new

1. Import the teeem repository
2. Set **Project Name**: `teeem-staging`
3. Set **Git Branch**: `rob` (important!)
4. Set **Root Directory**: `frontend`
5. Click "Deploy"

## Step 2: Get Project ID (30 seconds)

After deployment:
1. Go to Settings → General
2. Copy the **Project ID** (looks like `prj_xxxxxxxxxxxxxxxxxxxxx`)

## Step 3: Add GitHub Secret (1 minute)

Go to: https://github.com/YOUR_USERNAME/teeem/settings/secrets/actions

1. Click "New repository secret"
2. **Name**: `VERCEL_STAGING_PROJECT_ID`
3. **Value**: Paste the project ID from Step 2
4. Click "Add secret"

## Step 4: Configure Environment Variables (1 minute)

Run these commands:

```bash
cd /Users/jakebaird/teeem/frontend

# Set API URL (choose one):

# Option A: Use production backend (simpler)
vercel env add VITE_API_URL production
# Enter: https://teeemlive-ce8e2660a615.herokuapp.com

# Option B: Use staging backend (if you created one)
vercel env add VITE_API_URL production
# Enter: https://teeemlive-staging.herokuapp.com

# Copy other required env vars
vercel env add CLOUDINARY_CLOUD_NAME production
# Enter the same value as production

vercel env add VITE_XERO_CLIENT_ID production
# Enter the same value as production
```

To see production values (if needed):
```bash
vercel env pull .env.local
cat .env.local
```

## Step 5: Test Deployment (1 minute)

```bash
# Create/checkout rob branch
git checkout -b rob

# Push to trigger deployment
git push origin rob

# Watch the deployment
# Go to: https://github.com/YOUR_USERNAME/teeem/actions
```

## Done!

Your staging environment should now be live at:
- https://teeem-staging.vercel.app

## Quick Commands Reference

```bash
# Check staging deployments
cd frontend && vercel ls

# Check staging env vars
cd frontend && vercel env ls

# Manual staging deploy (if needed)
cd frontend && vercel --prod

# Sync rob branch with main
git checkout rob
git merge main
git push origin rob
```

## Questions to Answer Before Setup

1. **Should staging use production backend or separate backend?**
   - Production backend: Easier, shares data with production
   - Separate backend: True isolation, requires Heroku staging app

2. **Do you want a custom domain?**
   - Default: `teeem-staging.vercel.app`
   - Custom: `staging.yourdomain.com` (requires DNS setup)

3. **Should rob branch exist already?**
   - If not, create it: `git checkout -b rob && git push origin rob`

## Need Help?

See full documentation: `/Users/jakebaird/teeem/docs/staging-environment-setup.md`
