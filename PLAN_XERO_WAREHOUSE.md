# Plan: Xero Data Warehouse

## Problem Statement

Currently, viewing Xero activity requires live API calls which are:
1. **Slow** - Contact pages make 4+ API calls, Job pages need 30+ API calls (paginating through all invoices)
2. **Rate Limited** - Xero limits to 60 calls/minute, easily hit with multiple users
3. **Inefficient** - Can't filter invoices by tracking category at API level, must download all and filter

## Proposed Solution: Local Xero Data Cache

Store Xero invoice/bill/payment data locally in TEEEM database. All UI reads from local data, background job syncs from Xero periodically.

## Database Schema

### New Tables

```ruby
# xero_invoices - stores all invoices and bills from Xero
create_table :xero_invoices do |t|
  # Xero identifiers
  t.string :xero_invoice_id, null: false, index: true
  t.string :xero_tenant_id, null: false, index: true

  # Invoice data
  t.string :invoice_number
  t.string :reference
  t.string :invoice_type  # ACCREC (sales invoice) or ACCPAY (bill)
  t.string :status        # DRAFT, SUBMITTED, AUTHORISED, PAID, VOIDED, DELETED
  t.date :invoice_date
  t.date :due_date
  t.date :fully_paid_date

  # Amounts
  t.decimal :subtotal, precision: 15, scale: 4
  t.decimal :total_tax, precision: 15, scale: 4
  t.decimal :total, precision: 15, scale: 4
  t.decimal :amount_due, precision: 15, scale: 4
  t.decimal :amount_paid, precision: 15, scale: 4

  # Xero contact (customer/supplier)
  t.string :xero_contact_id, index: true
  t.string :contact_name

  # Links to TEEEM records
  t.references :contact, foreign_key: true  # Our contact record
  t.references :job, foreign_key: true      # Linked via tracking category

  # Raw data
  t.jsonb :line_items, default: []
  t.jsonb :payments, default: []
  t.jsonb :tracking_categories, default: []  # Extracted from line items

  t.timestamps
  t.datetime :xero_updated_at  # When Xero last modified this
end

add_index :xero_invoices, [:xero_tenant_id, :xero_invoice_id], unique: true
add_index :xero_invoices, :invoice_type
add_index :xero_invoices, :status
add_index :xero_invoices, :tracking_categories, using: :gin
```

### Tracking Categories → Jobs Linking

When syncing invoices, extract tracking categories from line items and auto-link to Jobs:

```ruby
# In XeroInvoiceSyncService
def link_to_job(invoice)
  tracking_names = invoice.line_items.flat_map { |li|
    li['Tracking']&.map { |t| t['Option'] }
  }.compact.uniq

  tracking_names.each do |name|
    job = Job.find_by(xero_tracking_option_name: name)
    if job
      invoice.update(job: job)
      break  # Link to first matching job
    end
  end
end
```

## Sync Strategy

### 1. Initial Full Sync
- Run once to populate all historical data
- Paginate through all invoices (like we do now)
- Store in local database
- ~3000 invoices × 30 pages = takes ~5 minutes but only runs once

### 2. Incremental Sync (Recommended)
- Run every 15-30 minutes via background job
- Use `modifiedAfter` parameter to only fetch recently changed invoices
- Much faster - typically only a few invoices per sync

```ruby
# Example: Only fetch invoices modified in last hour
result = client.get('Invoices', {
  page: 1,
  modifiedAfter: 1.hour.ago.iso8601
})
```

### 3. Webhook-Triggered Sync (Future Enhancement)
- Xero can send webhooks when invoices change
- Immediately sync specific invoice when notified
- Most real-time option

## Implementation Phases

### Phase 1: Database & Sync Service (Backend)
1. Create `xero_invoices` migration
2. Create `XeroInvoiceSyncService` to fetch and store invoices
3. Add Rake task for initial sync: `rails xero:sync_invoices`
4. Add background job for incremental sync

### Phase 2: Update API Endpoints
1. Modify `/api/v1/xero/invoices_by_tracking` to read from local DB
2. Keep existing contact invoice endpoint but add fallback to local data
3. Add endpoint: `GET /api/v1/jobs/:id/xero_invoices` (reads local)

### Phase 3: Frontend Updates
1. JobInvoicesTab and JobBillsTab read from new fast endpoint
2. Contact XeroActivityTab can optionally use local data
3. Add "Last synced" timestamp display
4. Add manual "Refresh from Xero" button for force-sync

### Phase 4: Background Jobs
1. Set up recurring job to sync every 30 minutes
2. Add job to sync single invoice when needed
3. Dashboard to show sync status

## Benefits

| Current | With Xero Warehouse |
|---------|---------------------|
| 30+ API calls per job page load | 1 fast DB query |
| 4+ API calls per contact page | 1 fast DB query |
| Rate limit issues with multiple users | No API calls for reads |
| Slow page loads (3-10 seconds) | Instant page loads |
| Live data only | Historical data + snapshots |

## Questions to Resolve

1. **Sync frequency?** 15 min, 30 min, 1 hour?
2. **Store payments separately or embedded in invoice?**
3. **Include quotes and credit notes in Phase 1?**
4. **How long to keep deleted/voided invoices?**

## Files to Create/Modify

### New Files
- `db/migrate/xxx_create_xero_invoices.rb`
- `app/models/xero_invoice.rb`
- `app/services/xero_invoice_sync_service.rb`
- `app/jobs/xero_invoice_sync_job.rb`
- `lib/tasks/xero_sync.rake`

### Modified Files
- `app/controllers/api/v1/xero_controller.rb` - new endpoint
- `app/controllers/api/v1/jobs_controller.rb` - add xero_invoices action
- `frontend/src/components/jobs/JobInvoicesTab.jsx` - use new endpoint
- `frontend/src/components/jobs/JobBillsTab.jsx` - use new endpoint
