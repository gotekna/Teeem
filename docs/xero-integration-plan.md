# Xero API Integration Plan for TEEEM

## Executive Summary

### What We're Building
A comprehensive two-way synchronization system between TEEEM and Xero that automatically keeps contacts, suppliers, purchase orders, and construction jobs in sync across both platforms. Using Xero's Tracking Categories, every purchase order is automatically tagged to its construction project, enabling full job cost tracking and profitability analysis. This integration eliminates manual data entry, reduces errors, and provides real-time visibility into both financial operations and job profitability.

### Business Value
- **Time Savings**: Eliminate 2-3 hours daily of manual data entry across 209+ suppliers
- **Error Reduction**: Remove duplicate entry errors and data inconsistencies
- **Real-time Visibility**: Instant updates on purchase order status and payment tracking
- **Job Cost Tracking**: Automatic allocation of all costs to specific construction projects
- **Profitability Analysis**: Real-time P&L reports per construction job
- **Compliance**: Automatic audit trail and accurate financial reporting
- **Budget Management**: Track spending against construction budgets in real-time
- **Scalability**: Foundation for future invoice and bill automation

### Timeline Estimate
**8 weeks total** (with simultaneous delivery of construction management features)
- Weeks 1-2: Foundation & Authentication
- Weeks 3-4: Contact Sync
- Weeks 5-6: Purchase Order Sync + Construction/Job Sync (simultaneous)
- Weeks 7-8: Polish, Webhooks & Optimization

## Feature Specifications

### Contact Sync (Two-Way Automatic)

#### Initial Bulk Sync Flow
1. **Discovery Phase**
   - Fetch all contacts from Xero (batched, 100 per page)
   - Fetch all suppliers and contacts from TEEEM
   - Build matching candidates using ABN and email

2. **Matching Strategy**
   - **Primary Match**: ABN (Australian Business Number) - exact match
   - **Secondary Match**: Email address - case-insensitive exact match
   - **Tertiary Match**: Company name - fuzzy match with 85% similarity threshold
   - **Manual Review**: Flagged for user review if multiple potential matches

3. **Conflict Resolution**
   - **Field-level conflicts**: Show side-by-side comparison
   - **User decides**: Keep TEEEM, Keep Xero, or Merge
   - **Bulk actions**: Apply same resolution to similar conflicts
   - **Audit log**: Track all decisions for compliance

4. **Sync Execution**
   - Create missing contacts in both systems
   - Update matched records based on conflict resolution
   - Map and store Xero Contact IDs in TEEEM database
   - Generate sync report with statistics

#### Ongoing Sync Mechanism
- **Real-time**: Webhooks for immediate updates (both directions)
- **Scheduled**: Hourly reconciliation job as fallback
- **Change detection**: Modified timestamp comparison
- **Retry logic**: Exponential backoff for failed syncs

#### Field Mappings
```
TEEEM Supplier → Xero Contact
- name → Name
- email → EmailAddress
- phone → Phones[0].PhoneNumber
- abn → TaxNumber
- address → Addresses[0]
- is_active → IsSupplier (true/false)
- supplier_code → AccountNumber

TEEEM Contact → Xero Contact Person
- first_name → FirstName
- last_name → LastName
- email → EmailAddress
- mobile_phone → Phones[MOBILE]
- office_phone → Phones[DEFAULT]
```

### Construction/Job Sync with Tracking Categories

#### Overview
Use Xero's **Tracking Categories** feature to enable comprehensive job cost tracking and profitability analysis for each construction project. This approach provides robust financial reporting without the complexity of the Xero Projects API.

#### What Tracking Categories WILL Enable
- **Full Job Cost Tracking**: All purchase orders automatically tagged to their construction/job
- **P&L Reports by Job**: Generate profit & loss statements for each construction project
- **Budget vs Actual Comparison**: Track spending against construction budgets
- **Automated Job Profitability Reports**: Real-time margin analysis per construction
- **Cost Allocation**: Allocate all expenses directly to specific jobs
- **Multi-dimensional Reporting**: Combine with other tracking categories for deeper insights
- **Historical Cost Analysis**: Track job costs over time with full audit trail

