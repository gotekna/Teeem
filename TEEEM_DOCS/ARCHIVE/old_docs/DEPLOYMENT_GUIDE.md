# TEEEM Price Book - Production Deployment Guide

## Summary

Successfully imported and linked all EasyBuild data:
- **209 suppliers**
- **5,285 price book items**
- **3,626 price history records**

All data is properly linked and ready for production deployment with **ONE SIMPLE COMMAND**.

## What Changed

### Database Model
- Updated `PricebookItem` to allow negative prices (for rebates/credits)
- Migration already exists on production

### New Features
1. **Data Conversion Script** (`backend/lib/tasks/convert_easybuild_data.rake`)
   - Converts EasyBuild CSV exports to import format
   - Handles suppliers, items, and price histories
   - Groups price histories chronologically

2. **Production Deployment Script** (`backend/lib/tasks/deploy_production_data.rake`)
   - All CSV data included in repository at `backend/db/import_data/`
   - Clears existing data
   - Imports all suppliers, items, and price histories
   - Links all data correctly

3. **Price History Empty State** (Frontend)
   - Shows helpful message when no price history exists
   - Will display actual history once data is imported

## Deployment Steps

### ONE COMMAND DEPLOYMENT ✨

The CSV files are already in the GitHub repository and will auto-deploy to Heroku!

Just run:

```bash
heroku run rails pricebook:deploy_to_production --app teeemlive
```

That's it! The command will:
1. ✓ Clear existing price book data
2. ✓ Import all 209 suppliers
3. ✓ Import all 5,285 price book items (with supplier links)
4. ✓ Import all 3,626 price history records

### Expected Output

```
============================================================
DEPLOYING PRICE BOOK DATA TO PRODUCTION
============================================================

Step 1: Clearing existing data...
  ✓ Deleted X price history records
  ✓ Deleted X pricebook items
  ✓ Deleted X suppliers

Step 2: Importing suppliers...
  ✓ Imported 209 suppliers

Step 3: Importing price book items...
  ✓ Imported 5285 price book items

Step 4: Importing price history...
  ✓ Imported 3626 price history records

============================================================
DEPLOYMENT COMPLETE
============================================================
Suppliers: 209
Price Book Items: 5285
Price History: 3626

Data successfully deployed to production!
```

### Verify Data

After deployment, verify the data:

```bash
heroku run rails runner "puts 'Suppliers: ' + Supplier.count.to_s; puts 'Items: ' + PricebookItem.count.to_s; puts 'Histories: ' + PriceHistory.count.to_s" --app teeemlive
```

Expected output:
```
Suppliers: 209
Items: 5285
Histories: 3626
```

### View in Browser

Once deployed, visit https://teeem.vercel.app/price-books to see your complete price book with:
- All 5,285 items listed
- Risk scoring and status badges
- Clickable rows to view item details
- Full price history on each item detail page

## Important Notes

### Data Cleared on Import
The deployment task **deletes all existing** suppliers, price book items, and price histories before importing. This ensures a clean import with no duplicates.

### Negative Prices
The data includes some negative prices (e.g., "Rebate" items at -$25). This is intentional and now supported.

### Price History
Price histories are sorted chronologically and include old_price and new_price to show actual price changes over time.

### Suppliers
All suppliers are imported with default ratings (3/5) since the EasyBuild export doesn't include detailed supplier information. You can update these later through the UI.

## Testing Locally

The import has been tested locally and successfully loaded all data. You can test locally again with:

```bash
cd backend
bundle exec rails pricebook:deploy_to_production
```

## Files Reference

**Production Deployment Script:**
- `backend/lib/tasks/deploy_production_data.rake` - Single command deployment

**CSV Data Files (committed to git):**
- `backend/db/import_data/suppliers.csv` (209 suppliers)
- `backend/db/import_data/pricebook_items.csv` (5,285 items)
- `backend/db/import_data/price_history.csv` (3,626 histories)

**Conversion Script (for reference):**
- `backend/lib/tasks/convert_easybuild_data.rake`

**Documentation:**
- `backend/PRICEBOOK_IMPORT.md` - Detailed CSV format documentation

**Original EasyBuild Exports (not committed):**
- `easybuildapp development Price Books.csv`
- `easybuildapp development Price Histories.csv`
- `easybuildapp development Contacts-1.csv`

## Next Steps

1. Run the deployment command: `heroku run rails pricebook:deploy_to_production --app teeemlive`
2. Wait 2-3 minutes for import to complete
3. Verify data counts match expected values
4. Visit https://teeem.vercel.app/price-books
5. Click on any item to see the detail page with full price history

All 3,626 price history records will now be displayed on their respective item detail pages! 🎉
