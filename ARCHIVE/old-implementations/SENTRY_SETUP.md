# Sentry Setup Guide for Trapid

This guide will help you set up Sentry error tracking and monitoring for both the Rails backend and React frontend.

## What is Sentry?

Sentry is an error tracking and performance monitoring platform that helps you:
- Catch and track errors in real-time
- Monitor application performance
- Record user sessions when errors occur
- Get detailed stack traces and context
- Track errors across releases

## Free Tier

Sentry offers a generous free tier that includes:
- 5,000 errors per month
- 10,000 performance units per month
- 50 replay sessions per month
- 1 user
- 30 days data retention

This is sufficient for development and small production deployments.

## Step 1: Create a Sentry Account

1. Go to https://sentry.io/signup/
2. Sign up with your email or GitHub account
3. Create your organization (e.g., "Trapid")

## Step 2: Create Projects

You'll need to create two separate projects - one for the backend and one for the frontend.

### Backend Project (Rails)

1. Click "Create Project"
2. Select platform: **Rails**
3. Set alert frequency: Choose your preference (default is fine)
4. Project name: `trapid-backend`
5. Click "Create Project"
6. Copy the **DSN** (Data Source Name) - you'll need this for configuration
   - It looks like: `https://abc123@o123456.ingest.sentry.io/7654321`

### Frontend Project (React)

1. Click "Create Project" again
2. Select platform: **React**
3. Set alert frequency: Choose your preference
4. Project name: `trapid-frontend`
5. Click "Create Project"
6. Copy the **DSN** - you'll need a different one for the frontend

## Step 3: Configure Environment Variables

### Backend Configuration

1. Copy the backend `.env.example` if you haven't already:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Add your backend Sentry DSN to `backend/.env`:
   ```bash
   SENTRY_DSN=https://your-backend-dsn@o123456.ingest.sentry.io/7654321
   ```

3. For production (Heroku), set the environment variable:
   ```bash
   heroku config:set SENTRY_DSN=https://your-backend-dsn@o123456.ingest.sentry.io/7654321 --app trapid-backend
   ```

### Frontend Configuration

1. Copy the frontend `.env.example` if you haven't already:
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. Add your frontend Sentry DSN to `frontend/.env`:
   ```bash
   VITE_SENTRY_DSN=https://your-frontend-dsn@o123456.ingest.sentry.io/1234567
   ```

3. For production (Vercel), add the environment variable in Vercel dashboard:
   - Go to your project settings → Environment Variables
   - Add: `VITE_SENTRY_DSN` = `https://your-frontend-dsn@o123456.ingest.sentry.io/1234567`
   - Apply to: Production, Preview, Development

## Step 4: Test the Integration

### Test Backend

1. Start your Rails server:
   ```bash
   cd backend
   bin/rails server
   ```

2. Trigger a test error in Rails console:
   ```bash
   bin/rails console
   > Sentry.capture_message("Test backend error from Rails console")
   ```

3. Check your Sentry dashboard - you should see the test error appear within seconds

### Test Frontend

1. Start your React dev server:
   ```bash
   cd frontend
   npm run dev
   ```

2. Open browser console and run:
   ```javascript
   Sentry.captureMessage("Test frontend error from browser console")
   ```

3. Or throw a real error:
   ```javascript
   throw new Error("Test error for Sentry")
   ```

4. Check your Sentry dashboard - you should see the test error

## Step 5: Verify Features

### Backend Features Enabled
- ✅ Error tracking
- ✅ Performance monitoring (10% of requests in production)
- ✅ Profiling (10% of transactions in production)
- ✅ Breadcrumbs (HTTP requests, Active Support logs)
- ✅ Sensitive data filtering (passwords, tokens, etc.)
- ✅ Release tracking (git commit SHA)

### Frontend Features Enabled
- ✅ Error tracking
- ✅ Performance monitoring (Browser Tracing)
- ✅ Session Replay (10% of sessions, 100% of error sessions)
- ✅ Breadcrumbs (user interactions, console logs, network requests)
- ✅ Sensitive data filtering (Authorization headers, cookies)
- ✅ Environment tracking (development/production)

## Step 6: Monitor Your Errors

### Sentry Dashboard

Visit your Sentry dashboard at https://sentry.io to:
- View real-time errors as they occur
- See performance metrics and slow transactions
- Watch session replays of user sessions with errors
- Track error trends over time
- Set up email/Slack alerts for critical errors

### Useful Sentry Features

1. **Issues**: Groups similar errors together
2. **Performance**: Shows slow API endpoints and database queries
3. **Replays**: Watch exactly what users did before an error occurred
4. **Releases**: Track errors across different deployments
5. **Alerts**: Get notified when errors spike or critical errors occur

## Troubleshooting

### Errors not appearing in Sentry?

1. Check that your DSN is set correctly in environment variables
2. Verify the DSN format (should start with `https://`)
3. Make sure you're not blocking Sentry's domain in ad blockers
4. Check browser console for Sentry initialization errors
5. Verify your app is actually throwing errors (check server/browser logs)

### Too many errors?

1. Add custom filters in `backend/config/initializers/sentry.rb`
2. Adjust sample rates to reduce noise
3. Use Sentry's issue grouping to merge similar errors
4. Set up ignore rules for known non-critical errors

### Performance monitoring too expensive?

1. Reduce `traces_sample_rate` in production (currently 0.1 = 10%)
2. Use selective instrumentation for critical endpoints only
3. Disable profiling if not needed

## Best Practices

1. **Don't commit DSNs to git** - they're in .env files which are gitignored
2. **Use different projects** for staging and production
3. **Set up release tracking** to correlate errors with deployments
4. **Create custom tags** to filter errors by feature/component
5. **Set up alerts** for critical errors or error rate spikes
6. **Review errors weekly** and create issues for recurring problems

## Next Steps

1. Set up Slack or email notifications for errors
2. Configure custom tags for better error filtering
3. Set up release tracking with git commits
4. Create dashboards for key metrics
5. Integrate with your issue tracker (GitHub, Jira, etc.)

## Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Rails Integration Guide](https://docs.sentry.io/platforms/ruby/guides/rails/)
- [React Integration Guide](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Session Replay](https://docs.sentry.io/product/session-replay/)