#### What Tracking Categories WON'T Provide
(Compared to Xero Projects API)
- **Time Tracking/Timesheets**: No built-in time entry functionality
- **Project Task Management**: No task breakdown or milestone tracking
- **Direct Project Invoicing**: Invoices won't automatically link to projects
- **Resource Planning**: No capacity or resource allocation features
- **Built-in WIP Reports**: Work-in-progress reporting requires custom reports

#### Recommendation
**Tracking Categories ARE sufficient** for TEEEM's construction management needs. They provide all essential financial tracking capabilities while maintaining simplicity and avoiding the overhead of the Projects API.

#### Job Naming Convention
Use construction address as the primary identifier for better readability and searchability in Xero:

**Format**: `{construction.title}`
- Example: "123 Main Street, Sydney"
- Example: "45 Collins Ave, Melbourne"

**Fallback Strategy**:
1. Primary: Use `construction.title` (which typically contains the address)
2. Secondary: If title is empty/invalid, use "Construction #{construction.id}"
3. Validation: Ensure name meets Xero requirements (max 100 chars, no special characters)

#### Implementation Details
```ruby
# app/services/xero_tracking_category_service.rb
class XeroTrackingCategoryService
  CATEGORY_NAME = "Construction Jobs"

  def setup_tracking_category
    # Create or get the Construction Jobs tracking category
    category = find_or_create_category(CATEGORY_NAME)
    store_category_id(category.tracking_category_id)
  end

  def sync_construction_as_option(construction)
    job_name = format_job_name(construction)

    # Create tracking option for this construction
    option = create_tracking_option(
      category_id: stored_category_id,
      name: job_name,
      status: construction.status == 'Active' ? 'ACTIVE' : 'ARCHIVED'
    )

    # Store the tracking option ID
    construction.update!(
      xero_tracking_option_id: option.tracking_option_id,
      xero_job_name: job_name
    )
  end

  private

  def format_job_name(construction)
    # Use address (title) as primary identifier
    if construction.title.present?
      # Truncate if needed, remove special chars
      construction.title.truncate(100).gsub(/[^\w\s,.-]/, '')
    else
      "Construction #{construction.id}"
    end
  end
end
```

#### Database Schema for Construction Tracking
```sql
-- Add Xero tracking fields to constructions table
ALTER TABLE constructions ADD COLUMN xero_tracking_option_id VARCHAR(255);
ALTER TABLE constructions ADD COLUMN xero_job_name VARCHAR(100);
ALTER TABLE constructions ADD COLUMN xero_sync_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE constructions ADD COLUMN xero_last_synced_at TIMESTAMP;
CREATE INDEX idx_constructions_xero_tracking ON constructions(xero_tracking_option_id);
```

#### Purchase Order Integration with Jobs
When creating/updating POs in Xero, automatically apply the construction's tracking category:

```ruby
# Enhanced PO sync to include job tracking
def sync_purchase_order_with_job(purchase_order)
  xero_po = {
    # ... existing PO fields ...

    # Add tracking category for job costing
    line_items: purchase_order.line_items.map do |item|
      {
        description: item.description,
        quantity: item.quantity,
        unit_amount: item.unit_price,
        account_code: item.account_code,
        # Apply construction tracking to each line item
        tracking: [
          {
            tracking_category_id: stored_category_id,
            tracking_option_id: purchase_order.construction.xero_tracking_option_id
          }
        ]
      }
    end
  }

  create_or_update_purchase_order(xero_po)
end
```

#### Sync Workflow
1. **Initial Setup**:
   - Create "Construction Jobs" tracking category in Xero
   - Sync all active constructions as tracking options
   - Store tracking IDs for future reference

