# TEEEM Multi-Tenant Infrastructure Guide

## Overview

TEEEM uses a multi-tenant architecture where each customer has their own subdomain (e.g., `pilgrim.teeem.com.au`). This document covers the infrastructure setup for environments, DNS, and deployment.

## Environment Structure

| Environment | Heroku App | Database | URL Pattern | Purpose |
|-------------|-----------|----------|-------------|---------|
| Production | `teeemlive` | `teeem-production-db` | `*.teeem.com.au` | Live customers |
| Staging | `teeem-staging` | `teeem-staging-db` | `*.staging.teeem.com.au` | Development & Tekna testing |
| Rob Dev | `teeem-rob-dev` | `teeem-rob-dev-db` | Local | Development |
| Sam Dev | `teeem-sam-dev` | `teeem-sam-dev-db` | Local | Development |

## Heroku Configuration

### Production App Setup

```bash
# Create production app (already exists: teeemlive)
heroku apps:info --app teeemlive

# Add PostgreSQL (Standard-0 for production - already exists)
heroku addons:info --app teeemlive

# Add Redis for caching/jobs (already exists)
heroku addons:info --app teeemlive

# Configure domains for wildcard subdomains
heroku domains:add '*.teeem.com.au' --app teeemlive
heroku domains:add 'teeem.com.au' --app teeemlive

# Required environment variables
heroku config:set RAILS_ENV=production --app teeemlive
heroku config:set RACK_ENV=production --app teeemlive
heroku config:set RAILS_SERVE_STATIC_FILES=true --app teeemlive
heroku config:set RAILS_LOG_TO_STDOUT=true --app teeemlive

# Multi-tenant settings
heroku config:set TEEEM_MASTER_TENANT_SLUG=teeem --app teeemlive
heroku config:set DEFAULT_TENANT_ENV=production --app teeemlive
```

### Staging App Setup

```bash
# Create staging app
heroku create teeem-staging --team teeem

# Add PostgreSQL (Essential-1 for staging)
heroku addons:create heroku-postgresql:essential-1 --app teeem-staging

# Add Redis
heroku addons:create heroku-redis:mini --app teeem-staging

# Configure domains
heroku domains:add '*.staging.teeem.com.au' --app teeem-staging
heroku domains:add 'staging.teeem.com.au' --app teeem-staging

# Required environment variables
heroku config:set RAILS_ENV=staging --app teeem-staging
heroku config:set DEFAULT_TENANT_ENV=staging --app teeem-staging
```

## DNS Configuration (Cloudflare)

### Production DNS Records

```dns
# Main app (Vercel frontend)
teeem.com.au          A      76.76.21.21
www.teeem.com.au      CNAME  cname.vercel-dns.com

# Wildcard for tenant subdomains (Vercel)
*.teeem.com.au        CNAME  cname.vercel-dns.com

# API backend (Heroku)
api.teeem.com.au      CNAME  teeemlive-ce8e2660a615.herokuapp.com
```

### SSL Certificates

- **Vercel**: Automatically provisions SSL for wildcard domains
- **Heroku**: Uses Heroku SSL for API subdomain
- **Cloudflare**: Full (Strict) SSL mode for end-to-end encryption

## Vercel Configuration

### Project Settings

1. **Framework Preset**: Next.js
2. **Root Directory**: `frontend-next`
3. **Build Command**: `npm run build`
4. **Output Directory**: `.next`

### Domain Configuration

1. Add primary domain: `teeem.com.au`
2. Add wildcard domain: `*.teeem.com.au`
3. Ensure SSL is enabled for all domains

### Environment Variables (Vercel)

```bash
# API endpoint
NEXT_PUBLIC_API_URL=https://teeemlive-ce8e2660a615.herokuapp.com

# Environment
NODE_ENV=production
NEXT_PUBLIC_ENV=production
```

## Subdomain Routing

### How It Works

1. **Middleware** (`frontend-next/middleware.ts`) extracts subdomain from hostname
2. Subdomain is set in:
   - `x-tenant-subdomain` response header
   - `tenant-subdomain` cookie (for client-side access)
3. Backend uses subdomain to resolve tenant via `ActsAsTenant`

### Reserved Subdomains

The following subdomains are reserved and will NOT route to tenants:

- `www` - Main website
- `teeem` - Master tenant (TEEEM company)
- `staging` - Staging environment
- `beta` - Beta environment
- `api` - API endpoint
- `admin` - Admin panel
- `app` - Application
- `localhost` - Local development

