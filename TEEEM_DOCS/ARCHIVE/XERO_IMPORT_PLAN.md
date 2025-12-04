# Xero Full Import Plan

## Overview
Import all Xero tracking categories as Jobs in TEEEM, create Purchase Orders from ALL invoices linked to a tracking category (Bills AND Sales), and sync all Contacts.

### Clarifications
- **Claims** = Anything linked to a tracking category (both ACCPAY bills and ACCREC sales invoices)
- **Required Fields** = Leave blank if no info in Xero (make site_supervisor optional for imports)

---

## Phase 1: Import All Contacts from Xero

### What Already Exists
- `XeroContactSyncService` - Full contact sync service
- One-way sync: Xero → TEEEM (doesn't push back to Xero)
- Matches by: xero_id, tax_number (ABN), email, fuzzy name (85% similarity)

### Steps
1. **Trigger Contact Sync**
   - Use existing service: `XeroContactSyncService.new.sync`
   - Creates new contacts in TEEEM for any Xero contact not matched
   - Updates existing contacts with Xero data

2. **Data Imported per Contact**
   - `xero_id` - Xero ContactID
   - `full_name`, `first_name`, `last_name`
   - `email`, `mobile_phone`, `office_phone`
   - `tax_number` (ABN/ACN)
   - `bank_bsb`, `bank_account_number`, `bank_account_name`
   - `default_purchase_account`
   - `bill_due_day`, `bill_due_type`

3. **API Endpoint**
   - Already exists: `POST /api/v1/xero/sync_contacts`

---

## Phase 2: Import Tracking Categories as Jobs

### Current State
- `XeroBillImportService.fetch_tracking_options` fetches tracking options for category "Job"
- Jobs can be linked to tracking options via `xero_tracking_option_id` and `xero_tracking_option_name`

### New Service: `XeroTrackingImportService`

```ruby
# Creates a Job for each Xero tracking option that doesn't already exist
class XeroTrackingImportService
  def import_all
    tracking_options = fetch_tracking_options

    tracking_options.each do |option|
      # Skip if job already linked to this tracking option
      next if Job.exists?(xero_tracking_option_id: option['TrackingOptionID'])

      # Create new job from tracking option
      Job.create!(
        title: option['Name'],
        status: 'Active',
        site_supervisor_name: 'TBD',  # Required field
        xero_tracking_option_id: option['TrackingOptionID'],
        xero_tracking_option_name: option['Name']
      )
    end
  end
end
```

### API Endpoint
```ruby
# POST /api/v1/xero/import_tracking_categories
def import_tracking_categories
  service = XeroTrackingImportService.new
  result = service.import_all
  render json: result
end
```

---

## Phase 3: Import Bills as Purchase Orders

### Current State
- `XeroBillImportService` imports bills for a SINGLE job by tracking option
- Creates PO with: supplier_name, description, total, status, xero_invoice_id, xero_invoice_number, date, due_date

### Enhanced Service: Import ALL Bills

```ruby
# Import all bills from Xero, matching to jobs by tracking category
class XeroFullBillImportService
  def import_all_bills
    # Fetch ALL bills from Xero
    bills = fetch_all_bills

    bills.each do |bill|
      # Find job by tracking option on bill line items
      job = find_job_for_bill(bill)
      next unless job

      import_bill_to_job(job, bill)
    end
  end

  def import_bill_to_job(job, bill)
    # Skip if already imported
    return if PurchaseOrder.exists?(xero_invoice_id: bill['InvoiceID'])

    # Use INVOICE NUMBER as the task/description name
    invoice_number = bill['InvoiceNumber']

    # Find or create supplier contact
    supplier = find_or_create_supplier(bill['Contact'])

    job.purchase_orders.create!(
      supplier_name: bill['Contact']['Name'],
      supplier_id: supplier&.id,
      description: invoice_number,  # Invoice number as task name
      task_name: invoice_number,     # Also set task_name field
      total: bill['Total'],
      status: determine_status(bill),
      xero_invoice_id: bill['InvoiceID'],
      xero_invoice_number: invoice_number,
      date: parse_xero_date(bill['Date']),
      due_date: parse_xero_date(bill['DueDate']),
      xero_amount_paid: bill['AmountPaid'],
      xero_complete: bill['Status'] == 'PAID'
    )
  end
end
```

### Key Points
- **Invoice Number as Task Name**: `bill['InvoiceNumber']` becomes the PO description/task name
- **Link to Supplier Contact**: Match `bill['Contact']` to TEEEM contact by xero_id
- **Track Payment Status**: `AmountPaid`, `AmountDue`, `Status` from Xero

---

## Phase 4: Import ALL Invoices with Tracking Categories

### Import Both Bills AND Sales Invoices
Any invoice linked to a tracking category gets imported:

```ruby
class XeroFullInvoiceImportService
  def import_all
    # Fetch ALL invoices (both ACCPAY and ACCREC)
    result = @client.get('Invoices')
    invoices = result[:data]['Invoices'] || []

    stats = { bills: 0, sales: 0, skipped: 0, errors: [] }

    invoices.each do |invoice|
      # Find tracking option on line items
      tracking_option_id = extract_tracking_option_id(invoice)
      next unless tracking_option_id

      # Find the job linked to this tracking option
      job = Job.find_by(xero_tracking_option_id: tracking_option_id)
      next unless job

      if invoice['Type'] == 'ACCPAY'
        # Bill (expense) → Purchase Order
        import_as_purchase_order(job, invoice)
        stats[:bills] += 1
      elsif invoice['Type'] == 'ACCREC'
        # Sales Invoice (income) → Could be stored as Job income/claim
        import_as_sales_record(job, invoice)
        stats[:sales] += 1
      end
    end

    stats
  end

  def extract_tracking_option_id(invoice)
    line_items = invoice['LineItems'] || []
    line_items.each do |line|
      (line['Tracking'] || []).each do |tracking|
        return tracking['TrackingOptionID'] if tracking['TrackingOptionID'].present?
      end
    end
    nil
  end
end
```

### Sales Invoices Storage
For ACCREC (sales/claims), we could:
1. **Add to Job as income record** - Track contract payments received
2. **Create new model `JobInvoice`** - Separate table for sales invoices
3. **Update contract_value** - If it represents progress claims

**Recommended**: Store sales invoices as a new `JobSalesInvoice` model or update job's contract-related fields.

---

## Implementation Order

### Step 1: Contact Sync (Ready Now)
```bash
# In Rails console or via API
XeroContactSyncService.new.sync
```

### Step 2: Create XeroTrackingImportService
- New file: `app/services/xero_tracking_import_service.rb`
- Creates jobs from tracking options

### Step 3: Create XeroFullBillImportService
- New file: `app/services/xero_full_bill_import_service.rb`
- Imports all bills as POs
- Uses invoice number as task/description name

### Step 4: Add API Endpoints
```ruby
# routes.rb
namespace :api do
  namespace :v1 do
    namespace :xero do
      post :import_all_tracking_categories
      post :import_all_bills
      post :import_all_contacts
      post :full_import  # Does all three in sequence
    end
  end
end
```

### Step 5: Frontend UI
- Add buttons to Xero tab or Settings page
- "Import All Tracking Categories as Jobs"
- "Import All Bills as Purchase Orders"
- "Sync All Contacts"
- "Full Import" (runs all)

---

## Data Mapping Summary

| Xero | TEEEM |
|------|-------|
| Tracking Category "Job" → Options | Jobs |
| TrackingOptionID | job.xero_tracking_option_id |
| TrackingOptionName | job.xero_tracking_option_name / job.title |
| Bills (ACCPAY) | Purchase Orders |
| InvoiceNumber | purchase_order.description / task_name |
| InvoiceID | purchase_order.xero_invoice_id |
| Contact | purchase_order.supplier / contact |
| Contacts | Contacts |
| ContactID | contact.xero_id |

---

## Pre-Implementation Tasks

### 1. Make Site Supervisor Optional for Imports
```ruby
# In Job model, update validation
validates :site_supervisor_name, presence: true, unless: :imported_from_xero?

def imported_from_xero?
  xero_tracking_option_id.present?
end
```

### 2. Add Xero Import Flag
```ruby
# Migration
add_column :jobs, :imported_from_xero, :boolean, default: false
```

---

## Outstanding Questions

1. **Duplicate Handling** - If tracking option name partially matches existing job title:
   - Link them automatically?
   - Create new job anyway?
   - Ask user to confirm?

2. **Historical Data** - Import ALL invoices or only recent (e.g., last 12 months)?

3. **Sales Invoices** - How to store ACCREC invoices:
   - New `JobSalesInvoice` model?
   - Add income fields to Job?
   - Separate "Claims" table?

---

## Safety Considerations

1. **Run on Staging First** - Test full import on staging/rob branch
2. **Backup Database** - Before production import
3. **Dry Run Mode** - Add option to preview what would be imported without creating records
4. **Rate Limits** - Xero has 60 requests/minute limit - add delays between calls
5. **Idempotent** - All imports should be safe to run multiple times (skip existing)