2. **Ongoing Sync**:
   - New construction created → Create tracking option in Xero
   - Construction updated → Update tracking option name/status
   - Construction archived → Archive tracking option
   - PO created → Apply construction's tracking category

3. **Reporting Integration**:
   - Pull P&L by tracking category via API
   - Display job profitability in TEEEM dashboard
   - Export detailed cost reports per construction

### Purchase Order Sync (Two-Way)

#### Immediate Sync on Creation
1. **TEEEM → Xero** (on PO creation/update)
   - Validate supplier has Xero ID
   - Transform PO data to Xero format
   - Create/Update in Xero
   - Store Xero PO ID
   - Update status from Xero response

2. **Xero → TEEEM** (via webhook/polling)
   - Receive PO update notification
   - Fetch full PO details from Xero
   - Match to TEEEM PO via Xero ID
   - Update payment status and amounts
   - Trigger notifications for status changes

#### Field Mappings
```
TEEEM PurchaseOrder → Xero PurchaseOrder
- purchase_order_number → PurchaseOrderNumber
- supplier.xero_id → Contact.ContactID
- ordered_date → Date
- required_date → DeliveryDate
- status → Status (mapped values)
- sub_total → SubTotal
- tax → TotalTax
- total → Total
- line_items → LineItems (array with tracking)
- reference → Reference
- construction.title → DeliveryInstructions

Status Mapping:
- draft → DRAFT
- approved → AUTHORISED
- sent → AUTHORISED
- received → BILLED
- paid → BILLED (check AmountPaid)

Line Item Mapping:
- description → Description
- quantity → Quantity
- unit_price → UnitAmount
- tax_amount → TaxAmount
- account_code → AccountCode (from config)
- construction.xero_tracking_option_id → Tracking[0].TrackingOptionID

Job Tracking (applied to each line item):
- TrackingCategoryID → "Construction Jobs" category ID
- TrackingOptionID → construction.xero_tracking_option_id
```

#### Payment Status Updates
- Pull `AmountPaid` and `AmountDue` from Xero
- Update `xero_amount_paid` in TEEEM
- Calculate `xero_still_to_be_paid`
- Set `xero_complete` when fully paid
- Trigger notifications for payment milestones

## Technical Architecture

### Backend Services Structure

#### 1. XeroApiClient (app/services/xero_api_client.rb)
```ruby
# Low-level API wrapper
class XeroApiClient
  - authenticate()           # OAuth2 flow
  - refresh_token()          # Token refresh
  - get(endpoint, params)    # GET requests with pagination
  - post(endpoint, data)     # POST requests
  - put(endpoint, data)      # PUT requests
  - handle_rate_limits()     # 429 response handling
  - log_api_call()          # Track API usage
end
```

#### 2. XeroSyncService (app/services/xero_sync_service.rb)
```ruby
# High-level sync orchestration
class XeroSyncService
  - sync_all_contacts()           # Bulk contact sync
  - sync_contact(supplier)        # Single contact sync
  - sync_purchase_order(po)       # Single PO sync with job tracking
  - sync_construction(construction) # Single construction sync as tracking option
  - sync_all_constructions()      # Bulk construction sync
  - handle_webhook(payload)       # Process Xero webhooks
  - resolve_conflicts(conflicts)  # Conflict resolution
  - generate_sync_report()        # Sync statistics
  - get_job_profitability(construction_id) # Pull P&L for specific job
end
```

#### 3. XeroWebhookService (app/services/xero_webhook_service.rb)
```ruby
# Webhook processing
class XeroWebhookService
  - verify_signature(payload, signature)  # Security
  - process_event(event)                  # Route events
  - handle_contact_update(data)           # Contact changes
  - handle_purchase_order_update(data)    # PO changes
  - queue_retry(event)                    # Failed processing
end
```

### Database Schema Additions

