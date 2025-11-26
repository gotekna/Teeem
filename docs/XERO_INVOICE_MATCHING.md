# Xero Invoice to Purchase Order Matching

## Overview

This feature integrates Xero invoices with the TEEEM PurchaseOrder system, automatically matching supplier invoices to purchase orders and updating payment status based on invoice amounts.

## Implementation Date
November 5, 2025

---

## Business Logic

When a supplier invoices you in Xero, the system can:
1. Fetch the invoice from Xero via API
2. Automatically match it to the corresponding PurchaseOrder
3. Update PO status based on invoice amount

### Payment Status Logic

The system determines payment status using a 5% tolerance range:

| Scenario | Condition | Status | Example |
|----------|-----------|--------|---------|
| **Complete** | Invoice within 95-105% of PO total | `complete` | PO: $1000, Invoice: $960-$1050 |
| **Part Payment** | Invoice less than 95% of PO total | `part_payment` | PO: $1000, Invoice: $900 |
| **Manual Review** | Invoice exceeds PO total by $1+ | `manual_review` | PO: $1000, Invoice: $1001+ |
| **Pending** | No invoice applied yet | `pending` | PO: $1000, Invoice: $0 |

---

## Database Schema

### New Fields on `purchase_orders` Table

```ruby
# Migration: 20251105010955_add_payment_tracking_to_purchase_orders.rb

t.string  :payment_status,     default: 'pending', null: false  # pending, part_payment, complete, manual_review
t.decimal :invoiced_amount,    precision: 15, scale: 2, default: 0.0
t.date    :invoice_date
t.string  :invoice_reference                                     # Xero invoice number or ID

# Index for efficient queries
t.index   :payment_status
```

### Running the Migration

```bash
cd backend
bin/rails db:migrate
```

---

## Model Methods

### PurchaseOrder Model

Located at: `/Users/jakebaird/teeem/backend/app/models/purchase_order.rb`

#### New Enum

```ruby
enum :payment_status, {
  pending: 'pending',
  part_payment: 'part_payment',
  complete: 'complete',
  manual_review: 'manual_review'
}, prefix: :payment
```

#### Key Methods

**`payment_percentage`**
- Returns the percentage of invoice amount relative to PO total
- Example: PO $1000, Invoice $960 → 96.0%

**`determine_payment_status(invoice_amount)`**
- Calculates which payment_status should be applied based on invoice amount
- Uses 5% tolerance logic
- Returns one of: `'pending'`, `'part_payment'`, `'complete'`, `'manual_review'`

**`apply_invoice!(invoice_amount:, invoice_date:, invoice_reference:)`**
- Updates the PO with invoice details
- Automatically calculates and sets payment_status
- Also updates `xero_invoice_id` if reference looks like Xero ID
- Returns the new payment_status

#### Example Usage

```ruby
po = PurchaseOrder.find(123)

# Check what status would be applied
status = po.determine_payment_status(960.00)  # => "complete"

# Apply invoice details
po.apply_invoice!(
  invoice_amount: 960.00,
  invoice_date: Date.today,
  invoice_reference: "INV-001"
)

# Check results
po.payment_status      # => "complete"
po.invoiced_amount     # => 960.00
po.payment_percentage  # => 96.0
```

---

## Service Layer

### InvoiceMatchingService

Located at: `/Users/jakebaird/teeem/backend/app/services/invoice_matching_service.rb`

**Purpose:** Matches Xero invoices to PurchaseOrders using intelligent matching strategies.

#### Usage

```ruby
# Automatic matching (finds PO automatically)
result = InvoiceMatchingService.call(
  invoice_data: xero_invoice_hash
)

# Manual matching (specify PO)
result = InvoiceMatchingService.call(
  invoice_data: xero_invoice_hash,
  purchase_order_id: 123
)
```

#### Matching Strategies

The service tries multiple strategies to find the matching PO:

