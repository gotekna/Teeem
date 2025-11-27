# Contact Relationships & Multi-Xero Plan

## Core Principle: TEEEM is Single Source of Truth

**TEEEM owns all contact data. Xero only receives the minimum needed for accounting.**

- Import: Pull ALL data from Xero into TEEEM (full detail)
- Export: Push only accounting-essential fields TO Xero (minimal)
- TEEEM can store extra data that Xero doesn't need (ratings, internal notes, relationships)

---

## Current State Analysis

### What Exists
1. **ContactRelationship model** - Fully implemented with:
   - Bidirectional relationships (auto-creates reverse)
   - Multiple relationship types: employee_of, director_of, shareholder_of, trustee_of, etc.
   - Ownership percentages, start/end dates, active status
   - **But: 0 records in database - not being used**

2. **Contact model** has:
   - `primary_company_id` - Single company link (used by Xero import)
   - `xero_id` - Single Xero contact ID (no tenant reference)
   - `sync_with_xero` - Boolean flag
   - Methods like `all_companies`, `additional_companies`, `employers` - all use ContactRelationship

3. **Xero sync** currently:
   - Creates person contacts with `primary_company_id` pointing to company
   - Sets `sync_with_xero: false` for person contacts
   - ONE-WAY sync: Xero → TEEEM only
   - Single `xero_id` per contact (no multi-tenant support)

4. **ContactPerson model** (legacy):
   - Nested data on Contact (company has contact_persons)
   - Used by Xero import for backwards compatibility
   - Duplicates the person data that's also in Contact table

### Problems Identified
1. **No multi-Xero support** - Contacts have single `xero_id`, no tenant reference
2. **ContactRelationship not used** - Despite full implementation
3. **Redundant data** - ContactPerson duplicates Contact records
4. **No UI for relationships** - Can't manage person↔company links in frontend
5. **Search doesn't show relationships** - Searching "Rachel Harder" doesn't show her companies

---

## Proposed Architecture

### Option A: Enhance Current Model (Recommended)
Keep Contact as the central entity, enhance with multi-Xero support.

```
Contact (person or company)
├── xero_links (NEW) - Multiple Xero tenant connections
│   ├── xero_tenant_id
│   ├── xero_contact_id
│   └── sync_enabled
├── contact_relationships - Links to other contacts
│   ├── employee_of → Company contacts
│   ├── director_of → Company contacts
│   └── etc.
└── primary_company_id - Quick reference to main employer (optional)
```

**Pros:**
- Uses existing ContactRelationship infrastructure
- Minimal schema changes
- Supports multiple Xero orgs per contact

**Cons:**
- Need to migrate existing xero_id to new table
- Need to populate ContactRelationship from primary_company_id

### Option B: Xero Contacts as Separate Entities
Keep Xero contacts separate from TEEEM contacts entirely.

```
XeroContact (synced from Xero)
├── xero_tenant_id
├── xero_contact_id
└── linked_teeem_contacts → Contact (many-to-many)

Contact (TEEEM-only)
├── No xero_id
└── contact_relationships
```

**Pros:**
- Clean separation of Xero vs TEEEM data
- No sync conflicts

**Cons:**
- Major refactoring
- Duplicate data management
- Complex UI for linking

---

## Recommended Plan: Option A Enhanced

### Phase 1: Multi-Xero Support (Schema)
Add `contact_xero_links` table:

```ruby
create_table :contact_xero_links do |t|
  t.references :contact, null: false, foreign_key: true
  t.string :xero_tenant_id, null: false
  t.string :xero_contact_id, null: false
  t.boolean :sync_enabled, default: true
  t.datetime :last_synced_at
  t.string :sync_error
  t.timestamps

  t.index [:contact_id, :xero_tenant_id], unique: true
  t.index [:xero_tenant_id, :xero_contact_id], unique: true
end
```

