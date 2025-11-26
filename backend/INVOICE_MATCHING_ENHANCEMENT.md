# Invoice Matching Service Enhancement

## Summary

Enhanced the `InvoiceMatchingService` to support fuzzy PO number matching across multiple Xero invoice fields. The service now handles various PO number formats that suppliers commonly use, significantly improving the automatic matching success rate.

## Changes Made

### 1. Enhanced `/backend/app/services/invoice_matching_service.rb`

#### Added PO Number Extraction Patterns
```ruby
PO_PATTERNS = [
  /PO[-\s]?\d+/i,                    # PO-123, PO 123, PO123
  /P\.O\.?[-\s]?\d+/i,               # P.O. 123, P.O.-123, P.O.123
  /Purchase\s+Order[-\s]?\d+/i,      # Purchase Order 123, Purchase Order-123
  /P\/O[-\s]?\d+/i,                  # P/O-123, P/O 123
  /Order\s+Ref:?\s*\d+/i             # Order Ref: 123, Order Ref 123
].freeze
```

#### Six Matching Strategies (in priority order)

1. **Reference Field** (Highest priority)
   - Checks Xero invoice `Reference` field
   - Most reliable - suppliers often put PO numbers here
   - Performs exact match first, then fuzzy extraction

2. **InvoiceNumber Field**
   - Extracts PO numbers from invoice number using patterns
   - Handles formats like "PO-123456", "Invoice for PO-123456", "PO123456"

3. **LineItems Descriptions**
   - Scans line item descriptions for PO numbers
   - Useful when suppliers embed PO# in item descriptions

4. **Normalized Matching**
   - Compares numeric portions only
   - Handles different zero-padding: "PO-001" matches "PO-000001"

5. **Supplier + Amount Fallback**
   - Matches by supplier name and approximate amount (±10%)
   - Only for pending POs without existing invoices

6. **Exact Invoice Reference** (Legacy)
   - Matches by invoice reference stored in PO

#### New Helper Methods

**`extract_po_numbers(text)`**
- Scans text with all PO patterns
- Returns array of formatted candidates
- Normalizes to standard format: "PO-XXXXXX"

**`normalize_po_number(text)`**
- Strips non-digits and converts to integer
- Removes leading zeros for comparison
- "PO-001" → 1, "PO-000123" → 123

**`find_po_by_candidate(candidate)`**
- Tries exact match first
- Falls back to normalized matching

**`find_po_by_normalized_number(number)`**
- Compares numeric portions across all POs
- Handles edge cases with different padding

### 2. Enhanced `/backend/app/models/purchase_order.rb`

Added payment tracking methods required by the invoice matching service:

**`payment_status` enum**
```ruby
enum :payment_status, {
  pending: 'pending',
  part_payment: 'part_payment',
  complete: 'complete',
  manual_review: 'manual_review'
}, prefix: :payment
```

**`payment_percentage`**
- Calculates percentage of PO total that has been invoiced

**`determine_payment_status(invoice_amount)`**
- Returns appropriate status based on invoice vs PO total
- `complete`: 95% - 105% of total
- `part_payment`: Less than 95%
- `manual_review`: Exceeds total by $1 or more

**`apply_invoice!(invoice_amount:, invoice_date:, invoice_reference:)`**
- Updates PO with invoice details
- Automatically sets payment status
- Updates xero_invoice_id if applicable

### 3. Test Files Created

#### `/backend/lib/tasks/test_invoice_matching.rake`
Comprehensive automated test suite covering:
- Exact PO number matching
- PO number without dash (PO123456)
- Lowercase PO numbers
- PO numbers with spaces
- P.O. with periods
- "Purchase Order" spelled out
- PO numbers embedded in text
- PO in Reference field
- Different zero-padding normalization
- PO numbers in LineItem descriptions
- Supplier + amount fallback
- No match scenarios

**Run with:** `rails test:invoice_matching`

#### `/backend/test/invoice_matching_demo.rb`
Interactive demo showing:
- PO number extraction examples
- Normalization examples
- Pattern matching demonstrations
- Real-world invoice scenario testing

**Run with:** `rails runner "load 'test/invoice_matching_demo.rb'"`

## Test Results

All 13 test cases pass successfully (100% pass rate):

