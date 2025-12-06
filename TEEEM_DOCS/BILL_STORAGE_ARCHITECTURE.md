# Bill Storage Architecture (SSoT)

**Last Updated:** 2025-12-07
**Status:** Active Implementation

## Single Source of Truth Hierarchy

Bills from Xero are stored with the **Supplier (Contact)** as the primary SSoT.

```
Xero Bill PDF
    ↓
CompanyDocument (documentable → ExternalInvoice)
    ↓
ExternalInvoice (bill record)
    ├─ contact_id → Contact (Supplier) [PRIMARY/SSoT]
    └─ job_id → Job (optional, via Xero tracking)
```

## Database Relationships

### Tables

1. **`external_invoices`** - Stores bill metadata from Xero
   - `contact_id` (required for bills) → Supplier SSoT
   - `job_id` (optional) → Derived from Xero tracking categories
   - `invoice_type` = "bill" for supplier bills
   - `source` = "xero" (or myob, quickbooks)

2. **`company_documents`** - Stores bill PDFs and attachments
   - `documentable_type` = "ExternalInvoice"
   - `documentable_id` → Links to `external_invoices.id`
   - `contact_id` → Duplicates supplier for fast queries

3. **`contacts`** - Suppliers
   - `has_many :external_invoices` (includes bills)
   - `has_many :company_documents` (includes bill PDFs)

### Model Associations

**Contact (Supplier)**
```ruby
has_many :external_invoices, dependent: :nullify
has_many :company_documents, dependent: :destroy
```

**ExternalInvoice**
```ruby
belongs_to :contact, optional: true  # Supplier for bills
belongs_to :job, optional: true      # Job tracking (optional)
has_many :company_documents, as: :documentable, dependent: :nullify
```

**CompanyDocument**
```ruby
belongs_to :contact, optional: true  # Quick access to supplier
belongs_to :documentable, polymorphic: true, optional: true
```

## Why Supplier is SSoT

✅ **Bills belong to suppliers first** - A bill is issued by the supplier
✅ **Job assignment can change** - Xero tracking categories can be updated
✅ **Historical accuracy** - Supplier never changes, even if re-assigned to different job
✅ **Consistent with existing patterns** - Same as purchase_orders.supplier_id

## Helper Methods

### Contact Model

```ruby
# Get all bills from this supplier
contact.supplier_bills  # ExternalInvoice.bills.active

# Counts and totals
contact.supplier_bills_count          # Total bills
contact.supplier_bills_total          # Sum of all bills
contact.supplier_bills_unpaid         # Unpaid bills
contact.supplier_bills_unpaid_total   # Amount owing
contact.supplier_bills_overdue        # Past due date
contact.supplier_bills_overdue_total  # Overdue amount

# Bill PDFs
contact.supplier_bill_documents  # CompanyDocument records

# Check if contact is a supplier
contact.is_supplier?  # Now includes bills check
```

### ExternalInvoice Model

```ruby
# Type checkers
external_invoice.bill?              # true if invoice_type == "bill"
external_invoice.sales_invoice?     # true if invoice_type == "sales_invoice"

# Relationships
external_invoice.supplier           # Contact (for bills)
external_invoice.customer           # Contact (for sales invoices)
external_invoice.company_documents  # Attached PDFs

# Display
external_invoice.display_name  # "Bill INV-123 from Acme Corp"
```

## Usage Examples

### Creating a Bill Record with PDF

```ruby
# 1. Create the bill record from Xero sync
bill = ExternalInvoice.create!(
  source: "xero",
  invoice_type: "bill",
  external_id: xero_invoice_id,
  tenant_id: xero_tenant_id,
  invoice_number: "INV-123",
  contact_id: supplier_contact.id,  # SSoT
  contact_name: supplier_contact.display_name,
  job_id: job.id,  # Optional, from Xero tracking
  total: 5000.00,
  amount_due: 5000.00,
  status: "approved",
  invoice_date: Date.today,
  due_date: 30.days.from_now
)

# 2. Attach the PDF from Xero
document = CompanyDocument.create!(
  documentable: bill,
  contact_id: supplier_contact.id,  # Duplicate for fast queries
  document_type: "Bill",
  title: "Bill #{bill.invoice_number} - #{supplier_contact.display_name}",
  source: "xero",
  onedrive_file_id: onedrive_id  # If syncing to OneDrive
)
document.file.attach(io: pdf_file, filename: "bill_#{bill.invoice_number}.pdf")
```