Migrate existing data:
```ruby
Contact.where.not(xero_id: nil).find_each do |contact|
  ContactXeroLink.create!(
    contact: contact,
    xero_tenant_id: XeroCredential.current.tenant_id,
    xero_contact_id: contact.xero_id,
    sync_enabled: contact.sync_with_xero,
    last_synced_at: contact.last_synced_at
  )
end
```

### Phase 2: Populate ContactRelationships
Migrate `primary_company_id` to ContactRelationship:

```ruby
Contact.where.not(primary_company_id: nil).find_each do |person|
  ContactRelationship.find_or_create_by!(
    source_contact: person,
    related_contact_id: person.primary_company_id,
    relationship_type: 'employee_of'
  )
end
```

### Phase 3: UI for Relationship Management
Add to ContactDetailPage:
- "Companies & Roles" section showing all linked companies
- Add relationship button with type selector
- Remove relationship button
- Visual distinction: employee vs director vs shareholder

### Phase 4: Search Enhancement
When searching "Rachel Harder":
1. Find Contact by name
2. Include all related contacts in results with relationship context
3. Show: "Rachel Harder → Director of Company A, Employee of Company B"

### Phase 5: Xero Sync Update
Update XeroContactSyncService to:
1. Use `contact_xero_links` instead of `xero_id` on Contact
2. Support multiple tenants
3. Create ContactRelationship instead of just `primary_company_id`

---

## Field Mapping: TEEEM ↔ Xero

### Import FROM Xero (Full - pull everything)

| Xero Field | TEEEM Field | Notes |
|------------|-------------|-------|
| ContactID | xero_contact_id (in contact_xero_links) | Unique ID per tenant |
| Name | full_name | Required field |
| FirstName | first_name | For person contacts |
| LastName | last_name | For person contacts |
| EmailAddress | email | |
| Phones[].PhoneNumber | mobile_phone, office_phone, fax_phone | By PhoneType |
| Addresses[] | address, contact_addresses | Street/postal |
| TaxNumber | tax_number | ABN/ACN |
| BankAccountDetails | bank_bsb, bank_account_number, bank_account_name | Parsed |
| IsCustomer | contact_types[] includes 'customer' | |
| IsSupplier | contact_types[] includes 'supplier' | |
| ContactStatus | xero_contact_status | ACTIVE/ARCHIVED |
| Balances.AccountsReceivable | accounts_receivable_outstanding, _overdue | |
| Balances.AccountsPayable | accounts_payable_outstanding, _overdue | |
| PaymentTerms | bill_due_day, bill_due_type, sales_due_day, sales_due_type | |
| ContactPersons[] | Creates linked Contact records | Via relationships |
| DefaultCurrency | (not stored - future) | |
| Website | website | |
| Discount | default_discount | |

### Export TO Xero (Accounting essentials)

| TEEEM Field | Xero Field | Required? | Notes |
|-------------|------------|-----------|-------|
| full_name | Name | **YES** | Only required field |
| first_name | FirstName | No | For person contacts |
| last_name | LastName | No | For person contacts |
| email | EmailAddress | **YES** | Essential for invoices/bills |
| tax_number | TaxNumber | **YES** | ABN - required for tax compliance |
| bank_bsb | BankAccountDetails (BSB part) | **YES** | For supplier payments |
| bank_account_number | BankAccountDetails (Account part) | **YES** | For supplier payments |
| bank_account_name | BankAccountDetails (Name part) | **YES** | For supplier payments |
| bill_due_day | PaymentTerms.Bills.Day | **YES** | Payment terms |
| bill_due_type | PaymentTerms.Bills.Type | **YES** | DAYSAFTERBILLDATE, etc. |
| sales_due_day | PaymentTerms.Sales.Day | **YES** | For customer invoices |
| sales_due_type | PaymentTerms.Sales.Type | **YES** | Payment terms |
| mobile_phone | Phones[MOBILE] | No | Useful for contact |
| office_phone | Phones[DEFAULT] | No | |
| address | Addresses[STREET] | No | For invoicing |

