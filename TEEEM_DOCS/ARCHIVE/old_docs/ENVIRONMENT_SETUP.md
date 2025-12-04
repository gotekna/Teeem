# Environment Setup Guide

Complete guide for setting up the TEEEM development environment, including all integrations and API keys.

## Table of Contents

- [Quick Start](#quick-start)
- [Full Setup](#full-setup)
  - [Database](#1-database-postgresql)
  - [Rails Backend](#2-rails-backend)
  - [React Frontend](#3-react-frontend)
  - [Cloudinary (Image Storage)](#4-cloudinary-image-storage)
  - [Microsoft OneDrive (Documents)](#5-microsoft-onedrive-documents)
  - [Xero (Accounting)](#6-xero-accounting)
  - [Anthropic Claude (AI)](#7-anthropic-claude-ai)
  - [xAI Grok (Alternative AI)](#8-xai-grok-alternative-ai)
  - [Google Search API (Optional)](#9-google-search-api-optional)
- [Environment-Specific Configurations](#environment-specific-configurations)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

Minimal setup to run TEEEM locally without integrations:

### Backend

```bash
cd backend

# 1. Copy environment template
cp .env.example .env

# 2. Generate Rails secret key
echo "SECRET_KEY_BASE=$(bin/rails secret)" >> .env

# 3. Create and setup database
bin/rails db:create db:migrate db:seed

# 4. Start server
bin/rails server
# Server runs on http://localhost:3000
```

### Frontend

```bash
cd frontend

# 1. Copy environment template
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
# Server runs on http://localhost:5173
```

**That's it!** The app will run with basic functionality. To enable integrations (OneDrive, Xero, etc.), continue to Full Setup below.

---

## Full Setup

### 1. Database (PostgreSQL)

TEEEM uses PostgreSQL for all data storage.

#### Installation

**macOS (Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download installer from: https://www.postgresql.org/download/windows/

#### Configuration

The default `DATABASE_URL` in `.env.example` works for local development:
```bash
DATABASE_URL=postgresql://localhost/teeem_development
```

If you need custom credentials:
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/teeem_development
```

#### Create Database

```bash
cd backend
bin/rails db:create
bin/rails db:migrate
bin/rails db:seed  # Optional: Load sample data
```

---

### 2. Rails Backend

#### Prerequisites

- Ruby 3.3.0 or later (check with `ruby -v`)
- Bundler (`gem install bundler`)

#### Setup

```bash
cd backend

# Install dependencies
bundle install

# Generate secret key
bin/rails secret
# Copy the output and add to .env as SECRET_KEY_BASE
```

#### Start Server

```bash
bin/rails server
```

Visit http://localhost:3000 to verify the API is running.

---

### 3. React Frontend

#### Prerequisites

- Node.js 18 or later (check with `node -v`)
- npm 9 or later (check with `npm -v`)

#### Setup

```bash
cd frontend

# Install dependencies
npm install

# Verify environment
cp .env.example .env
# Edit .env if backend is not on localhost:3000
```

#### Start Development Server

```bash
npm run dev
```

Visit http://localhost:5173 to see the app.

#### Build for Production

```bash
npm run build
# Creates production build in frontend/dist
```

---

### 4. Cloudinary (Image Storage)

Cloudinary stores product images, uploaded files, and handles image transformations.

#### Why You Need It
- Product image scraping and storage
- User-uploaded media
- Image optimization and transformations

#### Setup Steps

1. **Create Account**
   - Go to https://cloudinary.com
   - Sign up for free (25GB storage, 25k transformations/month)

2. **Get Credentials**
   - After signup, you'll see your Dashboard
   - Copy these three values:
     - **Cloud Name** (e.g., `dtg6d2c7h`)
     - **API Key** (e.g., `895213223838643`)
     - **API Secret** (e.g., `Cl1Ufiux0DQMBnkD...`)

3. **Add to .env**
   ```bash
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. **Test Integration**
   ```bash
   cd backend
   bin/rails console
   > Cloudinary::Uploader.upload("https://picsum.photos/200")
   # Should return upload details
   ```

#### Documentation
- Ruby SDK: https://cloudinary.com/documentation/rails_integration
- Dashboard: https://cloudinary.com/console

---

### 5. Microsoft OneDrive (Documents)

OneDrive integration enables document storage and management for construction jobs.

#### Why You Need It
- Store job documents, plans, and contracts
- Automatic folder creation for new jobs
- Document versioning and sharing

#### Setup Steps

1. **Create Azure App Registration**
   - Go to https://portal.azure.com
   - Sign in with Microsoft account
   - Navigate to: **Azure Active Directory** → **App registrations** → **New registration**

2. **Configure App**
   - **Name:** `TEEEM OneDrive Integration`
   - **Supported account types:** "Accounts in any organizational directory and personal Microsoft accounts (multitenant)"
   - **Redirect URI:**
     - Type: Web
     - URL: `http://localhost:3000/api/v1/onedrive/callback` (development)
     - For production, add: `https://teeem-backend-447058022b51.herokuapp.com/api/v1/onedrive/callback`
   - Click **Register**

3. **Get Client ID**
   - On the app overview page, copy the **Application (client) ID**
   - This is your `ONEDRIVE_CLIENT_ID`

4. **Create Client Secret**
   - Go to **Certificates & secrets**
   - Click **New client secret**
   - Description: "TEEEM Backend"
   - Expires: 24 months (or custom)
   - Click **Add**
   - **IMPORTANT:** Copy the **Value** immediately (it won't be shown again)
   - This is your `ONEDRIVE_CLIENT_SECRET`

5. **Configure API Permissions**
   - Go to **API permissions**
   - Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
   - Add these permissions:
     - `Files.ReadWrite.All` (read/write user files)
     - `offline_access` (refresh tokens)
     - `User.Read` (basic profile)
   - Click **Add permissions**
   - *Optional:* Click **Grant admin consent** if you're an admin

6. **Add to .env**
   ```bash
   ONEDRIVE_CLIENT_ID=your_microsoft_app_client_id
   ONEDRIVE_CLIENT_SECRET=your_microsoft_app_client_secret
   ONEDRIVE_REDIRECT_URI=http://localhost:3000/api/v1/onedrive/callback
   ```

7. **Test Integration**
   - Start backend server: `bin/rails server`
   - Go to frontend: http://localhost:5173/settings
   - Click "Connect OneDrive"
   - Authorize the app
   - Should redirect back with success message

#### Documentation
- Microsoft Graph API: https://learn.microsoft.com/en-us/graph/auth-register-app-v2
- OneDrive API: https://learn.microsoft.com/en-us/onedrive/developer/

---

### 6. Xero (Accounting)

Xero integration syncs invoices, purchase orders, and payment tracking.

#### Why You Need It
- Sync invoices from Xero to TEEEM
- Match purchase orders to Xero bills
- Track payment status automatically
- Generate reports with live accounting data

#### Setup Steps

1. **Create Xero Developer Account**
   - Go to https://developer.xero.com
   - Sign in with your Xero account (or create one)
   - Accept developer terms

2. **Create New App**
   - Go to https://developer.xero.com/app/manage
   - Click **New app** → **OAuth 2.0**
   - Fill in details:
     - **App name:** `TEEEM`
     - **Company or application URL:** `https://teeem.vercel.app`
     - **OAuth 2.0 redirect URI:** `http://localhost:5173/settings/xero/callback` (development)
       - For production, add: `https://teeem.vercel.app/settings/xero/callback`
   - Click **Create app**

3. **Get Credentials**
   - You'll see your app's details page
   - Copy **Client ID** (this is `XERO_CLIENT_ID`)
   - Click **Generate a secret**
   - Copy the secret immediately (this is `XERO_CLIENT_SECRET`)

4. **Configure Scopes**
   - On app details page, scroll to **OAuth 2.0 scopes**
   - Ensure these are enabled:
     - `accounting.transactions` (read invoices, bills, payments)
     - `accounting.contacts` (read suppliers and customers)
     - `offline_access` (refresh tokens)

5. **Add to .env**
   ```bash
   # Backend .env
   XERO_CLIENT_ID=your_xero_client_id
   XERO_CLIENT_SECRET=your_xero_client_secret

   # Frontend .env (Xero redirects to frontend)
   XERO_REDIRECT_URI=http://localhost:5173/settings/xero/callback
   ```

6. **Test Integration**
   - Start both servers (backend and frontend)
   - Go to: http://localhost:5173/settings
   - Click "Connect Xero"
   - Authorize with your Xero organization
   - Should redirect back with success message
   - Go to Purchase Orders page - invoices should start syncing

#### Documentation
- Xero API Guide: https://developer.xero.com/documentation/getting-started-guide/
- OAuth 2.0 Flow: https://developer.xero.com/documentation/guides/oauth2/overview/

---

### 7. Anthropic Claude (AI)

Claude powers AI-driven features like plan review and intelligent image selection.

#### Why You Need It
- **Plan Review Service:** Analyzes construction plans and provides AI feedback
- **Product Image Scraper:** Intelligently selects best product images from search results
- Future: AI-powered estimating, schedule optimization

#### Setup Steps

1. **Create Anthropic Account**
   - Go to https://console.anthropic.com
   - Sign up or log in

2. **Create API Key**
   - Go to **Settings** → **API Keys**
   - Click **Create Key**
   - Name: "TEEEM Development"
   - Copy the key (starts with `sk-ant-...`)
   - **IMPORTANT:** Save it immediately (won't be shown again)

3. **Add to .env**
   ```bash
   ANTHROPIC_API_KEY=sk-ant-your-api-key-here
   ```

4. **Test Integration**
   ```bash
   cd backend
   bin/rails console
   > client = Anthropic::Client.new
   > response = client.messages(model: "claude-3-sonnet-20240229", max_tokens: 100, messages: [{role: "user", content: "Hello!"}])
   > response["content"][0]["text"]
   # Should return Claude's response
   ```

#### Pricing
- **Free tier:** $5 in credits (good for ~500k tokens)
- **Pay-as-you-go:** $3 per million input tokens, $15 per million output tokens (Sonnet)
- Monitor usage: https://console.anthropic.com/settings/usage

#### Documentation
- API Reference: https://docs.anthropic.com/claude/reference/getting-started-with-the-api
- Pricing: https://www.anthropic.com/pricing

---

### 8. xAI Grok (Alternative AI)

Grok provides alternative AI analysis using xAI's models.

#### Why You Need It
- Alternative to Claude for AI analysis
- Used by GrokService for construction analysis

#### Setup Steps

1. **Get xAI API Access**
   - Go to https://x.ai console
   - Sign up for API access (currently in beta)
   - Request access if needed

2. **Create API Key**
   - Once approved, generate an API key
   - Copy the key

3. **Add to .env**
   ```bash
   XAI_API_KEY=your_xai_api_key
   ```

#### Note
xAI API is currently in limited beta. If you don't have access, the app will fall back to Claude for AI features.

#### Documentation
- xAI Website: https://x.ai

---

### 9. Google Search API (Optional)

Google Custom Search API improves product image search results.

#### Why You Need It (Optional)
- **Better image search:** More accurate product images
- **Without it:** App uses basic fallback search (works, but lower quality)

#### Setup Steps

1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com
   - Create new project: "TEEEM"

2. **Enable Custom Search API**
   - In project dashboard, go to **APIs & Services** → **Library**
   - Search for "Custom Search API"
   - Click **Enable**

3. **Create API Key**
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **API Key**
   - Copy the API key
   - This is your `GOOGLE_SEARCH_API_KEY`

4. **Create Custom Search Engine**
   - Go to https://programmablesearchengine.google.com
   - Click **Add** or **Create new search engine**
   - **Sites to search:** Leave empty and select "Search the entire web"
   - **Name:** "TEEEM Product Images"
   - Turn on **Image search**
   - Click **Create**

5. **Get Search Engine ID**
   - After creation, click **Control Panel**
   - Copy the **Search engine ID** (CX ID)
   - This is your `GOOGLE_SEARCH_CX`

6. **Add to .env**
   ```bash
   GOOGLE_SEARCH_API_KEY=your_google_api_key
   GOOGLE_SEARCH_CX=your_custom_search_engine_id
   ```

7. **Test Integration**
   ```bash
   cd backend
   bin/rails console
   > ProductImageScraper.new("construction hammer").scrape_images
   # Should return array of high-quality image URLs
   ```

#### Pricing
- **Free tier:** 100 queries per day
- **Paid:** $5 per 1,000 queries (up to 10k queries/day)
- Monitor usage in Google Cloud Console

#### Documentation
- Custom Search API: https://developers.google.com/custom-search/v1/overview
- Pricing: https://developers.google.com/custom-search/v1/overview#pricing

---

## Environment-Specific Configurations

### Development (Local)

```bash
# backend/.env
DATABASE_URL=postgresql://localhost/teeem_development
FRONTEND_URL=http://localhost:5173
ONEDRIVE_REDIRECT_URI=http://localhost:3000/api/v1/onedrive/callback
XERO_REDIRECT_URI=http://localhost:5173/settings/xero/callback

# frontend/.env
VITE_API_URL=http://localhost:3000
```

### Production (Heroku + Vercel)

Backend environment variables are set via Heroku:

```bash
# Set via Heroku Dashboard or CLI
heroku config:set DATABASE_URL=<heroku_postgres_url> --app teeem-backend
heroku config:set FRONTEND_URL=https://teeem.vercel.app --app teeem-backend
heroku config:set ONEDRIVE_REDIRECT_URI=https://teeem-backend-447058022b51.herokuapp.com/api/v1/onedrive/callback --app teeem-backend
heroku config:set XERO_REDIRECT_URI=https://teeem.vercel.app/settings/xero/callback --app teeem-backend
```

Frontend environment variables in Vercel:
- Go to Vercel Dashboard → Project Settings → Environment Variables
- Add: `VITE_API_URL=https://teeem-backend-447058022b51.herokuapp.com`

---

## Security Best Practices

### Never Commit Secrets

- `.env` files are in `.gitignore` - do NOT remove this
- Only `.env.example` should be committed (with placeholder values)
- Never share API keys in screenshots, issues, or public forums

### Use Read-Only Keys When Possible

Some services offer read-only API keys for safer development:
- Xero: Use "read only" scope if you only need to view data
- Cloudinary: Create separate upload presets with restrictions

### Rotate Keys Regularly

- Rotate production API keys every 90 days
- If a key is compromised, revoke it immediately and generate a new one
- Update keys in Heroku/Vercel when rotating

### Environment Separation

- **Development keys:** Use separate free/test accounts
- **Production keys:** Use paid accounts with proper limits
- Never use production keys in development

### Monitor API Usage

Set up usage alerts:
- Cloudinary: Set storage/bandwidth alerts
- Anthropic: Set spend limits
- Google: Set quota alerts
- Xero: Monitor API call limits

---

## Troubleshooting

### Database Connection Issues

**Error:** `PG::ConnectionBad: could not connect to server`

**Solutions:**
1. Check PostgreSQL is running:
   ```bash
   # macOS
   brew services list
   # Ubuntu
   sudo systemctl status postgresql
   ```

2. Verify DATABASE_URL format:
   ```bash
   postgresql://username:password@host:port/database_name
   ```

3. Test connection:
   ```bash
   psql postgresql://localhost/teeem_development
   ```

### Frontend Can't Connect to Backend

**Error:** Network error / CORS error in browser console

**Solutions:**
1. Check backend is running: `curl http://localhost:3000`
2. Verify VITE_API_URL in frontend `.env`
3. Check backend CORS config in `backend/config/initializers/cors.rb`
4. Restart both servers

### OAuth Redirects Fail

**Error:** Invalid redirect URI / OAuth error

**Solutions:**
1. Verify redirect URIs match **exactly** in:
   - Your `.env` file
   - OAuth provider settings (Azure, Xero)
   - Check for trailing slashes, http vs https

2. For OneDrive, ensure redirect is added to Azure app
3. For Xero, ensure redirect is added in Xero app settings

### API Key Not Working

**Error:** 401 Unauthorized / Invalid API key

**Solutions:**
1. Check for extra spaces or newlines in `.env`
2. Restart server after changing `.env`
3. Verify key hasn't expired (check provider dashboard)
4. Regenerate key if needed

### Image Upload Fails

**Error:** Cloudinary upload error

**Solutions:**
1. Verify Cloudinary credentials are correct
2. Check you haven't exceeded free tier limits
3. Test upload manually:
   ```bash
   cd backend
   bin/rails console
   > Cloudinary::Uploader.upload("https://picsum.photos/200")
   ```

### Missing Environment Variables

**Error:** `ENV['SOME_VAR'] is nil`

**Solutions:**
1. Copy `.env.example` to `.env`
2. Fill in all required values
3. Restart server
4. Check `.env` is in project root, not subdirectory

---

## Getting Help

If you're still stuck:

1. **Check logs:**
   - Backend: `backend/log/development.log`
   - Frontend: Browser console (F12)

2. **Search issues:**
   - GitHub: https://github.com/yourusername/teeem/issues
   - Stack Overflow with error message

3. **Ask for help:**
   - Create GitHub issue with error logs
   - Include: OS, Ruby/Node versions, steps to reproduce

---

## Summary Checklist

After completing setup, verify everything works:

- [ ] Backend server runs: `cd backend && bin/rails server`
- [ ] Frontend server runs: `cd frontend && npm run dev`
- [ ] Can access frontend: http://localhost:5173
- [ ] Can create account and log in
- [ ] Cloudinary: Can upload product images
- [ ] OneDrive: Can connect and create folders
- [ ] Xero: Can connect and view invoices
- [ ] AI features: Plan review works

**You're ready to develop!** 🎉
