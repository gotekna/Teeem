# Staging Environment Architecture

## Deployment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Repository                        │
│                                                                  │
│  ┌──────────────┐                      ┌──────────────┐         │
│  │              │                      │              │         │
│  │ main branch  │                      │  rob branch  │         │
│  │              │                      │              │         │
│  └──────┬───────┘                      └──────┬───────┘         │
│         │                                      │                 │
└─────────┼──────────────────────────────────────┼─────────────────┘
          │                                      │
          │ Push triggers                        │ Push triggers
          │ deploy-frontend.yml                  │ deploy-staging.yml
          │                                      │
          ▼                                      ▼
┌─────────────────────┐              ┌─────────────────────┐
│  GitHub Actions     │              │  GitHub Actions     │
│  (Production)       │              │  (Staging)          │
└─────────┬───────────┘              └─────────┬───────────┘
          │                                      │
          │ Uses:                                │ Uses:
          │ VERCEL_TOKEN                         │ VERCEL_TOKEN
          │ prj_mQk4ClT5c...                     │ VERCEL_STAGING_PROJECT_ID
          │                                      │
          ▼                                      ▼
┌─────────────────────┐              ┌─────────────────────┐
│   Vercel Project    │              │   Vercel Project    │
│   "teeem"          │              │   "teeem-staging"  │
│                     │              │                     │
│   teeem.vercel.app │              │   teeem-staging    │
│                     │              │   .vercel.app       │
└─────────┬───────────┘              └─────────┬───────────┘
          │                                      │
          │ API calls                            │ API calls
          │                                      │
          │         ┌────────────────────────────┤
          │         │                            │
          ▼         ▼                            ▼
    ┌─────────────────────┐          ┌─────────────────────┐
    │  Production Backend │          │  Staging Backend    │
    │  teeemlive         │          │  (Optional)         │
    │  Heroku             │          │  teeemlive-        │
    │  .herokuapp.com     │          │  staging            │
    └─────────────────────┘          └─────────────────────┘
```

## Environment Variables

### Production (teeem.vercel.app)

```
VITE_API_URL=https://teeemlive-ce8e2660a615.herokuapp.com
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
VITE_XERO_CLIENT_ID=<your-xero-client-id>
```

### Staging (teeem-staging.vercel.app)

**Option 1: Shared Backend**
```
VITE_API_URL=https://teeemlive-ce8e2660a615.herokuapp.com
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
VITE_XERO_CLIENT_ID=<your-xero-client-id>
```

**Option 2: Separate Backend**
```
VITE_API_URL=https://teeemlive-staging.herokuapp.com
CLOUDINARY_CLOUD_NAME=<your-staging-cloud-name>
VITE_XERO_CLIENT_ID=<your-staging-xero-client-id>
```

## Deployment Triggers

### Production
- **Trigger**: Push to `main` branch
- **Path**: `frontend/**` or `.github/workflows/deploy-frontend.yml`
- **Action**: `.github/workflows/deploy-frontend.yml`
- **Destination**: https://teeem.vercel.app

### Staging
- **Trigger**: Push to `rob` branch
- **Path**: `frontend/**` or `.github/workflows/deploy-staging.yml`
- **Action**: `.github/workflows/deploy-staging.yml`
- **Destination**: https://teeem-staging.vercel.app

## Workflow Comparison

| Feature | Production | Staging |
|---------|-----------|---------|
| Git Branch | `main` | `rob` |
| Workflow File | `deploy-frontend.yml` | `deploy-staging.yml` |
| Vercel Project | teeem | teeem-staging |
| Project ID Secret | Hardcoded in workflow | `VERCEL_STAGING_PROJECT_ID` |
| Domain | teeem.vercel.app | teeem-staging.vercel.app |
| Backend | Production Heroku | Your choice |
| Auto Deploy | Yes | Yes |

## Data Flow

### User Visits Production
```
User → teeem.vercel.app → Vite SPA → API calls → teeemlive-ce8e2660a615.herokuapp.com → PostgreSQL
```

### User Visits Staging
```
User → teeem-staging.vercel.app → Vite SPA → API calls → [Backend] → PostgreSQL
```

Where `[Backend]` is either:
- Same as production (shared data)
- Separate staging backend (isolated data)

## Branch Strategy

### Recommended Workflow

1. **Development**: Work on feature branches
   ```bash
   git checkout -b feature/my-feature
   # ... make changes ...
   git push origin feature/my-feature
   ```

2. **Staging (Rob's Testing)**: Merge to `rob` branch
   ```bash
   git checkout rob
   git merge feature/my-feature
   git push origin rob
   # ✅ Auto-deploys to teeem-staging.vercel.app
   ```

3. **Testing**: Rob tests on staging URL
   - If issues found: Fix on feature branch, merge to `rob` again
   - If approved: Continue to step 4

4. **Production**: Merge to `main`
   ```bash
   git checkout main
   git merge rob
   git push origin main
   # ✅ Auto-deploys to teeem.vercel.app
   ```

### Keeping Staging Up to Date

Periodically sync `rob` with `main`:
```bash
git checkout rob
git merge main
git push origin rob
```

## Security Considerations

### Secrets Management

- **Never commit** API keys or secrets to git
- Use Vercel environment variables for all sensitive data
- Use GitHub secrets for deployment credentials

### CORS Configuration

If staging uses production backend, update CORS:

```ruby
# backend/config/initializers/cors.rb
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(
      'https://teeem.vercel.app',           # Production
      'https://teeem-staging.vercel.app',   # Staging
      /https:\/\/teeem(-staging)?(-.*)?\.vercel\.app$/,  # All Vercel previews
      'http://localhost:5173',
      'http://localhost:5176'
    )
    resource '*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head]
  end
end
```

## Monitoring

### Check Production Status
```bash
curl -I https://teeem.vercel.app
curl https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/tables
```

### Check Staging Status
```bash
curl -I https://teeem-staging.vercel.app
# Backend depends on your setup
```

### View Deployment Logs

**Vercel**: https://vercel.com/jakes-projects-b6cf0fcb/teeem-staging/deployments

**GitHub Actions**: https://github.com/YOUR_USERNAME/teeem/actions

## Benefits of This Architecture

1. **Isolation**: Staging and production are completely separate
2. **Automatic**: Push to `rob` = instant staging deployment
3. **Flexible**: Can use shared or separate backend
4. **Safe**: Production unaffected by staging experiments
5. **Fast**: Vercel provides instant deployments
6. **Free**: Vercel Hobby plan supports multiple projects

## Cost Implications

Both projects run on the same Vercel Hobby account:
- **Cost**: $0 (Hobby plan is free)
- **Limits**: Shared between all projects
  - 100 GB bandwidth per month
  - 100 hours Serverless Function execution
  - Unlimited deployments

If you hit limits, consider:
- Upgrading to Pro plan ($20/month)
- Using preview deployments instead of separate project
- Implementing deployment throttling