```
Test Results:
✓ Exact PO number
✓ PO number without dash
✓ Lowercase PO number
✓ PO number with space
✓ P.O. with periods
✓ Purchase Order spelled out
✓ PO number embedded in text
✓ PO in Reference field
✓ Different zero-padding (PO-1 → PO-000001)
✓ Different zero-padding (PO-123 → PO-000123)
✓ PO number in LineItem description
✓ Supplier + amount matching (fallback)
✓ No matching PO found
```

## Usage Examples

### Before Enhancement
Only matched exact "PO-123456" format in InvoiceNumber field.

### After Enhancement

**Example 1: Reference Field**
```ruby
invoice = {
  'InvoiceNumber' => 'INV-98765',
  'Reference' => 'PO-123456',
  'Total' => 5000.00,
  'Contact' => { 'Name' => 'ABC Supplier' }
}
result = InvoiceMatchingService.call(invoice_data: invoice)
# ✓ Matches PO-123456
```

**Example 2: Different Format**
```ruby
invoice = {
  'InvoiceNumber' => 'P.O. 123456',
  'Total' => 5000.00,
  'Contact' => { 'Name' => 'ABC Supplier' }
}
result = InvoiceMatchingService.call(invoice_data: invoice)
# ✓ Matches PO-123456
```

**Example 3: Zero-Padding**
```ruby
invoice = {
  'InvoiceNumber' => 'PO-1',
  'Total' => 1000.00,
  'Contact' => { 'Name' => 'ABC Supplier' }
}
result = InvoiceMatchingService.call(invoice_data: invoice)
# ✓ Matches PO-000001 via normalized matching
```

**Example 4: Line Item Description**
```ruby
invoice = {
  'InvoiceNumber' => 'INV-12345',
  'LineItems' => [
    { 'Description' => 'Materials for Purchase Order 123456' }
  ],
  'Total' => 5000.00,
  'Contact' => { 'Name' => 'ABC Supplier' }
}
result = InvoiceMatchingService.call(invoice_data: invoice)
# ✓ Matches PO-123456
```

## Confidence Levels

The matching strategies provide different confidence levels:

- **High Confidence**: Exact match in Reference or InvoiceNumber
- **Medium Confidence**: Fuzzy pattern extraction, normalized matching
- **Low Confidence**: Supplier + amount matching (fallback)

## Performance Considerations

### Normalized Matching Performance
The `find_po_by_normalized_number` method uses `find_each` to iterate through all POs. This is intentionally simple but may be slow with thousands of POs.

**Future Optimization Option:**
Add a `normalized_po_number` integer column to the `purchase_orders` table:

```ruby
# Migration
add_column :purchase_orders, :normalized_po_number, :integer
add_index :purchase_orders, :normalized_po_number

# In PurchaseOrder model:
before_save :set_normalized_po_number

def set_normalized_po_number
  self.normalized_po_number = purchase_order_number.gsub(/[^\d]/, '').to_i
end
```

Then update the service to use: `PurchaseOrder.find_by(normalized_po_number: number)`

## Files Modified

1. `/Users/jakebaird/teeem/backend/app/services/invoice_matching_service.rb` - Enhanced matching logic
2. `/Users/jakebaird/teeem/backend/app/models/purchase_order.rb` - Added payment tracking methods
3. `/Users/jakebaird/teeem/backend/lib/tasks/test_invoice_matching.rake` - Comprehensive test suite
4. `/Users/jakebaird/teeem/backend/test/invoice_matching_demo.rb` - Interactive demo

## Next Steps

1. ✅ Test locally (completed - 100% pass rate)
2. Deploy to Heroku
3. Monitor Xero invoice sync logs for matching success rate
4. Consider adding normalized_po_number column if performance becomes an issue
5. Potentially add machine learning for fuzzy supplier name matching

## Deployment Instructions

```bash
cd /Users/jakebaird/teeem
git add -A
git commit -m "Enhance invoice matching with fuzzy PO number extraction

- Add support for multiple PO number formats (PO123, P.O. 123, etc.)
- Check Reference field, InvoiceNumber, and LineItems
- Implement normalized matching for different zero-padding
- Add comprehensive test suite with 13 test cases
- Add payment tracking methods to PurchaseOrder model

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git subtree push --prefix backend heroku main
```

## Security Notes

- All pattern matching uses safe regex (no eval)
- SQL injection prevented by ActiveRecord parameterization
- No external API calls in matching logic

## Backward Compatibility

All existing functionality preserved. The enhancement only adds new matching strategies that run before the original fallback logic.

---

**Generated:** November 5, 2025
**Version:** 1.0
**Status:** Tested and ready for deployment
