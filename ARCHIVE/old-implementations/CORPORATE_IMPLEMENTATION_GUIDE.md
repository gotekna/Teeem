# Corporate Entity Management - Implementation Guide

## Overview

A complete full-stack corporate entity management system to replace Excel-based tracking of companies, assets, compliance, and Xero integrations.

---

## Getting Started

### 1. Run Database Migrations

```bash
cd backend
./bin/rails db:migrate
```

This will create all 12 tables needed for the corporate management system.

### 2. Start the Application

**Backend:**
```bash
cd backend
./bin/rails server
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### 3. Access the Corporate Dashboard

Navigate to: `http://localhost:5173/corporate`

---

## Feature Guide

### 📊 Corporate Dashboard (`/corporate`)

**What it shows:**
- Total Companies
- Active Companies
- Total Assets
- Compliance Due (30 days)
- Insurance Expiring

**Quick Actions:**
- Add Company
- Add Asset
- View Directors
- Xero Integration

**Upcoming Compliance Widget:**
- Shows items due in next 30 days
- Click to go to company compliance tab

---

### 🏢 Companies Management (`/corporate/companies`)

**List View Features:**
- Search by company name, ACN, ABN
- Filter by group (Tekna, Team Harder, Promise, Charity, Other)
- Filter by status (Active, Struck Off, In Liquidation, Dormant)
- Shows director count and Xero connection status

**Adding a Company:**
1. Click "Add Company"
2. Fill in required fields:
   - Company Name *
   - Company Group *
   - ACN (validated as 9 digits)
   - ABN (validated as 11 digits)
   - TFN (encrypted)
3. Optional fields:
   - ASIC credentials (encrypted)
   - Addresses
   - Trust information
   - GST status
   - ASIC review dates

**Company Detail Tabs:**

1. **Overview** - Basic information, addresses, trust details
2. **Directors** - (To be implemented - add/remove directors)
3. **Financial** - Bank account management
   - Add multiple bank accounts
   - Set primary account
   - BSB validation (XXX-XXX format)
   - Track account type
4. **Assets** - List of company-owned assets
   - Click to navigate to asset detail
5. **Compliance** - Track compliance items
   - ASIC reviews
   - Tax returns
   - Financial statements
   - AGMs
   - Automatic reminders at 90/60/30/7 days
   - Overdue indicator
6. **Documents** - Upload and manage documents
   - Constitution
   - AGM minutes
   - Director resolutions
   - Share certificates
   - Tax returns
   - ASIC extracts
7. **Activity** - Full audit trail
   - All changes tracked
   - User attribution
   - Before/after values

---

### 👥 Directors Registry (`/corporate/directors`)

**Features:**
- Searchable directory of all directors
- Shows directorships across companies
- TFN tracking
- Beneficial owner indication
- Click to view contact detail

---

### 🚗 Assets Management (`/corporate/assets`)

**List View Features:**
- Search assets
- Filter by type (Vehicle, Equipment, Property, Other)
- Filter by status (Active, Disposed, Sold, Written Off)
- "Needs Attention" toggle for insurance/service alerts

**Adding an Asset:**
1. Click "Add Asset"
2. Select company owner *
3. Enter description *
4. Select asset type

**For Vehicles:**
- Make, Model, Year
- VIN
- Registration number

**Financial Information:**
- Purchase date & price
- Current value
- Depreciation rate
- Disposal date & value

**Asset Detail Tabs:**

1. **Overview** - Asset details and financial info
2. **Insurance** - Manage insurance policies
   - Policy number, company, type
   - Start & expiry dates
   - Premium amount & frequency
   - Coverage amount
   - 30-day expiry warnings
   - Expired policy alerts
3. **Service History** - Track maintenance
   - Service type (Regular, Oil Change, Tire Rotation, etc.)
   - Date, provider, cost
   - Odometer readings
   - Next service scheduling
4. **Activity** - (To be implemented)

---

### 🔗 Xero Integration (`/corporate/xero`)

**Features:**
- OAuth2 connection per company
- Connect/disconnect companies
- Manual sync trigger
- Token expiry management
- Chart of accounts sync

**Connecting to Xero:**
1. Go to `/corporate/xero`
2. Click "Connect to Xero" on unconnected company
3. Authorize in Xero OAuth flow
4. Returns to dashboard with connection established

**Managing Connections:**
- **Sync** - Manually trigger chart of accounts sync
- **Reconnect** - Refresh expired tokens
- **Disconnect** - Remove connection and synced data

