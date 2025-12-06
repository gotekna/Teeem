# Auto-Create Purchase Orders from Bills

**Date:** 2025-12-07
**Feature:** Automatically create purchase orders when bills are synced from Xero

---

## Overview

When bills are synced from Xero, if a bill has both a job and a supplier but no corresponding purchase order exists in TEEEM, the system will automatically create one. This ensures bills are always tracked against purchase orders for proper job costing.

---

## Implementation

### Backend Changes

**File:** `backend/app/services/external_invoice_sync_service.rb`

**Added Method:** `auto_create_purchase_order(invoice)`

**Trigger Condition:**
- Invoice type is "bill" (ACCPAY in Xero)
- Bill has a job_id (linked to TEEEM job)
- Bill has a contact_id (linked to TEEEM supplier)
- No existing PO with matching xero_invoice_id

**Auto-Created PO Fields:**
```ruby
PurchaseOrder.create!(
  job_id: invoice.job_id,                      # Required - from bill
  supplier_id: invoice.contact_id,             # Supplier from bill
  status: "invoiced",                          # Bill exists, so already invoiced
  xero_invoice_id: invoice.external_id,        # Link back to bill
  total: invoice.total || 0,                   # Bill total
  sub_total: invoice.subtotal || 0,            # Bill subtotal
  tax: invoice.total_tax || 0,                 # Bill tax
  invoiced_amount: invoice.total,              # Full amount invoiced
  invoice_date: invoice.invoice_date,          # Bill date
  invoice_reference: invoice.invoice_number,   # Bill number
  description: "Auto-generated from Xero bill #{invoice.invoice_number}",
  ordered_date: invoice.invoice_date,          # Use bill date as order date
  payment_status: invoice.status == "paid" ? "complete" : "pending"
)
```

**Execution Flow:**
1. Bill is synced from Xero
2. Bill is linked to job (via tracking category)
3. Bill is linked to supplier (via xero contact_id)
4. Check if both job_id and contact_id are present
5. Check if PO already exists (via xero_invoice_id)
6. If not exists, create new PO with status "invoiced"
7. Log creation and update stats

**Stats Tracking:**
- New stat added: `pos_auto_created` (count of POs created)
- Logged in sync results

---

## Business Logic

### Why Status = "invoiced"?

When a bill arrives from Xero, it means:
- The supplier has already invoiced us
- The work/materials have been received
- We're past the "draft", "pending", "approved", "sent" stages

Therefore, auto-created POs are marked as **"invoiced"** to reflect their actual state.

### Payment Status Logic

- **Paid bill** → `payment_status: "complete"`
- **Unpaid bill** → `payment_status: "pending"`

This allows financial tracking to show which bills have been paid.

### Why Link via xero_invoice_id?

The `xero_invoice_id` field in the PurchaseOrder table stores the Xero bill's external_id. This:
- Prevents duplicate PO creation on subsequent syncs
- Links the PO back to the original Xero bill
- Allows future enhancements to update PO when bill changes

---

## Example Scenario

**Xero Bill:**
- Invoice Number: BILL-12345
- Supplier: Bunnings
- Total: $1,250.50
- Date: 2025-12-01
- Tracking: "Job 123 - Kitchen Renovation"

**TEEEM Sync:**
1. Bill synced to `external_invoices` table
2. Linked to Job "Kitchen Renovation" (job_id: 123)
3. Linked to Contact "Bunnings" (contact_id: 456)
4. No PO exists with xero_invoice_id = "bill-external-id-xyz"
5. **Auto-create PO:**
   - `purchase_order_number`: PO-001234 (auto-generated)
   - `job_id`: 123
   - `supplier_id`: 456
   - `status`: "invoiced"
   - `total`: $1,250.50
   - `xero_invoice_id`: "bill-external-id-xyz"
   - `invoice_reference`: "BILL-12345"
   - `description`: "Auto-generated from Xero bill BILL-12345"

**Result:**
- Bill is now linked to PO
- Job costing shows PO in Purchase Orders tab
- Financial tracking shows bill as invoiced against PO
- No duplicate POs on future syncs

---

## Edge Cases Handled