1. **PO Number in Invoice Number**
   - Looks for "PO-######" pattern in invoice number
   - Example: Invoice "INV-2025-PO-000123" matches PO-000123

2. **Supplier + Amount Match**
   - Matches by supplier and invoice amount (within 10% tolerance)
   - Only considers pending POs
   - Returns most recent match

3. **Exact Invoice Reference**
   - Matches if PO has the invoice reference pre-stored

#### Return Values

**Success:**
```ruby
{
  success: true,
  purchase_order: <PurchaseOrder object>,
  payment_status: "complete",
  invoice_number: "INV-001",
  invoice_total: 960.00,
  po_total: 1000.00,
  percentage: 96.0,
  message: "Invoice amount ($960.0) is within 5% of PO total ($1000.0)"
}
```

**Failure:**
```ruby
{
  success: false,
  error: "No matching Purchase Order found for invoice INV-001",
  invoice_number: "INV-001",
  supplier_name: "ABC Supplies"
}
```

---

## API Endpoints

All endpoints are prefixed with `/api/v1/xero/`

### 1. GET /api/v1/xero/invoices

Fetch invoices from Xero with optional filters.

**Query Parameters:**
- `from_date` (optional) - Filter invoices from this date (YYYY-MM-DD)
- `status` (optional) - Filter by status (AUTHORISED, PAID, VOIDED, etc.)
- `page` (optional) - Pagination page number

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/xero/invoices?status=AUTHORISED&from_date=2025-01-01"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "InvoiceID": "abc-123",
        "InvoiceNumber": "INV-001",
        "Total": 960.00,
        "Date": "/Date(1609459200000)/",
        "Status": "AUTHORISED",
        "Contact": {
          "Name": "ABC Supplies"
        }
      }
    ],
    "count": 1
  }
}
```

### 2. POST /api/v1/xero/match_invoice

Match a Xero invoice to a Purchase Order.

**Body Parameters:**
- `invoice_id` (required) - Xero invoice ID
- `purchase_order_id` (optional) - Specific PO to match to (bypasses auto-matching)

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/xero/match_invoice \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_id": "abc-123",
    "purchase_order_id": 456
  }'
```

**Success Response:**
```json
{
  "success": true,
  "message": "Invoice amount ($960.0) is within 5% of PO total ($1000.0)",
  "data": {
    "purchase_order_id": 456,
    "purchase_order_number": "PO-000456",
    "payment_status": "complete",
    "invoice_total": 960.00,
    "po_total": 1000.00,
    "percentage": 96.0
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "No matching Purchase Order found for invoice INV-001"
}
```

### 3. POST /api/v1/xero/webhook

Receives Xero webhooks (placeholder for future implementation).

**Note:** Webhook signature verification not yet implemented.

---

## Testing

### Test Cases Verified

Located at: `/Users/jakebaird/teeem/backend/test_invoice_matching.rb`

```ruby
# Test with real PurchaseOrder
bin/rails runner test_invoice_matching.rb
```

**Test Results:**
- Invoice = 100% of PO → `complete` ✓
- Invoice = 96% of PO → `complete` ✓
- Invoice = 90% of PO → `part_payment` ✓
- Invoice = PO + $1 → `manual_review` ✓
- Invoice = PO + $10 → `manual_review` ✓

### Manual Testing with Rails Console

```ruby
# Start console
bin/rails console

# Find a PO
po = PurchaseOrder.first

# Test status determination
po.determine_payment_status(po.total * 0.96)  # => "complete"
po.determine_payment_status(po.total * 0.90)  # => "part_payment"
po.determine_payment_status(po.total + 1)     # => "manual_review"

# Apply an invoice
po.apply_invoice!(
  invoice_amount: po.total * 0.96,
  invoice_date: Date.today,
  invoice_reference: "TEST-001"
)

# Check results
po.payment_status      # => "complete"
po.invoiced_amount     # => <96% of total>
po.payment_percentage  # => 96.0
```

---