---

## API Endpoints

### Companies
- `GET /api/v1/companies` - List companies (with filters)
- `POST /api/v1/companies` - Create company
- `GET /api/v1/companies/:id` - Get company detail
- `PUT /api/v1/companies/:id` - Update company
- `DELETE /api/v1/companies/:id` - Delete company
- `GET /api/v1/companies/:id/directors` - Get company directors
- `POST /api/v1/companies/:id/add_director` - Add director
- `DELETE /api/v1/companies/:id/directors/:director_id` - Remove director
- `GET /api/v1/companies/:id/bank_accounts` - Get bank accounts
- `GET /api/v1/companies/:id/compliance_items` - Get compliance items
- `GET /api/v1/companies/:id/documents` - Get documents
- `GET /api/v1/companies/:id/activities` - Get activity log

### Assets
- `GET /api/v1/assets` - List assets (with filters)
- `POST /api/v1/assets` - Create asset
- `GET /api/v1/assets/:id` - Get asset detail
- `PUT /api/v1/assets/:id` - Update asset
- `DELETE /api/v1/assets/:id` - Delete asset
- `GET /api/v1/assets/:id/insurance` - Get insurance policies
- `POST /api/v1/assets/:id/add_insurance` - Add insurance
- `GET /api/v1/assets/:id/service_history` - Get service records
- `POST /api/v1/assets/:id/add_service` - Add service record

### Bank Accounts
- `GET /api/v1/bank_accounts` - List all bank accounts
- `POST /api/v1/bank_accounts` - Create bank account
- `GET /api/v1/bank_accounts/:id` - Get bank account
- `PUT /api/v1/bank_accounts/:id` - Update bank account
- `DELETE /api/v1/bank_accounts/:id` - Delete bank account

### Compliance
- `GET /api/v1/company_compliance_items` - List compliance items
- `POST /api/v1/company_compliance_items` - Create compliance item
- `PUT /api/v1/company_compliance_items/:id` - Update compliance item
- `DELETE /api/v1/company_compliance_items/:id` - Delete compliance item
- `POST /api/v1/company_compliance_items/:id/mark_complete` - Mark as complete

### Documents
- `GET /api/v1/company_documents` - List documents
- `POST /api/v1/company_documents` - Upload document
- `DELETE /api/v1/company_documents/:id` - Delete document

### Xero
- `GET /api/v1/company_xero_connections` - List connections
- `GET /api/v1/xero/auth_url` - Get OAuth URL
- `POST /api/v1/xero/callback` - OAuth callback
- `POST /api/v1/company_xero_connections/:id/sync` - Manual sync
- `DELETE /api/v1/company_xero_connections/:id` - Disconnect

---

## Background Jobs

### Compliance Reminders
**Job:** `ComplianceReminderJob`
**Service:** `ComplianceReminderService`
**Schedule:** Daily

Sends email reminders at:
- 90 days before due
- 60 days before due
- 30 days before due
- 7 days before due

### Asset Reminders
**Job:** `AssetReminderJob`
**Service:** `AssetReminderService`
**Schedule:** Daily

Alerts for:
- Insurance expiring in 30 days
- Service due soon

**To schedule jobs:**
```ruby
# In rails console or config/schedule.rb (if using whenever gem)
ComplianceReminderJob.perform_later
AssetReminderJob.perform_later
```

---

## Data Import

### Excel Import
**Service:** `CompanyImportService`
**File:** `Corporate_File.xlsx`

```ruby
# In rails console
service = CompanyImportService.new('path/to/Corporate_File.xlsx')
result = service.import

puts result[:message]
puts "Companies: #{result[:companies_count]}"
puts "Directors: #{result[:directors_count]}"
puts "Bank Accounts: #{result[:bank_accounts_count]}"
```

**Expected Sheets:**
- Companies
- Directors
- Bank Accounts
- Shareholdings

---

## Security Features

### Encrypted Fields
The following fields are encrypted at rest using Rails 7+ encryption:

**Company Model:**
- `tfn` (Tax File Number) - deterministic encryption
- `asic_password` - non-deterministic
- `asic_recovery_answer` - non-deterministic

**Encryption Config:**
Configured in `config/credentials.yml.enc` with master key

### Validation
- ACN: 9 digits
- ABN: 11 digits
- TFN: 9 digits
- BSB: XXX-XXX format
- Required fields enforced

---

## File Structure

