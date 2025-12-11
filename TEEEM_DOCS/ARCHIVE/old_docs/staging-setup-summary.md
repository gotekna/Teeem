# Staging Environment Setup Summary

## What Was Created

I've set up the infrastructure for a dedicated staging environment that automatically deploys from the `rob` branch. Here's what's ready:

### 1. GitHub Actions Workflow
**File**: `.github/workflows/deploy-staging.yml`

This workflow:
- Triggers automatically when code is pushed to the `rob` branch
- Only deploys when frontend files change
- Uses the same Vercel token as production
- Deploys to a separate Vercel project (teeem-staging)

### 2. Documentation
Three comprehensive guides have been created:

1. **Quick Start Guide**: `/Users/jakebaird/teeem/docs/staging-quick-start.md`
   - 5-minute setup checklist
   - Step-by-step instructions
   - Common commands reference

2. **Full Setup Guide**: `/Users/jakebaird/teeem/docs/staging-environment-setup.md`
   - Detailed setup instructions
   - Environment variable configuration
   - Troubleshooting guide
   - CORS configuration

3. **Architecture Diagram**: `/Users/jakebaird/teeem/docs/staging-architecture.md`
   - Visual deployment flow
   - Branch strategy recommendations
   - Security considerations
   - Monitoring commands

## What You Need to Do

### Prerequisites
- ✅ `rob` branch exists (confirmed)
- ✅ GitHub Actions workflow created
- ✅ Documentation created

### Setup Steps (5-10 minutes)

#### 1. Create Vercel Staging Project

**Option A: Via Vercel Dashboard** (Recommended)
1. Go to https://vercel.com/jakes-projects-b6cf0fcb/new
2. Import your teeem repository
3. Set **Project Name**: `teeem-staging`
4. Set **Git Branch**: `rob` ⚠️ IMPORTANT
5. Set **Root Directory**: `frontend`
6. Framework: Vite (should auto-detect)
7. Click "Deploy"

**Option B: Via CLI**
```bash
cd /Users/jakebaird/teeem/frontend
vercel link --project teeem-staging
```

#### 2. Get Staging Project ID

After creating the project:
1. Go to Vercel Dashboard → teeem-staging → Settings → General
2. Copy the **Project ID** (format: `prj_xxxxxxxxxxxxxxxxxxxxx`)

#### 3. Add GitHub Secret

1. Go to your GitHub repository settings
2. Navigate to: Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. **Name**: `VERCEL_STAGING_PROJECT_ID`
5. **Value**: Paste the project ID from step 2
6. Click "Add secret"

#### 4. Configure Environment Variables

You have two choices for the staging backend:

**Choice 1: Use Production Backend** (Easier, recommended for start)
```bash
cd /Users/jakebaird/teeem/frontend

# Set to production backend
vercel env add VITE_API_URL production
# When prompted: https://teeemlive-ce8e2660a615.herokuapp.com

# Copy other env vars
vercel env add CLOUDINARY_CLOUD_NAME production
# Enter same value as production

vercel env add VITE_XERO_CLIENT_ID production
# Enter same value as production
```

**Choice 2: Create Separate Staging Backend** (True isolation)
1. Create new Heroku app: `heroku create teeemlive-staging`
2. Deploy backend to new app
3. Set staging API URL:
```bash
vercel env add VITE_API_URL production
# Enter: https://teeemlive-staging.herokuapp.com
```

#### 5. Update CORS (If Using Production Backend)

If staging shares the production backend, update CORS configuration:

```bash
# Edit: /Users/jakebaird/teeem/backend/config/initializers/cors.rb
# Change the origins line to:
origins /https:\/\/teeem(-staging)?(-.*)?\.vercel\.app$/

# Then deploy backend:
cd /Users/jakebaird/teeem
git add backend/config/initializers/cors.rb
git commit -m "Update CORS for staging environment"
git subtree push --prefix backend heroku main
heroku restart --app teeemlive
```

#### 6. Test the Deployment

```bash
# Make a small test change
cd /Users/jakebaird/teeem
git checkout rob
echo "// Staging test" >> frontend/src/App.jsx
git add frontend/src/App.jsx
git commit -m "Test staging deployment"
git push origin rob
```

Then:
1. Go to https://github.com/YOUR_USERNAME/teeem/actions
2. Watch the "Deploy Staging (Rob's Branch) to Vercel" workflow run
3. Once complete, visit https://teeem-staging.vercel.app

## How It Works

### Deployment Flow

```
Push to 'rob' branch
    ↓
GitHub Actions triggers (.github/workflows/deploy-staging.yml)
    ↓
Vercel builds frontend from 'rob' branch
    ↓
Deploys to https://teeem-staging.vercel.app
    ↓
Staging app connects to backend (production or staging)
```

### Branch Strategy

```
feature/my-feature → rob (staging) → main (production)
```

1. Develop on feature branches
2. Merge to `rob` for Rob to test on staging
3. Once approved, merge `rob` to `main` for production

## URLs After Setup

- **Production**: https://teeem.vercel.app (from `main` branch)
- **Staging**: https://teeem-staging.vercel.app (from `rob` branch)
- **Backend**: https://teeemlive-ce8e2660a615.herokuapp.com (shared or separate)

## Quick Commands

```bash
# Deploy to staging
git checkout rob
git push origin rob

# Check staging deployments
cd frontend && vercel ls

# Check staging env vars
cd frontend && vercel env ls

# Sync rob with main
git checkout rob
git merge main
git push origin rob

# View staging logs
# Visit: https://vercel.com/jakes-projects-b6cf0fcb/teeem-staging
```

## Important Notes

1. **The `rob` branch already exists** - You can start using it immediately
2. **Automatic deployments** - Every push to `rob` triggers a staging deploy
3. **Independent of production** - Changes to `rob` don't affect `main` or production
4. **Same Vercel account** - Both projects run on your Hobby plan (free)
5. **Environment isolation** - Staging has its own environment variables

## Troubleshooting

### "Project not found" error
- Ensure `VERCEL_STAGING_PROJECT_ID` is set in GitHub secrets
- Verify the project exists in Vercel dashboard

### CORS errors in staging
- Update `backend/config/initializers/cors.rb` to allow staging domain
- Restart Heroku: `heroku restart --app teeemlive`

### Environment variables not working
- Ensure vars are set for "Production" environment in Vercel
- Check with: `cd frontend && vercel env ls`

### Deployment not triggering
- Verify you pushed to the `rob` branch: `git branch -v`
- Check GitHub Actions logs for errors
- Ensure changes are in `frontend/` directory

## Next Steps

1. ✅ Complete setup steps 1-4 above
2. ✅ Test a deployment to staging
3. ✅ Verify staging URL loads correctly
4. ✅ Test a full feature on staging before production
5. Document your staging URL for team members

## Questions?

- **Quick reference**: See `docs/staging-quick-start.md`
- **Detailed guide**: See `docs/staging-environment-setup.md`
- **Architecture**: See `docs/staging-architecture.md`

## Benefits

- 🔒 **Safe testing**: Test on staging before production
- 🚀 **Automatic deployment**: Push to `rob` = instant staging deploy
- 🎯 **Isolated environment**: Staging won't break production
- ⚡ **Fast feedback**: See changes live in seconds
- 🔄 **Easy rollback**: Production unaffected by staging issues
- 💰 **Free**: No additional cost on Vercel Hobby plan