#### 1. Add Xero fields to existing tables
```sql
-- Suppliers table
ALTER TABLE suppliers ADD COLUMN xero_contact_id VARCHAR(255);
ALTER TABLE suppliers ADD COLUMN xero_sync_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE suppliers ADD COLUMN xero_last_synced_at TIMESTAMP;
ALTER TABLE suppliers ADD COLUMN xero_updated_at TIMESTAMP;
CREATE INDEX idx_suppliers_xero_contact_id ON suppliers(xero_contact_id);

-- Contacts table
ALTER TABLE contacts ADD COLUMN xero_contact_person_id VARCHAR(255);
ALTER TABLE contacts ADD COLUMN xero_sync_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE contacts ADD COLUMN xero_last_synced_at TIMESTAMP;

-- Purchase Orders table
ALTER TABLE purchase_orders ADD COLUMN xero_purchase_order_id VARCHAR(255);
ALTER TABLE purchase_orders ADD COLUMN xero_sync_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE purchase_orders ADD COLUMN xero_last_synced_at TIMESTAMP;
ALTER TABLE purchase_orders ADD COLUMN xero_status VARCHAR(50);
CREATE INDEX idx_purchase_orders_xero_id ON purchase_orders(xero_purchase_order_id);
```

#### 2. New tables
```sql
-- OAuth credentials storage
CREATE TABLE xero_credentials (
  id BIGSERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  organization_name VARCHAR(255),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Sync activity log
CREATE TABLE xero_sync_logs (
  id BIGSERIAL PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL, -- 'contact', 'purchase_order'
  sync_direction VARCHAR(20) NOT NULL, -- 'to_xero', 'from_xero'
  record_type VARCHAR(50) NOT NULL,
  record_id BIGINT NOT NULL,
  xero_id VARCHAR(255),
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'skip'
  status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'conflict'
  error_message TEXT,
  changes_json JSONB,
  api_calls_used INTEGER DEFAULT 1,
  created_at TIMESTAMP NOT NULL
);

-- Conflict resolution tracking
CREATE TABLE xero_sync_conflicts (
  id BIGSERIAL PRIMARY KEY,
  record_type VARCHAR(50) NOT NULL,
  record_id BIGINT NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  teeem_value TEXT,
  xero_value TEXT,
  resolution VARCHAR(50), -- 'keep_teeem', 'keep_xero', 'merge'
  resolved_by_user_id BIGINT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL
);
```

### Background Jobs (Solid Queue)

#### Job Classes
```ruby
# app/jobs/xero_sync_all_job.rb
class XeroSyncAllJob < ApplicationJob
  queue_as :default
  retry_on XeroApiClient::RateLimitError, wait: :exponentially_longer

  def perform
    XeroSyncService.new.sync_all_contacts
    XeroSyncService.new.sync_all_purchase_orders
  end
end

# app/jobs/xero_sync_contact_job.rb
class XeroSyncContactJob < ApplicationJob
  queue_as :high_priority
  retry_on XeroApiClient::ApiError, attempts: 3

  def perform(supplier_id)
    supplier = Supplier.find(supplier_id)
    XeroSyncService.new.sync_contact(supplier)
  end
end

# app/jobs/xero_sync_purchase_order_job.rb
class XeroSyncPurchaseOrderJob < ApplicationJob
  queue_as :high_priority
  retry_on XeroApiClient::ApiError, attempts: 3

  def perform(purchase_order_id)
    po = PurchaseOrder.find(purchase_order_id)
    XeroSyncService.new.sync_purchase_order(po)
  end
end

# app/jobs/xero_sync_construction_job.rb
class XeroSyncConstructionJob < ApplicationJob
  queue_as :default
  retry_on XeroApiClient::ApiError, attempts: 3

  def perform(construction_id)
    construction = Construction.find(construction_id)
    XeroTrackingCategoryService.new.sync_construction_as_option(construction)
  end
end
```

### Error Handling & Retry Logic