### Tenant Resolution Flow

```
1. Request to pilgrim.teeem.com.au
   ↓
2. Next.js Middleware extracts "pilgrim"
   ↓
3. Sets x-tenant-subdomain header & cookie
   ↓
4. Frontend API calls include subdomain
   ↓
5. Backend resolves tenant from:
   - Session admin_tenant_id (for TEEEM staff override)
   - Subdomain header
   - User's corporate_group_id
   ↓
6. ActsAsTenant scopes all queries to tenant
```

## Local Development

### Running Multi-Tenant Locally

1. **Modify hosts file** (optional, for subdomain testing):
   ```bash
   # /etc/hosts
   127.0.0.1 pilgrim.localhost
   127.0.0.1 tekna.localhost
   ```

2. **Access via subdomain**:
   - `http://pilgrim.localhost:3000` - Pilgrim tenant
   - `http://tekna.localhost:3000` - Tekna tenant
   - `http://localhost:3000` - Default tenant

3. **Environment variables** (.env.local):
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

### Testing Tenant Switching

1. Login as TEEEM staff (email ending in @teeem.com.au or super_admin role)
2. Yellow tenant switcher banner appears in header
3. Select different tenant from dropdown
4. Page reloads with new tenant context

## Storage Configuration

### Shared vs Dedicated Storage

| Tier | Storage Type | Bucket Structure |
|------|--------------|------------------|
| Shared | Single Wasabi bucket | `teeem-shared/{tenant-slug}/...` |
| Dedicated | Per-tenant bucket | `teeem-{tenant-slug}/...` |

### Storage Provider Configuration

Storage settings are in `StorageConfiguration` model:

```ruby
StorageConfiguration.instance
# Returns tenant's storage config with:
# - provider_type: :wasabi | :s3 | :sharepoint
# - bucket_name
# - path_prefix (for shared storage)
# - connection_config (credentials)
```

## Deployment Checklist

### Before First Customer (Pilgrim)

- [ ] Production Heroku app configured
- [ ] Wildcard SSL working on Vercel
- [ ] DNS configured in Cloudflare
- [ ] Master tenant (TEEEM) created
- [ ] Template packs published
- [ ] Signup flow tested end-to-end
- [ ] Data import tested with sample data
- [ ] Email sending configured (welcome emails)
- [ ] Stripe webhook configured (for billing)

### Adding New Customer

1. Customer completes signup at `/get-started`
2. `TenantProvisioningService` automatically:
   - Creates CorporateGroup (tenant)
   - Creates TenantSetting with branding
   - Creates admin User
   - Imports selected template packs
   - Sets up storage configuration
   - Creates Stripe customer (for billing)
3. Welcome email sent with login credentials
4. Customer accesses `{slug}.teeem.com.au`

## Monitoring & Logging

### Heroku Logs

```bash
# View production logs
heroku logs --tail --app teeemlive

# Filter for tenant switching
heroku logs --tail --app teeemlive | grep TenantSwitch
```

### Key Log Events

- `[TenantSwitch]` - TEEEM staff switching tenants
- `[TenantProvision]` - New tenant created
- `[DataImport]` - Customer importing data

## Troubleshooting

### Subdomain Not Routing

1. Check DNS propagation: `dig pilgrim.teeem.com.au`
2. Verify Vercel wildcard domain is active
3. Check middleware is running (add console.log temporarily)
4. Verify tenant exists: `CorporateGroup.find_by(slug: 'pilgrim')`

### Tenant Data Not Isolating

1. Verify `ActsAsTenant.current_tenant` is set
2. Check model has `acts_as_tenant :corporate_group`
3. Ensure all queries go through scoped models

### SSL Certificate Issues

1. Verify Cloudflare SSL mode is "Full (Strict)"
2. Check Vercel SSL certificate status
3. May need to wait up to 24 hours for wildcard cert

## Security Considerations

### Tenant Isolation

- All database queries automatically scoped by `ActsAsTenant`
- Storage paths prefixed with tenant slug
- Session-based tenant override (not URL-based) prevents URL manipulation

### TEEEM Staff Access

- Staff identified by email domain (@teeem.com.au) or role (super_admin)
- Tenant switching logged with user ID and tenant IDs
- Clear override button to return to default tenant

### Data Protection

- Each tenant's data completely isolated
- No cross-tenant queries possible through normal application flow
- Bulk operations (rake tasks) must explicitly specify tenant scope
