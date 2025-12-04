# Live Profit Calculation Implementation

## Overview
Implemented automatic live profit calculation for Construction/Jobs. The profit is now calculated dynamically based on the formula:

```
Live Profit = Contract Value - Sum of all Purchase Order totals
Profit Percentage = (Live Profit / Contract Value) × 100
```

## Changes Made

### Backend Changes

#### 1. Construction Model (`/backend/app/models/construction.rb`)
- **Added `calculate_live_profit` method**: Computes profit by subtracting sum of all PO totals from contract value
- **Added `calculate_profit_percentage` method**: Calculates percentage with divide-by-zero protection
- **Added `calculate_and_update_profit!` method**: Updates database columns for persistence
- **Overrode `live_profit` and `profit_percentage` getters**: Always return fresh calculated values, ensuring data is never stale

**Key Features:**
- Uses efficient SQL `SUM()` query instead of Ruby iteration
- Handles `nil` values gracefully (treats as 0)
- Rounds percentage to 2 decimal places
- Returns 0% if contract value is 0 or nil (prevents division by zero)

#### 2. Purchase Order Model (`/backend/app/models/purchase_order.rb`)
- **Added `after_save` callback**: Triggers profit recalculation when PO is created or updated
- **Added `after_destroy` callback**: Triggers profit recalculation when PO is deleted
- **Added `update_construction_profit` private method**: Safely updates parent construction's profit

**Auto-update Triggers:**
- Creating a new PO
- Updating PO line items (which changes the total)
- Deleting a PO
- Any change to PO `total` field

#### 3. Constructions Controller (`/backend/app/controllers/api/v1/constructions_controller.rb`)
- **Removed `live_profit` and `profit_percentage` from permitted params**: These are now calculated fields, not user-editable
- **Added comment explaining why they're excluded**: Documents the architectural decision

#### 4. Rake Task (`/backend/lib/tasks/backfill_profits.rake`)
- **Created `constructions:backfill_profits` task**: One-time task to calculate profits for existing data
- **Already executed**: All existing constructions have been updated
- **Usage**: `rails constructions:backfill_profits`

### Frontend Changes

#### 1. Active Jobs Page (`/frontend/src/pages/ActiveJobsPage.jsx`)
- **Made profit fields read-only**: Removed inline editing capability
- **Added tooltips**: Explain that values are auto-calculated with the formula
- **Visual distinction**: Fields are now clearly non-editable (no hover state for editing)

#### 2. Job Detail Page (`/frontend/src/pages/JobDetailPage.jsx`)
- **Converted inputs to read-only displays**: Show values in disabled-style boxes
- **Added "(Auto-calculated)" labels**: Clear indication that these are computed fields
- **Added formula explanations**: Help text below each field explains the calculation

## How It Works

### Calculation Flow
1. User creates/updates a Purchase Order with line items
2. PO's `calculate_totals` callback runs (existing), setting `sub_total`, `tax`, and `total`
3. PO's `after_save` callback fires `update_construction_profit`
4. Construction's `calculate_and_update_profit!` method:
   - Sums all PO totals using SQL: `purchase_orders.sum(:total)`
   - Calculates: `contract_value - po_total_sum`
   - Updates database columns with `update_columns` (skip callbacks for performance)
5. Whenever Construction is serialized to JSON, getters return fresh calculated values

### Data Integrity
- **Database columns are updated immediately** via callbacks
- **Getters always return fresh calculations** via method override
- **Even if DB is stale, API returns correct values** because getters compute on-the-fly
- **No N+1 queries**: Uses single SQL `SUM()` query

### Edge Cases Handled
- ✅ Construction with no POs: `live_profit = contract_value`
- ✅ Contract value is `nil`: Treated as 0, profit = `-sum(POs)`
- ✅ Contract value is 0: Profit percentage returns 0 (not error)
- ✅ Multiple POs updated simultaneously: Each triggers calculation correctly
- ✅ PO deleted: Profit recalculates without the deleted PO

## Testing