**NOT exported to Xero (TEEEM internal only):**
- ratings, teeem_rating
- notes, internal notes
- contact_relationships
- portal_user data
- response_rate, avg_response_time
- lgas, contact_region
- Jobs, constructions
- supplier_code (TEEEM's code, Xero has its own)

---

## Sync Rules

### Conflict Resolution: Manual Review
When TEEEM and Xero have different values for the same field:
1. Flag the field as "conflict"
2. Show both values to user
3. User chooses which to keep
4. Apply choice to both systems

### Delete Rules
- **Can't delete if linked to multiple Xero orgs** - Must unlink from other orgs first
- **Soft delete preferred** - Mark as ARCHIVED in Xero, is_active=false in TEEEM
- **Hard delete** - Only when contact has no invoices/bills in Xero

### Rate Limiting
- Xero allows ~60 calls/minute
- Already implemented: 1.2s sleep between calls
- Already implemented: Retry with exponential backoff on 429
- New: Queue system for batch syncs

### Sync Timing
- **On save**: Queue sync job (debounced)
- **Batch**: Nightly full reconciliation
- **Manual**: "Sync Now" button per contact

---

## Decisions Made

1. **Keep primary_company_id?** → **YES, KEEP BOTH**
   - Keep `primary_company_id` as quick reference to main employer
   - Use `ContactRelationship` for full relationship graph
   - Xero import sets both: primary_company_id + creates employee_of relationship

2. **Multiple Xero orgs?** → **YES**
   - A contact can exist in multiple Xero orgs
   - Each link has separate sync settings
   - Use `contact_xero_links` table

3. **Search behavior?** → **SHOW PERSON + RELATIONSHIPS**
   - When searching "Rachel Harder", show her with relationships listed
   - Don't clutter results with separate company entries
   - UI shows: "Rachel Harder → Director of X, Employee of Y"

4. **Remove ContactPerson table?** → **KEEP FOR NOW**
   - Currently stores same data as Contact records
   - Keep for backwards compatibility
   - Deprecate later after stable migration

---

## Implementation Order

1. **Create contact_xero_links migration** - Add new table
2. **Data migration** - Move existing xero_id data to new table
3. **Populate ContactRelationships** - From primary_company_id
4. **Update XeroContactSyncService** - Use new tables
5. **Add UI components** - Relationship management on ContactDetailPage
6. **Enhance search** - Include relationships in results
7. **Testing** - Full sync cycle with multiple Xero orgs

---

## Example: URBN Town Planning After Migration

```
URBN Town Planning Pty Ltd (Contact #1347)
├── entity_type: 'company'
├── contact_xero_links:
│   └── {tenant: 'org-a', xero_id: 'abc123', sync: true}
├── incoming_relationships:
│   ├── Michael Lyell → employee_of
│   └── Jessie Lyell → employee_of
└── employees: [Michael Lyell, Jessie Lyell]

Michael Lyell (Contact #2149)
├── entity_type: 'person'
├── contact_xero_links: [] (not synced to Xero directly)
├── outgoing_relationships:
│   └── URBN Town Planning → employee_of
└── employers: [URBN Town Planning]

Rachel Harder (Contact #1319)
├── entity_type: 'person'
├── outgoing_relationships:
│   ├── Company A → director_of
│   ├── Company B → employee_of
│   └── Company C → shareholder_of (ownership_percentage: 25)
└── all_companies: [Company A, Company B, Company C]
```

---

## Search Result Example

Query: "rachel harder"

```
Results:
1. Rachel Harder (Person)
   └── Director of: Company A
   └── Employee of: Company B
   └── Shareholder (25%) of: Company C
```

---

## Decisions Made (Detailed)

### 1. Validation Rules ✅
- **ABN**: Full validation via ABR (Australian Business Register) API - free government service
  - Format check (11 digits)
  - API lookup to verify valid ABN
  - Only valid ABNs synced to Xero
- **Email**: Format check only (regex validation)
- **Bank Details**: Optional but if provided, must be valid
  - BSB: exactly 6 digits
  - Account number: 5-9 digits
- **Failed Validation**: Shows on health/checks page for user to fix

### 2. UI/UX for Sync Status ✅
- **Sync Status Icons**: Different badges per accounting system
  - Xero: Blue badge
  - QuickBooks (future): Green badge
  - MYOB (future): Purple badge
- **Conflicts**: Show on existing dedicated checks page
- **Sync Now button**: On contact detail page

### 3. Multi-Xero Connection Flow ✅
- **Simple Add Button** approach
- "Connect Another Xero" button in Settings
- OAuth flow, user selects org
- All contacts from new org imported
- User manually links duplicates later

### 4. Contact Creation ✅
- **Prompt on Save** approach
- Modal asks "Also create in Xero?" with checkboxes for each connected org
- User permission controls if they see this prompt
- If permission not granted → saves locally, shows on health page as "Not synced"
- Health page lets them fix later

### 5. Relationship Types ✅
- **Keep current list**, add later as needed:
  - employee_of, director_of, shareholder_of, trustee_of, beneficiary_of, partner_of, related_to
- No need to over-engineer upfront

### 6. Import from Xero ✅
- **Webhook (Real-time)** with staged approach:
  1. Initial Import - Pull all contacts from Xero
  2. Validate - Run through validation (ABN via ABR, email format, bank details)
  3. Fix Issues - User resolves validation errors on checks page
  4. Enable Two-Way Sync - Once clean, turn on real-time webhooks

### 7. Conflict Resolution ✅
- **Last Write Wins** - Most recent edit takes priority based on timestamps
- Simple and practical

### 8. Delete Behavior ✅
- **Smart Cascade Delete with validation**:
- Delete from TEEEM:
  1. Check if contact has jobs, invoices, quotes attached
  2. If yes → Block delete, show error
  3. If no → Delete in TEEEM, then delete in Xero
  4. If Xero rejects → Rename in Xero to "Deleted in TEEEM - [Original Name]"
- Delete from Xero:
  1. Webhook notifies TEEEM
  2. Same validation check
  3. If can delete → Delete in TEEEM
  4. If cannot → Keep in TEEEM, flag on health page

---

## Sync Configuration Page (NEW)

A dedicated page in Contacts showing exactly what syncs where, with controls.

### Features

**1. Field Mapping Table**
Shows visual mapping between Xero and TEEEM fields:

| Xero Field | TEEEM Column | Direction | Action |
|------------|--------------|-----------|--------|
| Contact Name | name | ↔ Two-way | |
| Primary Person | contact_persons | → Import | ☑ Delete from Xero after import |
| Email | email | ↔ Two-way | |
| Phone | phone | ↔ Two-way | |
| ABN/TaxNumber | abn | ↔ Two-way | |
| Bank Account | bank_details | ← Export only | |
| Payment Terms | bill_due_day, sales_due_day | ↔ Two-way | |

**2. Per-Xero-Org Settings**
- Tabs for each connected Xero organization
- Can have different settings per org
- Show org name, connection status, last sync time

**3. Cleanup Options (Checkboxes)**
- ☑ Delete Primary Person from Xero after importing (keeps Xero tidy)
- ☑ Archive duplicates in Xero
- ☑ Standardize ABN format in Xero (add spaces: XX XXX XXX XXX)

**4. Preview Mode**
- "Preview Sync" button shows what WILL happen before it does
- List of pending changes:
  - "Will import 5 primary persons"
  - "Will update 12 ABNs"
  - "Will create 3 new contacts in Xero"
- User confirms or cancels

**5. Sync History**
- Log of recent sync operations
- What changed, when, which direction
- Errors and warnings

### Location
- New page: `/contacts/sync-config`
- Link from Contacts page header
- Also accessible from Settings

---

## Full Todo List (DETAILED)

### Phase 1: Database Schema
- [ ] 1.1 Create `contact_xero_links` migration
  - contact_id (foreign key)
  - xero_tenant_id (string, not null)
  - xero_tenant_name (string, for display)
  - xero_contact_id (string, not null)
  - sync_enabled (boolean, default true)
  - sync_direction (enum: import_only, export_only, bidirectional)
  - last_synced_at (datetime)
  - last_modified_at (datetime, for conflict detection)
  - sync_error (string)
  - conflict_fields (jsonb, for manual review)
  - metadata (jsonb)
- [ ] 1.2 Create `ContactXeroLink` model
- [ ] 1.3 Add associations to Contact model
- [ ] 1.4 Create `sync_configurations` table for per-org settings
  - xero_tenant_id
  - field_mappings (jsonb)
  - cleanup_options (jsonb: delete_primary_person, archive_duplicates, standardize_abn)
- [ ] 1.5 Run migration locally and test

### Phase 2: Data Migration
- [ ] 2.1 Create rake task to migrate existing xero_id to contact_xero_links
- [ ] 2.2 Create rake task to populate ContactRelationship from primary_company_id
- [ ] 2.3 Test migration on staging
- [ ] 2.4 Verify data integrity after migration
- [ ] 2.5 Keep old columns (xero_id, sync_with_xero) for rollback safety

### Phase 3: ABR Integration (ABN Validation)
- [ ] 3.1 Create AbrApiService for ABN lookups
  - ABR API endpoint: https://abr.business.gov.au/abrxmlsearch/
  - Free government service, GUID-based authentication
  - Returns: ABN validity, entity name, entity type, GST status
- [ ] 3.2 Add ABN validation to Contact model
  - Format check: 11 digits
  - API lookup on save (optional, queued)
- [ ] 3.3 Store ABR response data
  - abn_valid (boolean)
  - abn_entity_name (string)
  - abn_entity_type (string)
  - abn_gst_registered (boolean)
  - abn_verified_at (datetime)
- [ ] 3.4 Add ABN validation to health checks page
  - List contacts with invalid/unverified ABNs
  - "Verify ABN" button

### Phase 4: Backend - Xero Sync Service
- [ ] 4.1 Update XeroContactSyncService to use contact_xero_links
- [ ] 4.2 Add support for multiple tenants
- [ ] 4.3 Implement last-write-wins conflict resolution
  - Compare last_modified_at timestamps
  - More recent edit wins
- [ ] 4.4 Implement two-way sync (import AND export)
- [ ] 4.5 Create ContactRelationship when syncing person → company
- [ ] 4.6 Add "push to all linked Xero orgs" logic
- [ ] 4.7 Implement delete protection
  - Check for linked jobs, invoices, quotes
  - Block delete if has linked data
  - Rename in Xero if Xero rejects: "Deleted in TEEEM - [Name]"
- [ ] 4.8 Add queue/job system for rate-limited batch syncs
- [ ] 4.9 Add "Sync Now" endpoint for manual trigger

### Phase 5: Backend - Xero Webhooks
- [ ] 5.1 Register webhook endpoint with Xero
  - POST /api/v1/xero/webhooks
- [ ] 5.2 Implement webhook signature validation
- [ ] 5.3 Handle contact.created webhook
- [ ] 5.4 Handle contact.updated webhook
- [ ] 5.5 Handle contact.deleted webhook
  - Check TEEEM validation rules before deleting
  - Flag on health page if can't delete
- [ ] 5.6 Add webhook event logging for debugging

### Phase 6: Backend - API Endpoints
- [ ] 6.1 GET /contacts/:id/xero_links - list Xero connections
- [ ] 6.2 POST /contacts/:id/xero_links - add Xero connection
- [ ] 6.3 DELETE /contacts/:id/xero_links/:id - remove Xero connection
- [ ] 6.4 POST /contacts/:id/sync - manual sync trigger
- [ ] 6.5 GET /contacts/:id/sync_conflicts - get conflicts for review
- [ ] 6.6 POST /contacts/:id/resolve_conflict - resolve a conflict
- [ ] 6.7 Update contacts search to include relationships in response
- [ ] 6.8 GET /sync_configurations/:tenant_id - get sync config
- [ ] 6.9 PUT /sync_configurations/:tenant_id - update sync config
- [ ] 6.10 POST /sync/preview - preview what sync will do

### Phase 7: Backend - Relationship API
- [ ] 7.1 GET /contacts/:id/relationships - list all relationships
- [ ] 7.2 POST /contacts/:id/relationships - add relationship
- [ ] 7.3 DELETE /contacts/:id/relationships/:id - remove relationship
- [ ] 7.4 Update contact serializer to include relationships

### Phase 8: Frontend - Sync Configuration Page
- [ ] 8.1 Create SyncConfigPage component at /contacts/sync-config
- [ ] 8.2 Field mapping table with direction indicators (→ ← ↔)
- [ ] 8.3 Per-Xero-org tabs
- [ ] 8.4 Cleanup options checkboxes
  - Delete Primary Person from Xero after import
  - Archive duplicates in Xero
  - Standardize ABN format
- [ ] 8.5 Preview Sync button
  - Shows list of pending changes
  - Confirm/cancel before executing
- [ ] 8.6 Sync history log
- [ ] 8.7 Link from Contacts page header

### Phase 9: Frontend - Contact Detail Page
- [ ] 9.1 Add "Xero Connections" section
  - Show linked Xero orgs with colored badges (blue for Xero)
  - Add/remove Xero connection buttons
  - "Sync Now" button
  - Show last synced time
  - Show sync errors if any
- [ ] 9.2 Add "Companies & Roles" section (for person contacts)
  - List all companies with relationship type
  - Add relationship button
  - Remove relationship button
- [ ] 9.3 Add "People" section (for company contacts)
  - List all linked people with their roles
  - Add person button
- [ ] 9.4 Add "Create in Xero?" modal on save
  - Checkboxes for each connected org
  - Respect user permission setting
  - Skip if permission not granted → show on health page

### Phase 10: Frontend - Contacts List
- [ ] 10.1 Add Xero sync status badge (blue for Xero)
- [ ] 10.2 Add filter by "synced to Xero"
- [ ] 10.3 Update search to show relationships under contact name

### Phase 11: Frontend - Search Enhancement
- [ ] 11.1 Update global search to include relationships
- [ ] 11.2 Format: "Rachel Harder → Director of X, Employee of Y"
- [ ] 11.3 Clicking relationship goes to that company/person

### Phase 12: Health/Checks Page Integration
- [ ] 12.1 Add "Contacts not synced to Xero" check
- [ ] 12.2 Add "Contacts with invalid ABN" check
- [ ] 12.3 Add "Contacts with sync errors" check
- [ ] 12.4 Add "Contacts deleted in Xero but has TEEEM data" check
- [ ] 12.5 Add bulk actions: "Sync all", "Verify all ABNs"

### Phase 13: Testing
- [ ] 13.1 Unit tests for ContactXeroLink model
- [ ] 13.2 Unit tests for AbrApiService
- [ ] 13.3 Unit tests for updated XeroContactSyncService
- [ ] 13.4 Integration tests for sync flow
- [ ] 13.5 Integration tests for webhook handling
- [ ] 13.6 Test multi-tenant sync
- [ ] 13.7 Test delete protection
- [ ] 13.8 Manual testing on staging with real Xero data

### Phase 14: Deployment
- [ ] 14.1 Deploy migration to staging
- [ ] 14.2 Run data migration on staging
- [ ] 14.3 Register Xero webhook on staging
- [ ] 14.4 Full testing on staging
- [ ] 14.5 Deploy to production
- [ ] 14.6 Run data migration on production
- [ ] 14.7 Register Xero webhook on production
- [ ] 14.8 Monitor for issues

---

## NOT IN SCOPE (Future)

- Deprecating ContactPerson table
- Removing old xero_id column from contacts
- Multiple currencies
- Xero invoices/bills sync
- Xero payments sync