### 1. Bill Without Job
**Scenario:** Bill has supplier but no tracking category (no job)
**Behavior:** PO NOT created (job_id is required for PurchaseOrder)
**Reason:** Can't create PO without knowing which job it's for

### 2. Bill Without Supplier
**Scenario:** Bill has job but supplier not synced to TEEEM
**Behavior:** PO NOT created (contact_id is missing)
**Reason:** Need to link supplier first

### 3. Duplicate Sync
**Scenario:** Same bill synced multiple times
**Behavior:** Only first sync creates PO, subsequent syncs skip
**Check:** `PurchaseOrder.find_by(xero_invoice_id: invoice.external_id)`

### 4. Manual PO Already Exists
**Scenario:** User manually created PO and entered xero_invoice_id
**Behavior:** Auto-creation skipped
**Check:** Same as duplicate sync

### 5. PO Creation Fails
**Scenario:** Validation error or database constraint fails
**Behavior:** Error logged, sync continues with other bills
**Error Handling:** `rescue StandardError => e` - doesn't break entire sync

---

## Testing Checklist

- [ ] Sync bill with job and supplier → PO created
- [ ] Sync bill without job → No PO created
- [ ] Sync bill without supplier → No PO created
- [ ] Sync same bill twice → Only 1 PO created
- [ ] Sync bill with existing PO → No duplicate
- [ ] Check PO fields match bill data
- [ ] Check PO status is "invoiced"
- [ ] Check payment_status for paid vs unpaid bills
- [ ] Check stats show `pos_auto_created` count
- [ ] Check logs show PO creation messages

---

## Future Enhancements

### 1. Update PO When Bill Changes
**Current:** PO created once, never updated
**Enhancement:** If bill amount changes in Xero, update linked PO
**Implementation:** Check bill's `external_updated_at` vs PO's `updated_at`

### 2. Add Line Items
**Current:** PO created without line items
**Enhancement:** Copy bill line items to PO line items
**Implementation:** Map `external_invoices.line_items` → `purchase_order_line_items`

### 3. Handle Credit Notes
**Current:** Only bills (ACCPAY) trigger PO creation
**Enhancement:** Link credit notes to existing POs
**Implementation:** Match credit note to PO via supplier + amount

### 4. Reverse Sync (PO → Bill)
**Current:** Bill creates PO (one direction)
**Enhancement:** Creating PO in TEEEM could create bill in Xero
**Implementation:** Use ExternalInvoiceSyncService's `push_invoice_to_xero` method

---

## Related Documentation

- [BILL_STORAGE_ARCHITECTURE.md](BILL_STORAGE_ARCHITECTURE.md) - Bill SSoT and data model
- [BILL_WAREHOUSE_IMPLEMENTATION.md](BILL_WAREHOUSE_IMPLEMENTATION.md) - Bills tab warehouse migration
- [DATA_WAREHOUSE_AUDIT_REPORT.md](DATA_WAREHOUSE_AUDIT_REPORT.md) - Xero API usage patterns

---

## Code References

**Sync Service:**
- `backend/app/services/external_invoice_sync_service.rb:282-284` - Auto-create trigger
- `backend/app/services/external_invoice_sync_service.rb:363-399` - Auto-create method
- `backend/app/services/external_invoice_sync_service.rb:14` - Stats tracking

**Models:**
- `backend/app/models/purchase_order.rb:26` - PO validations
- `backend/app/models/purchase_order.rb:333-354` - PO number generation
- `backend/app/models/external_invoice.rb` - Bill model

**Database:**
- `backend/db/schema.rb` - `external_invoices` table
- `backend/db/schema.rb` - `purchase_orders` table (xero_invoice_id field)

---

## Monitoring

**Log Messages:**
```
Auto-created PO PO-001234 for bill BILL-12345 (Job: Kitchen Renovation, Supplier: Bunnings)
```

**Error Messages:**
```
Failed to auto-create PO for invoice BILL-12345: [error details]
```

**Stats:**
```ruby
{
  created: 10,
  updated: 5,
  linked_to_jobs: 8,
  linked_to_contacts: 12,
  pos_auto_created: 7,  # New stat
  errors: [],
  pages_fetched: 2,
  total_invoices: 15
}
```

---

**Implementation Date:** 2025-12-07
**Status:** ✅ Complete
**Tested:** Pending production deployment
