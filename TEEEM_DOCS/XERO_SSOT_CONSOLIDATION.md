# Xero SSoT Consolidation

**Date:** 2025-12-09
**Status:** ✅ Implemented
**Migration:** `20251208202548_consolidate_xero_connections_to_s_so_t.rb`

## Problem: SSoT Violation

We had **TWO systems** storing Xero OAuth tokens:

1. **`xero_credentials`** table - Global Xero credentials
2. **`company_xero_connections`** table - Per-company credentials

Both stored the same OAuth data (access_token, refresh_token, expires_at), violating Single Source of Truth principle.

## Solution: Hybrid Architecture

**`xero_credentials`** = SSoT for OAuth tokens
**`company_xero_connections`** = Company → Xero org mappings only

```
┌─────────────────────┐
│  xero_credentials   │  ← SSoT for OAuth tokens
│  - id               │
│  - tenant_id (PK)   │
│  - access_token     │  ← Only stored here
│  - refresh_token    │  ← Only stored here
│  - expires_at       │  ← Only stored here
│  - tenant_name      │
│  - is_primary       │
└─────────────────────┘
           ↑
           │ has_many
           │
┌──────────────────────────┐
│company_xero_connections  │  ← Company mappings
│  - id                    │
│  - company_id (FK)       │
│  - xero_credential_id(FK)│  ← References SSoT
│  - xero_tenant_id        │
│  - xero_tenant_name      │
│  - connection_status     │
│  - last_sync_at          │
│  - accounting_method     │
│  - financial_year_end    │
└──────────────────────────┘
```

## Migration Changes

### Added:
- `company_xero_connections.xero_credential_id` - Foreign key to `xero_credentials`
- `company_xero_connections.accounting_method` - Company-specific setting
- `company_xero_connections.financial_year_end` - Company-specific setting

### Removed:
- `company_xero_connections.encrypted_access_token` ❌ (now in SSoT)
- `company_xero_connections.encrypted_refresh_token` ❌ (now in SSoT)
- `company_xero_connections.token_expires_at` ❌ (now in SSoT)

### Data Migration:
The migration automatically linked existing `company_xero_connections` to their matching `xero_credentials` by matching `tenant_id`.

## Model Updates

### CompanyXeroConnection
```ruby
# Before (Duplicate token storage)
class CompanyXeroConnection
  encrypts :encrypted_access_token
  encrypts :encrypted_refresh_token
  # ...tokens stored here
end

# After (References SSoT)
class CompanyXeroConnection
  belongs_to :xero_credential, optional: true

  def access_token
    xero_credential&.access_token  # Delegates to SSoT
  end

  def refresh_token
    xero_credential&.refresh_token  # Delegates to SSoT
  end
end
```

### XeroCredential
```ruby
class XeroCredential
  has_many :company_xero_connections
  # SSoT for all OAuth tokens
end
```

## Benefits

1. **Single Source of Truth** - OAuth tokens stored in ONE place only
2. **No Token Duplication** - One Xero org = one set of tokens
3. **Easier Token Refresh** - Refresh once, affects all companies using that org
4. **Data Integrity** - Foreign key constraints prevent orphaned data
5. **Smaller Database** - Less duplicate data

## Usage

### Linking a Company to Xero:
```ruby
# Find or create credential for Xero org
credential = XeroCredential.find_or_create_by(tenant_id: tenant_id) do |c|
  c.access_token = oauth_access_token
  c.refresh_token = oauth_refresh_token
  c.expires_at = 30.minutes.from_now
  c.tenant_name = "My Xero Org"
end

# Link company to credential
connection = CompanyXeroConnection.find_or_initialize_by(company: my_company)
connection.link_to_credential!(credential)
```

### Accessing Tokens:
```ruby
connection = company.company_xero_connection
connection.access_token  # → delegates to xero_credential.access_token
connection.refresh_token # → delegates to xero_credential.refresh_token
connection.connected?    # → checks credential exists and not expired
```

### Refreshing Tokens:
```ruby
# Refresh happens at credential level
credential.refresh_tokens!

# All companies using this credential automatically get new tokens
credential.company_xero_connections.each do |conn|
  conn.access_token # → automatically uses refreshed token
end
```

## Rollback

If needed, the migration can be rolled back:

```bash
rails db:rollback
```

This will:
1. Restore token columns to `company_xero_connections`
2. Copy tokens back from `xero_credentials`
3. Remove the foreign key

## Testing

After deployment, verify:

```ruby
# Check all connections have credentials
CompanyXeroConnection.where(xero_credential_id: nil).count # → should be 0

# Check token delegation works
conn = CompanyXeroConnection.first
conn.access_token # → should return token from xero_credential

# Check connection status
conn.connected? # → should check credential expiry
```

## Related Files

- **Migration:** `backend/db/migrate/20251208202548_consolidate_xero_connections_to_s_so_t.rb`
- **Models:**
  - `backend/app/models/company_xero_connection.rb`
  - `backend/app/models/xero_credential.rb`
- **Controllers:**
  - `backend/app/controllers/api/v1/company_xero_controller.rb`
  - `backend/app/controllers/api/v1/xero_controller.rb`
- **Frontend:**
  - `frontend-next/components/xero/XeroConnectionsPopup.tsx`

## Future Improvements

1. **Auto-linking:** When user authorizes multiple Xero orgs, automatically create `company_xero_connections` for companies that match
2. **Smart matching:** Use ABN/ACN to auto-match TEEEM companies to Xero organizations
3. **Credential cleanup:** Periodically remove `xero_credentials` that have no associated companies