## Frontend Integration Recommendations

### 1. Purchase Order Detail Page

**Show Payment Status Badge:**
```jsx
// Status badge with color coding
<span className={`
  px-2 py-1 rounded text-sm font-medium
  ${po.payment_status === 'complete' ? 'bg-green-100 text-green-800' : ''}
  ${po.payment_status === 'part_payment' ? 'bg-yellow-100 text-yellow-800' : ''}
  ${po.payment_status === 'manual_review' ? 'bg-red-100 text-red-800' : ''}
  ${po.payment_status === 'pending' ? 'bg-gray-100 text-gray-800' : ''}
`}>
  {po.payment_status.replace('_', ' ').toUpperCase()}
</span>
```

**Show Invoice Details:**
```jsx
{po.invoice_reference && (
  <div className="mt-4">
    <h4 className="font-semibold">Invoice Details</h4>
    <dl className="grid grid-cols-2 gap-2 mt-2">
      <dt className="text-gray-600">Invoice Reference:</dt>
      <dd>{po.invoice_reference}</dd>

      <dt className="text-gray-600">Invoice Date:</dt>
      <dd>{formatDate(po.invoice_date)}</dd>

      <dt className="text-gray-600">Invoiced Amount:</dt>
      <dd>${po.invoiced_amount.toFixed(2)}</dd>

      <dt className="text-gray-600">PO Total:</dt>
      <dd>${po.total.toFixed(2)}</dd>

      <dt className="text-gray-600">Percentage:</dt>
      <dd>{po.payment_percentage}%</dd>
    </dl>
  </div>
)}
```

### 2. Xero Invoice Matching UI

**Invoice List with Match Button:**
```jsx
const XeroInvoiceList = () => {
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    fetch('/api/v1/xero/invoices?status=AUTHORISED')
      .then(res => res.json())
      .then(data => setInvoices(data.data.invoices));
  }, []);

  const matchInvoice = async (invoiceId) => {
    const response = await fetch('/api/v1/xero/match_invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: invoiceId })
    });

    const result = await response.json();

    if (result.success) {
      alert(`Matched to ${result.data.purchase_order_number} - Status: ${result.data.payment_status}`);
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  return (
    <div>
      {invoices.map(invoice => (
        <div key={invoice.InvoiceID} className="border p-4 mb-2">
          <h3>{invoice.InvoiceNumber}</h3>
          <p>Supplier: {invoice.Contact.Name}</p>
          <p>Total: ${invoice.Total}</p>
          <button
            onClick={() => matchInvoice(invoice.InvoiceID)}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Match to PO
          </button>
        </div>
      ))}
    </div>
  );
};
```

### 3. Dashboard Widget

**Show POs Requiring Manual Review:**
```jsx
const ManualReviewWidget = () => {
  const [pos, setPOs] = useState([]);

  useEffect(() => {
    fetch('/api/v1/purchase_orders?payment_status=manual_review')
      .then(res => res.json())
      .then(data => setPOs(data.purchase_orders));
  }, []);

  return (
    <div className="bg-red-50 border border-red-200 rounded p-4">
      <h3 className="font-bold text-red-800 mb-2">
        ⚠️ Invoices Requiring Review ({pos.length})
      </h3>
      <ul>
        {pos.map(po => (
          <li key={po.id} className="mb-1">
            <a href={`/purchase-orders/${po.id}`} className="text-blue-600 hover:underline">
              {po.purchase_order_number} - ${po.invoiced_amount} / ${po.total}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

---

## Files Modified/Created

### Backend Files

**Migrations:**
- `/Users/jakebaird/teeem/backend/db/migrate/20251105010955_add_payment_tracking_to_purchase_orders.rb`

**Models:**
- `/Users/jakebaird/teeem/backend/app/models/purchase_order.rb` (modified)
  - Added `payment_status` enum
  - Added `payment_percentage` method
  - Added `determine_payment_status` method
  - Added `apply_invoice!` method

**Services:**
- `/Users/jakebaird/teeem/backend/app/services/invoice_matching_service.rb` (new)
  - Intelligent invoice-to-PO matching
  - Multiple matching strategies
  - Status message generation

**Controllers:**
- `/Users/jakebaird/teeem/backend/app/controllers/api/v1/xero_controller.rb` (modified)
  - Added `invoices` endpoint
  - Added `match_invoice` endpoint
  - Added `webhook` endpoint (placeholder)

**Routes:**
- `/Users/jakebaird/teeem/backend/config/routes.rb` (modified)
  - Added routes for new Xero endpoints

**Test Scripts:**
- `/Users/jakebaird/teeem/backend/test_invoice_matching.rb` (new)

---

## Deployment

### Local Testing

```bash
# Run migration
cd backend
bin/rails db:migrate