### Manual Testing Performed
1. ✅ Created construction with no POs → profit = contract value
2. ✅ Added first PO → profit decreased by PO total
3. ✅ Added second PO → profit decreased by both PO totals
4. ✅ Updated PO line items → profit recalculated immediately
5. ✅ Deleted PO → profit increased (PO no longer counted)
6. ✅ Set contract value to nil → profit = negative sum of POs, percentage = 0%
7. ✅ Verified database columns updated after each change
8. ✅ Verified API returns calculated values correctly

### Test Results
```
Final Integration Test
============================================================
Test 1: Existing Construction - Lot 1 (34) Tristania Street
  Contract: $363,000.00
  PO Count: 1
  PO Total: $1,900.00
  Live Profit: $361,100.00
  Profit %: 99.48%
  ✓ Calculation matches expectation

Test 2: New Construction (no POs yet)
  Contract: $250,000.00
  Live Profit: $250,000.00
  Profit %: 100.0%
  ✓ Profit = Contract Value

Test 3: Add PO and verify auto-update
  Created PO: $11,000.00
  Updated Live Profit: $239,000.00
  Updated Profit %: 95.6%
  ✓ Auto-update works

✓ All tests passed! Integration successful.
```

## API Examples

### GET /api/v1/constructions/:id
```json
{
  "id": 7,
  "title": "Example Construction",
  "contract_value": "363000.0",
  "live_profit": "361100.0",
  "profit_percentage": "99.48",
  "purchase_orders_count": 1,
  ...
}
```

The `live_profit` and `profit_percentage` fields are automatically included in all API responses and are always up-to-date.

## Future Enhancements

### Possible Improvements
1. **Filter by payment status**: Only count POs with certain statuses (e.g., exclude 'cancelled')
2. **Cache invalidation notifications**: WebSocket updates when profit changes
3. **Historical tracking**: Store profit snapshots over time for trend analysis
4. **Profit alerts**: Notify when profit drops below threshold
5. **Budget vs actual comparison**: Compare live profit to budgeted profit
6. **Forecasting**: Project future profit based on pending POs

### Performance Considerations
Current implementation is efficient for typical usage:
- Single SQL SUM query per calculation
- No N+1 queries
- Updates use `update_columns` to skip callbacks
- Calculations triggered only on PO changes

For very large datasets (>10,000 POs per construction):
- Consider moving calculation to background job
- Add database index on `purchase_orders.construction_id, purchase_orders.total`
- Cache calculated value with TTL

## Files Changed

### Backend
- `/backend/app/models/construction.rb` - Added calculation methods and getter overrides
- `/backend/app/models/purchase_order.rb` - Added callbacks to trigger recalculation
- `/backend/app/controllers/api/v1/constructions_controller.rb` - Removed editable params
- `/backend/lib/tasks/backfill_profits.rake` - Created backfill task

### Frontend
- `/frontend/src/pages/ActiveJobsPage.jsx` - Made profit fields read-only with tooltips
- `/frontend/src/pages/JobDetailPage.jsx` - Converted to display-only with formula hints

## Deployment Notes

### Backend
No migration required - uses existing database columns.

To deploy:
```bash
cd /Users/jakebaird/teeem
git add backend/
git commit -m "Implement automatic live profit calculation"
git subtree push --prefix backend heroku main
```

### Frontend
No API changes required - backend automatically returns calculated values.

To deploy:
```bash
cd /Users/jakebaird/teeem
git add frontend/
git commit -m "Make profit fields read-only (auto-calculated)"
git push origin main
```

Vercel will auto-deploy the frontend changes.

## Verification Steps

After deployment:
1. Open any construction in the UI
2. Verify profit fields show "(Auto-calculated)" label
3. Verify fields are not editable
4. Create a new PO with line items
5. Return to construction detail page
6. Verify profit decreased by PO total
7. Delete or update the PO
8. Verify profit recalculates correctly

---

**Implementation Date**: November 5, 2025
**Status**: ✅ Complete and Tested
**Deployed**: Backend deployed, frontend ready to deploy