#### Error Types & Strategies
1. **Rate Limit Errors (429)**
   - Extract retry-after header
   - Exponential backoff: 1min, 2min, 4min, 8min
   - Queue overflow to next hour

2. **Network/Timeout Errors**
   - Immediate retry with backoff
   - Max 3 attempts
   - Alert after 3 failures

3. **Validation Errors (400)**
   - Log detailed error
   - Mark record as sync_failed
   - Notify user for manual review

4. **Authentication Errors (401)**
   - Attempt token refresh
   - Re-authenticate if refresh fails
   - Pause all sync jobs until resolved

## API Usage & Optimization

### Detailed API Call Calculations

#### Initial Setup (One-time)
- Fetch all Xero contacts: ~3 calls (209 contacts / 100 per page)
- Create missing contacts: ~50 calls (estimated 25% new)
- Update existing contacts: ~150 calls (estimated 75% updates)
- Setup tracking category: 1 call
- Sync all constructions as tracking options: ~20 calls (assuming 20 active constructions)
- **Total**: ~220 calls

#### Daily Operations
- Contact updates: ~10 calls/day (5% change rate)
- New POs with job tracking: ~20 calls/day (10 POs × 2 calls each)
- PO status checks: ~40 calls/day (batch of 50)
- New construction sync: ~2 calls/day
- Construction updates: ~3 calls/day
- Webhook validations: ~20 calls/day
- **Total**: ~95 calls/day (<2% of 5,000 limit)

#### Peak Operations (Month-end)
- Bulk PO creation: ~100 calls
- Payment status updates: ~200 calls
- Report generation: ~50 calls
- **Total**: ~350 calls/day (<7% of limit)

### Batching Strategy
1. **Contact Sync**
   - Batch fetch: 100 contacts per call
   - Batch create: 50 contacts per call (summarize response)
   - Queue updates in 1-minute intervals

2. **Purchase Order Sync**
   - Batch status checks: 50 POs per call
   - Individual creation (complex line items)
   - Batch payment status updates

3. **Optimization Rules**
   - Combine related operations
   - Use modified_since timestamps
   - Cache frequently accessed data
   - Implement request coalescing

### Webhook Implementation
```ruby
# config/routes.rb
post '/webhooks/xero', to: 'xero_webhooks#receive'

# app/controllers/xero_webhooks_controller.rb
class XeroWebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token

  def receive
    if valid_signature?
      XeroWebhookService.new.process_event(webhook_params)
      head :ok
    else
      head :unauthorized
    end
  end

  private

  def valid_signature?
    signature = request.headers['X-Xero-Signature']
    XeroWebhookService.verify_signature(request.body.read, signature)
  end
end
```

### Rate Limit Monitoring
```ruby
# app/models/xero_api_usage.rb
class XeroApiUsage < ApplicationRecord
  def self.track_call(endpoint, response_headers)
    create!(
      endpoint: endpoint,
      daily_limit_remaining: response_headers['X-DailyLimit-Remaining'],
      minute_limit_remaining: response_headers['X-MinuteLimit-Remaining'],
      retry_after: response_headers['Retry-After'],
      called_at: Time.current
    )
  end

  def self.can_make_request?
    recent_count = where('called_at > ?', 1.minute.ago).count
    recent_count < 55 # Leave buffer
  end
end
```

## UI/UX Requirements

### 1. Settings Page - Xero Connection

#### OAuth Connection Flow
```jsx
// frontend/src/pages/Settings/XeroSettings.jsx
- "Connect to Xero" button (prominent CTA)
- Connection status indicator (Connected/Disconnected)
- Organization name display when connected
- Last sync timestamp
- "Disconnect" option with confirmation
- Sync frequency selector (Real-time/Hourly/Daily)
```

#### Visual Design
- Clean card layout matching existing settings pages
- Status badges (green=connected, gray=disconnected)
- Clear success/error messaging
- Loading states during OAuth flow