# Test with Rails console
bin/rails console

# Test with script
bin/rails runner test_invoice_matching.rb

# Start server
bin/rails server
```

### Production Deployment (Heroku)

```bash
# From teeem root directory
git add -A
git commit -m "Add Xero invoice to PO matching feature"

# Deploy backend
git subtree push --prefix backend heroku main

# Run migration on Heroku
heroku run bin/rails db:migrate

# Verify deployment
heroku logs --tail
```

---

## Future Enhancements

### Phase 1 (Completed)
- ✅ Database schema for payment tracking
- ✅ Payment status calculation logic
- ✅ Invoice matching service
- ✅ API endpoints for manual matching

### Phase 2 (Recommended)
- ⏳ Xero webhook integration for automatic matching
- ⏳ Webhook signature verification
- ⏳ Background job processing for webhooks
- ⏳ Email notifications for manual review cases

### Phase 3 (Future)
- ⏳ Multi-invoice support (one PO, multiple invoices)
- ⏳ Partial invoice matching
- ⏳ Invoice line item matching to PO line items
- ⏳ Automated supplier reconciliation reports

### Phase 4 (Advanced)
- ⏳ AI-powered invoice matching (fuzzy matching)
- ⏳ Custom tolerance rules per supplier
- ⏳ Payment history tracking
- ⏳ Cashflow forecasting based on invoices

---

## Troubleshooting

### Issue: Invoice not matching to PO

**Check:**
1. Does the invoice number contain the PO number?
   - Format: "INV-2025-PO-000123"
2. Is the supplier correctly matched in the system?
3. Is the invoice amount within 10% of PO total?
4. Is the PO in `pending` payment status?

**Solution:** Use manual matching with `purchase_order_id` parameter.

### Issue: Status showing "manual_review" for valid invoice

**Cause:** Invoice amount exceeds PO total by $1 or more.

**Solution:**
1. Review the invoice for errors
2. Check if PO was updated after invoice
3. Update PO total if legitimate
4. Manually adjust payment_status if approved

### Issue: Xero API not returning invoices

**Check:**
1. Xero connection status: `GET /api/v1/xero/status`
2. Access token expiration
3. Xero API scopes include `accounting.transactions`

**Solution:**
- Reconnect to Xero if token expired
- Check Heroku logs for API errors

---

## Support & Maintenance

**Feature Owner:** Jake Baird
**Implementation Date:** November 5, 2025
**Last Updated:** November 5, 2025

**Related Documentation:**
- Xero API Integration: `/Users/jakebaird/teeem/xero-integration-plan.md`
- Purchase Order System: Check model at `/Users/jakebaird/teeem/backend/app/models/purchase_order.rb`

---

## Summary

This feature enables automatic invoice matching between Xero and PurchaseOrders with intelligent status determination:

- **Complete:** Invoice within 95-105% of PO
- **Part Payment:** Invoice less than 95% of PO
- **Manual Review:** Invoice exceeds PO by $1+

The system supports both automatic matching (via supplier/amount) and manual matching (via API). Integration with frontend recommended for best user experience.
