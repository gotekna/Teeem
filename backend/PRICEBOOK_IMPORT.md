# Price Book Import Guide

This guide explains how to import clean price book data (suppliers, items, and price history) into the system.

## Overview

The import script will:
1. **Clear existing data** - Delete all current suppliers, price book items, and price history
2. **Import suppliers** - Load supplier data with contact information and ratings
3. **Import price book items** - Load items and link them to suppliers by name
4. **Import price history** - Load historical price changes linked to items and suppliers

## CSV File Formats

### 1. Suppliers CSV (`suppliers.csv`)

**Required columns:**
- `name` - Supplier name (must be unique)
- `contact_person` - Contact name
- `email` - Email address
- `phone` - Phone number
- `address` - Physical address
- `rating` - Rating (0-5)
- `response_rate` - Response rate percentage (0-100)
- `avg_response_time` - Average response time in hours
- `notes` - Additional notes
- `is_active` - Active status (true/false)

**Example:**
```csv
name,contact_person,email,phone,address,rating,response_rate,avg_response_time,notes,is_active
TL Supply,John Smith,john@tlsupply.com.au,1300 123 456,123 Trade St Sydney,4,85.5,24,Reliable electrical supplier,true
Bunnings,Trade Desk,trade@bunnings.com.au,1300 BUNNINGS,456 Builder Ave,5,95.0,12,Hardware store,true
```

### 2. Price Book Items CSV (`pricebook_items.csv`)

**Required columns:**
- `item_code` - Unique item code
- `item_name` - Item description
- `category` - Category (e.g., Electrical, Plumbing)
- `unit_of_measure` - Unit (e.g., Each, Linear Metre, m²)
- `current_price` - Current price (decimal)
- `supplier_name` - Supplier name (must match name in suppliers.csv)
- `brand` - Brand name
- `notes` - Additional notes
- `is_active` - Active status (true/false)
- `needs_pricing_review` - Needs review flag (true/false)
- `price_last_updated_at` - Last price update date (YYYY-MM-DD)

**Example:**
```csv
item_code,item_name,category,unit_of_measure,current_price,supplier_name,brand,notes,is_active,needs_pricing_review,price_last_updated_at
DPP,Wiring Double Power Point,Electrical,Each,51.00,TL Supply,Clipsal,,true,false,2024-01-15
SPP,Wiring Single Power Point,Electrical,Each,50.00,TL Supply,Clipsal,,true,false,2024-01-15
TIMBER-90x45,Pine Framing Timber 90x45mm,Carpentry,Linear Metre,8.50,Bunnings,Treated Pine,,true,false,2024-02-01
```

### 3. Price History CSV (`price_history.csv`) - Optional

**Required columns:**
- `item_code` - Item code (must match item_code in pricebook_items.csv)
- `old_price` - Previous price
- `new_price` - New price
- `change_reason` - Reason for change (e.g., price_increase, supplier_change)
- `supplier_name` - Supplier name (must match name in suppliers.csv)
- `quote_reference` - Quote reference number
- `created_at` - Date of change (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)

**Example:**
```csv
item_code,old_price,new_price,change_reason,supplier_name,quote_reference,created_at
DPP,48.00,51.00,price_increase,TL Supply,Q-2024-001,2024-01-15
DPP,51.00,53.00,price_increase,TL Supply,Q-2024-045,2024-03-20
TIMBER-90x45,7.50,8.50,material_cost_increase,Bunnings,Q-2024-023,2024-02-01
```

## How to Use

### Step 1: Generate Templates (Optional)

To generate sample CSV templates:

```bash
bundle exec rails pricebook:generate_templates
```

This creates three template files in `backend/tmp/`:
- `suppliers_template.csv`
- `pricebook_items_template.csv`
- `price_history_template.csv`

### Step 2: Prepare Your CSV Files

Place your CSV files in `backend/tmp/`:
- `backend/tmp/suppliers.csv`
- `backend/tmp/pricebook_items.csv`
- `backend/tmp/price_history.csv` (optional)

### Step 3: Run the Import Locally

```bash
cd backend
bundle exec rails pricebook:import_clean
```

### Step 4: Run the Import on Production (Heroku)

First, upload your CSV files to the Heroku dyno:

```bash
# Create a temporary directory on Heroku
heroku run bash --app teeemlive
mkdir -p tmp
exit

# Copy CSV files to Heroku (you'll need to use a different method)
# Option 1: Add files to git temporarily and deploy
# Option 2: Use Heroku's data import feature
# Option 3: Store files in S3 and download them in the task
```

**Recommended approach for production:**

1. Store CSV files in a secure location (S3, Google Drive, etc.)
2. Download them to the Heroku dyno's tmp directory
3. Run the import task

Or manually copy/paste the content:

```bash
heroku run bash --app teeemlive

# In the Heroku shell:
cat > tmp/suppliers.csv << 'EOF'
name,contact_person,email,phone,address,rating,response_rate,avg_response_time,notes,is_active
[paste your suppliers data here]
EOF

cat > tmp/pricebook_items.csv << 'EOF'
item_code,item_name,category,unit_of_measure,current_price,supplier_name,brand,notes,is_active,needs_pricing_review,price_last_updated_at
[paste your items data here]
EOF

cat > tmp/price_history.csv << 'EOF'
item_code,old_price,new_price,change_reason,supplier_name,quote_reference,created_at
[paste your history data here]
EOF

# Run the import
bundle exec rails pricebook:import_clean

# Exit the shell
exit
```

## Important Notes

1. **Data will be deleted**: The script deletes ALL existing suppliers, price book items, and price history before importing
2. **Supplier names must match**: The `supplier_name` in price book items and price history must exactly match the `name` in suppliers.csv
3. **Item codes must match**: The `item_code` in price history must exactly match the `item_code` in pricebook_items.csv
4. **Price history is optional**: If you don't have price history, the script will skip it
5. **Backup first**: Always backup your production data before running this on production

## Troubleshooting

**Error: "Suppliers file not found"**
- Make sure the CSV file is in `backend/tmp/suppliers.csv`
- Or set the environment variable: `SUPPLIERS_CSV=/path/to/file.csv`

**Error: "Validation failed"**
- Check that required fields are filled in
- Ensure item_code and supplier name are unique
- Verify supplier names match exactly between files

**Price history not importing**
- Check that item_code values match exactly with pricebook_items.csv
- Verify supplier_name values match exactly with suppliers.csv
- Check date format is YYYY-MM-DD or YYYY-MM-DD HH:MM:SS

## Example Import Output

```
============================================================
PRICE BOOK CLEAN IMPORT
============================================================

Step 1: Clearing existing data...
  ✓ Deleted 0 price history records
  ✓ Deleted 10 pricebook items
  ✓ Deleted 3 suppliers

Step 2: Importing suppliers...
  ✓ Imported 5 suppliers

Step 3: Importing price book items...
  ✓ Imported 150 price book items

Step 4: Importing price history...
  ✓ Imported 45 price history records

============================================================
IMPORT COMPLETE
============================================================
Suppliers: 5
Price Book Items: 150
Price History: 45

Data successfully imported and linked!
```