### 2. Initial Setup Wizard

#### Step 1: Review Matched Contacts
```jsx
// frontend/src/pages/XeroSetup/ContactMatching.jsx
- Table with columns: TEEEM Name | Xero Name | Match Type | Action
- Match confidence badges (Exact/High/Medium/Review)
- Bulk actions toolbar (Accept All/Review All)
- Filters (Matched/Unmatched/Conflicts)
- Pagination for large datasets
```

#### Step 2: Resolve Conflicts
```jsx
// frontend/src/pages/XeroSetup/ConflictResolution.jsx
- Side-by-side field comparison
- Radio buttons: Keep TEEEM / Keep Xero / Custom Merge
- "Apply to all similar" checkbox
- Progress indicator (X of Y conflicts resolved)
- Skip option for later review
```

#### Step 3: Configuration
```jsx
// frontend/src/pages/XeroSetup/Configuration.jsx
- Default account codes for PO line items
- Tax rate mapping
- Sync preferences (auto-sync new records)
- Notification preferences
- Test sync button
```

### 3. Sync Status Indicators

#### Inline Status Badges
```jsx
// Throughout existing tables
- Supplier table: Xero sync icon (✓ Synced, ⟳ Syncing, ⚠ Error)
- PO table: Payment status from Xero (Paid/Partial/Unpaid)
- Hover tooltips with last sync time
- Click for sync details modal
```

#### Sync Activity Dashboard
```jsx
// frontend/src/pages/XeroSync/Dashboard.jsx
- Real-time sync log (last 50 operations)
- Statistics cards (Total Synced, Pending, Errors)
- Retry failed syncs button
- Export sync report
- API usage gauge (X of 5,000 daily calls)
```

### 4. Conflict Resolution Interface

#### Notification Banner
```jsx
// frontend/src/components/XeroConflictBanner.jsx
- Persistent banner when conflicts exist
- "X conflicts need review" with link
- Dismissible but reappears on new conflicts
```

#### Conflict Resolution Modal
```jsx
// frontend/src/components/XeroConflictModal.jsx
- Field-by-field comparison table
- Current value highlighting
- Resolution options per field
- Save and apply button
- Audit trail of previous resolutions
```

### 5. Construction/Job Management Interface

#### Construction Sync Status
```jsx
// frontend/src/pages/Constructions/XeroSyncIndicator.jsx
- Sync status badge on each construction card
- "Synced to Xero" indicator with job name
- Last sync timestamp
- Manual sync button per construction
```

#### Job Profitability Dashboard
```jsx
// frontend/src/pages/Reports/JobProfitability.jsx
- Real-time P&L per construction from Xero
- Budget vs Actual comparison charts
- Cost breakdown by supplier/category
- Margin analysis with trend graphs
- Export reports to PDF/Excel
```

#### Construction Setup Wizard
```jsx
// frontend/src/pages/XeroSetup/ConstructionSync.jsx
- List of all constructions to sync
- Preview of job names that will be created
- Bulk sync all active constructions
- Option to exclude specific constructions
- Progress indicator during sync
```

### 6. Bulk Sync Dashboard