```
backend/
├── app/
│   ├── controllers/api/v1/
│   │   ├── companies_controller.rb
│   │   ├── assets_controller.rb
│   │   ├── bank_accounts_controller.rb
│   │   ├── company_compliance_items_controller.rb
│   │   ├── company_documents_controller.rb
│   │   └── company_xero_connections_controller.rb
│   ├── models/
│   │   ├── company.rb
│   │   ├── company_director.rb
│   │   ├── bank_account.rb
│   │   ├── asset.rb
│   │   ├── asset_insurance.rb
│   │   ├── asset_service_history.rb
│   │   ├── company_compliance_item.rb
│   │   ├── company_document.rb
│   │   ├── company_activity.rb
│   │   ├── company_xero_connection.rb
│   │   └── company_xero_account.rb
│   ├── services/
│   │   ├── xero_auth_service.rb
│   │   ├── xero_sync_service.rb
│   │   ├── compliance_reminder_service.rb
│   │   ├── asset_reminder_service.rb
│   │   └── company_import_service.rb
│   └── jobs/
│       ├── compliance_reminder_job.rb
│       └── asset_reminder_job.rb
└── db/migrate/
    └── [12 migration files]

frontend/
├── src/
│   ├── pages/
│   │   ├── CorporateDashboardPage.jsx
│   │   ├── CompaniesPage.jsx
│   │   ├── CompanyDetailPage.jsx
│   │   ├── DirectorsRegistryPage.jsx
│   │   ├── AssetsPage.jsx
│   │   ├── AssetDetailPage.jsx
│   │   └── XeroDashboardPage.jsx
│   └── components/corporate/
│       ├── CompanyForm.jsx
│       ├── CompanyFinancialTab.jsx
│       ├── CompanyAssetsTab.jsx
│       ├── CompanyComplianceTab.jsx
│       ├── CompanyDocumentsTab.jsx
│       ├── CompanyActivityTab.jsx
│       ├── AssetForm.jsx
│       ├── AssetInsuranceTab.jsx
│       └── AssetServiceHistoryTab.jsx
```

---

## Testing

### Backend Testing
```bash
cd backend
bundle exec rspec spec/models/company_spec.rb
bundle exec rspec spec/controllers/api/v1/companies_controller_spec.rb
```

### Frontend Testing
```bash
cd frontend
npm test
```

### Manual Testing Checklist
- [ ] Create company
- [ ] Add bank account
- [ ] Add compliance item
- [ ] Upload document
- [ ] Create asset
- [ ] Add insurance policy
- [ ] Add service record
- [ ] Connect to Xero
- [ ] Trigger sync
- [ ] Test reminders
- [ ] Verify activity logging

---

## Troubleshooting

### Migrations Won't Run
**Issue:** Bundler version mismatch
**Solution:**
```bash
gem install bundler:2.7.2
bundle install
```

### Routes Not Found
**Issue:** Frontend routes not recognized
**Solution:** Check [App.jsx](frontend/src/App.jsx#L165-L177) has corporate routes

### Components Not Rendering
**Issue:** Import paths incorrect
**Solution:** Verify component imports use `../components/corporate/`

### API 404 Errors
**Issue:** Backend routes not configured
**Solution:** Check [config/routes.rb](backend/config/routes.rb#L516-L571)

### Encrypted Fields Not Working
**Issue:** Master key not configured
**Solution:** Ensure `config/master.key` exists or set `RAILS_MASTER_KEY` environment variable

---

## Future Enhancements

### Phase 2 (Optional)
- [ ] Directors tab implementation (add/remove directors)
- [ ] Asset activity tab
- [ ] Email notifications for reminders
- [ ] Excel export functionality
- [ ] Bulk operations (import multiple companies)
- [ ] Advanced search with filters
- [ ] Financial reporting dashboard

### Phase 3 (Advanced)
- [ ] Xero invoice sync
- [ ] Bank account reconciliation
- [ ] Depreciation schedule automation
- [ ] Document OCR for auto-categorization
- [ ] Mobile app
- [ ] API webhooks

---

## Support

For issues or questions:
1. Check this guide
2. Review code comments
3. Check Rails logs: `tail -f backend/log/development.log`
4. Check browser console for frontend errors

---

## Credits

**Implementation Date:** November 2025
**Framework:** Rails 8.0.4 + React 19.1.1
**Database:** PostgreSQL
**Authentication:** JWT
**File Storage:** Active Storage / OneDrive

Built following existing Trapid patterns and conventions.