### Querying Bills

```ruby
# All bills for a supplier
supplier = Contact.find(123)
bills = supplier.supplier_bills
# => Returns active bills only

# Unpaid bills with documents
unpaid_bills = supplier.supplier_bills_unpaid.includes(:company_documents)

# Bills for a specific job
job_bills = Job.find(456).external_invoices.bills

# Find bill by Xero ID
bill = ExternalInvoice.xero.find_by(external_id: "xero-invoice-id")

# All bill PDFs for a supplier
pdfs = supplier.supplier_bill_documents
```

### Re-assigning a Bill to Different Job

```ruby
# Bill can be re-assigned without breaking supplier relationship
bill = ExternalInvoice.find(789)
bill.update!(job_id: new_job.id)

# Supplier (contact_id) never changes - maintains SSoT
```

## Data Warehouse Integration

When storing bills in the data warehouse:

1. **Primary Storage:** `ExternalInvoice` record (metadata)
2. **Document Storage:** `CompanyDocument` with PDF attachment
3. **Primary Index:** `contact_id` (supplier)
4. **Secondary Index:** `job_id` (optional tracking)
5. **Polymorphic Link:** `documentable_type` + `documentable_id`

## Long-term Benefits

1. **Supplier History** - Easy to query all bills from a supplier
2. **Job Flexibility** - Bills can move between jobs without data loss
3. **Audit Trail** - Historical job assignments preserved in activity log
4. **Consistent Pattern** - Matches purchase_orders, pricebook_items, etc.
5. **Fast Queries** - Indexed on both supplier and job
6. **Document Management** - All supplier documents in one place

## Migration Status (Current Data)

**As of 2025-12-07:**

- ✅ **2,399 bills already have supplier (99.3%)** - No migration needed!
- ⚠️ **17 bills missing supplier (0.7%)** - Suppliers not synced from Xero yet
- ✅ **2,097 bills have BOTH supplier AND job (86.8%)** - Perfect!
- ⚠️ **302 bills have supplier only, no job (12.5%)** - Normal (not all bills tracked to jobs)
- ❌ **7 bills reference deleted contacts** - Need cleanup

**Top Suppliers:**
1. Tekna Admin: 662 bills ($3.66M)
2. Bunnings: 358 bills ($316K)
3. Harvey Norman Commercial: 108 bills ($161K)

## Migration Tasks

Use the rake tasks to manage bill-supplier relationships:

### 1. Generate Report
```bash
rails xero_bills:report
```
Shows current status, breakdown, and top suppliers.

### 2. Link Bills to Suppliers
```bash
rails xero_bills:link_to_suppliers
```
Automatically links bills using `external_contact_id` → `ContactExternalLink`.

### 3. Verify Data Integrity
```bash
rails xero_bills:verify
```
Checks for orphaned bills, missing links, mismatched documents.

### 4. Fix Integrity Issues
```bash
rails xero_bills:fix_integrity
```
Automatically fixes:
- Links bills to suppliers using external_contact_id
- Syncs document contact_id with bill's supplier

## Manual Migration (if needed)

```ruby
# Link orphaned bills to suppliers
ExternalInvoice.bills.where(contact_id: nil).each do |bill|
  bill.link_to_contact!  # Uses external_contact_id
end

# Link orphaned bills to jobs
ExternalInvoice.bills.where(job_id: nil).each do |bill|
  bill.link_to_job!  # Uses Xero tracking_data
end

# Attach documents to bills
CompanyDocument.where(document_type: "Bill", documentable_id: nil).each do |doc|
  # Find matching bill by invoice number or date
  bill = ExternalInvoice.bills.find_by(
    invoice_number: extract_invoice_number(doc.title),
    contact_id: doc.contact_id
  )

  if bill
    doc.update!(documentable: bill)
  end
end
```

## References

- [contact.rb:27](../backend/app/models/contact.rb#L27) - `has_many :external_invoices`
- [contact.rb:81](../backend/app/models/contact.rb#L81) - `has_many :company_documents`
- [contact.rb:361-395](../backend/app/models/contact.rb#L361-L395) - Bill helper methods
- [external_invoice.rb:6](../backend/app/models/external_invoice.rb#L6) - `has_many :company_documents`
- [external_invoice.rb:245-269](../backend/app/models/external_invoice.rb#L245-L269) - Supplier/customer helpers
- [company_document.rb:12](../backend/app/models/company_document.rb#L12) - Polymorphic documentable