#### Manual Sync Controls
```jsx
// frontend/src/pages/XeroSync/BulkSync.jsx
- "Sync All Contacts" button with confirmation
- "Sync All Purchase Orders" button
- Progress bars with current item
- Pause/Resume controls
- Error summary with retry options
- Download sync report
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Establish Xero connection and basic infrastructure

#### Week 1
- [ ] Implement OAuth 2.0 connection flow
- [ ] Create XeroApiClient service with authentication
- [ ] Set up xero_credentials table and model
- [ ] Build Settings UI for Xero connection
- [ ] Implement token refresh mechanism
- [ ] Create basic error handling

#### Week 2
- [ ] Add Xero fields to existing models (migrations)
- [ ] Create xero_sync_logs table
- [ ] Implement rate limiting logic
- [ ] Build API usage tracking
- [ ] Create foundation for XeroSyncService
- [ ] Set up development testing with Xero sandbox

### Phase 2: Contact Sync (Week 3-4)
**Goal**: Full contact/supplier synchronization

#### Week 3
- [ ] Implement contact fetching from Xero
- [ ] Build matching algorithm (ABN/email)
- [ ] Create conflict detection logic
- [ ] Design and build contact matching UI
- [ ] Implement bulk sync for initial import
- [ ] Create sync status indicators

#### Week 4
- [ ] Build two-way sync for contact updates
- [ ] Implement conflict resolution UI
- [ ] Add background jobs for sync
- [ ] Create contact webhook handlers
- [ ] Build sync activity dashboard
- [ ] Comprehensive testing of sync scenarios

### Phase 3: Purchase Order & Construction Sync (Week 5-6)
**Goal**: Complete PO synchronization with job cost tracking

#### Week 5
- [ ] Setup tracking category for Construction Jobs
- [ ] Sync all active constructions as tracking options
- [ ] Implement PO creation sync to Xero with job tracking
- [ ] Build line item mapping with tracking categories
- [ ] Add immediate sync on PO creation
- [ ] Create PO status mapping
- [ ] Implement payment status pulling
- [ ] Update PO UI with Xero indicators

#### Week 6
- [ ] Build two-way PO sync with job tracking
- [ ] Implement construction creation/update sync
- [ ] Implement PO webhook handlers
- [ ] Add batch PO operations
- [ ] Create PO sync configuration UI
- [ ] Build payment tracking dashboard with job breakdown
- [ ] Create job profitability reports from Xero data
- [ ] Test complex PO scenarios with multiple constructions

### Phase 4: Polish & Optimization (Week 7-8)
**Goal**: Production-ready system

#### Week 7
- [ ] Implement full webhook system
- [ ] Optimize batch operations
- [ ] Add request coalescing
- [ ] Build comprehensive error handling
- [ ] Create retry mechanisms
- [ ] Performance testing and tuning

#### Week 8
- [ ] Complete UI polish and refinements
- [ ] Add comprehensive logging
- [ ] Create admin monitoring tools
- [ ] Build user documentation
- [ ] Production deployment preparation
- [ ] Final testing and bug fixes

## Testing Strategy

### Development Testing
1. **Unit Tests**
   - Service class methods
   - Model validations and callbacks
   - API client responses
   - Webhook signature verification

2. **Integration Tests**
   - OAuth flow completion
   - Full sync cycles
   - Webhook processing
   - Error handling paths

### Xero Sandbox Testing
1. **Setup**
   - Create sandbox organization
   - Populate with test data
   - Configure webhook endpoints

2. **Test Scenarios**
   - Initial bulk import (200+ contacts)
   - Concurrent updates from both systems
   - Conflict resolution workflows
   - Rate limit handling
   - Network failure recovery

3. **Data Validation**
   - Field mapping accuracy
   - Status synchronization
   - Payment tracking
   - Audit trail completeness

### Production Rollout Plan
1. **Soft Launch (Week 1)**
   - Enable for single test account
   - Monitor all operations closely
   - Validate data accuracy
   - Gather initial feedback

2. **Limited Release (Week 2)**
   - Enable for 10% of users
   - Monitor API usage patterns
   - Track error rates
   - Refine based on feedback

3. **Full Release (Week 3)**
   - Enable for all users
   - Provide migration support
   - Monitor system stability
   - Continuous optimization

## Future Enhancements (Not in Current Scope)

### 1. Client Invoicing (ACCREC)
- Create sales invoices in Xero
- Track payment status
- Automatic payment reconciliation
- Client statement generation
- **Estimated: 3-4 weeks additional**

### 2. Supplier Bills (ACCPAY)
- Convert POs to bills
- Match with supplier invoices
- Approval workflows
- Payment batch creation
- **Estimated: 2-3 weeks additional**

### 3. Progress Claims
- Percentage completion tracking
- Milestone-based invoicing
- Retention handling
- Variation management
- **Estimated: 4-5 weeks additional**

### 4. Advanced Project Management (Xero Projects API)
**Note**: Current tracking categories provide sufficient job costing. This would add:
- Time tracking and timesheets per project
- Task breakdown and milestone management
- Direct project invoicing capabilities
- Resource planning and allocation
- Built-in WIP (Work in Progress) reports
- Project templates and recurring tasks
- **Estimated: 4-5 weeks additional**

### 5. Advanced Reporting
- Custom Xero report integration
- Consolidated financial dashboards
- Cash flow forecasting
- Multi-entity consolidation
- **Estimated: 2-3 weeks additional**

## Risks & Mitigation

### 1. API Rate Limits
**Risk**: Exceeding 5,000 daily or 60/minute limits during peak usage

**Mitigation**:
- Implement intelligent request queuing
- Use webhooks to reduce polling
- Batch operations wherever possible
- Monitor usage with alerts at 80% threshold
- Implement circuit breaker pattern

### 2. Data Conflicts
**Risk**: Conflicting updates from simultaneous edits in both systems

**Mitigation**:
- Implement optimistic locking
- Clear conflict resolution UI
- Audit trail of all changes
- "Last write wins" with manual review option
- Regular reconciliation jobs

### 3. OAuth Token Expiry
**Risk**: Token expires causing sync failures

**Mitigation**:
- Proactive token refresh (5 minutes before expiry)
- Fallback re-authentication flow
- Admin notifications for auth issues
- Graceful degradation of features
- Queue syncs during downtime

### 4. Xero Plan Limitations
**Risk**: Customer's Xero plan doesn't support required features

**Mitigation**:
- Verify plan capabilities during setup
- Clear messaging about requirements
- Graceful feature degradation
- Provide upgrade guidance
- Document minimum requirements

### 5. Data Privacy & Security
**Risk**: Sensitive financial data exposure

**Mitigation**:
- Encrypt tokens at rest
- Use environment variables for secrets
- Implement webhook signature verification
- Regular security audits
- Comply with data protection regulations

## Success Metrics

### Technical Metrics
- API usage < 20% of daily limit
- Sync success rate > 99%
- Average sync latency < 2 seconds
- Webhook processing < 500ms
- Error rate < 0.1%

### Business Metrics
- Time saved: 2-3 hours daily
- Data accuracy: 99.9%
- User adoption: 80% within first month
- Job cost visibility: 100% of POs tagged to constructions
- Profitability reporting: Real-time P&L per job
- Support tickets: <5% related to sync
- User satisfaction: >4.5/5 rating

### Operational Metrics
- Setup time: <15 minutes
- Conflict resolution: <5 minutes per conflict
- Sync visibility: Real-time status
- Recovery time: <10 minutes from failure
- Documentation completeness: 100%

## Conclusion

This Xero integration will transform TEEEM's financial and construction management operations by eliminating manual data entry, ensuring data consistency, and providing real-time visibility into both purchase orders and job profitability. The use of Tracking Categories provides comprehensive job cost tracking without the complexity of the Projects API, perfectly suited to TEEEM's construction management needs.

The simultaneous rollout of construction sync alongside purchase order sync ensures that from day one, all costs are properly allocated to jobs, enabling immediate profitability analysis and budget tracking. The phased approach allows for iterative development with early value delivery, while the comprehensive error handling and monitoring ensure production reliability.

The architecture is designed to scale with TEEEM's growth and provides a foundation for future financial integrations. With careful attention to user experience and data integrity, this integration will become a core competitive advantage for TEEEM in the construction management space.

---

*Document Version: 1.0*
*Created: November 2024*
*Last Updated: November 2024*
*Next Review: After Phase 1 Completion*