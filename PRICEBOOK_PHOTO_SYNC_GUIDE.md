# Pricebook Photo Sync Guide

## Overview

This system automatically links photos from SharePoint (`Warehousing/Pricebook Photos` folder) to pricebook items in the database.

## What Was Built

### 1. Service: `PricebookPhotoSyncService`
Location: `backend/app/services/pricebook_photo_sync_service.rb`

**Features:**
- Connects to TEEEM SharePoint site
- Fetches all photos from `Warehousing/Pricebook Photos` folder (200+ images)
- Matches photos to pricebook items using multiple strategies
- Updates `image_url`, `image_source`, `image_fetched_at`, and `image_fetch_status` fields

**Matching Strategies:**

1. **Exact Code Match** (Highest confidence)
   - Example: `"AIRSI25.png"` → item with `item_code: "AIRSI25"`

2. **Fuzzy Name Match** (Medium confidence)
   - Example: `"Bosch 60cm Oven.png"` → item with name containing "Bosch 60cm Oven"
   - Uses Jaccard similarity (70% threshold)

3. **Brand Match** (Lowest confidence)
   - Example: `"Alder Basin Mixer.png"` → items where brand = "Alder"
   - Only matches if there's exactly one item with that brand

### 2. Rake Tasks
Location: `backend/lib/tasks/pricebook.rake`

#### Task 1: `rake pricebook:sync_photos`
**Purpose:** Sync photos from SharePoint to database

**Usage:**
```bash
# Dry run (preview changes without updating database)
rake pricebook:sync_photos

# Live run (actually update the database)
rake pricebook:sync_photos DRY_RUN=false
```

**Output:**
- Total photos found
- Match statistics by strategy
- Confidence levels breakdown
- Sample matches
- Items updated count

#### Task 2: `rake pricebook:photo_stats`
**Purpose:** Show current photo statistics without making changes

**Usage:**
```bash
rake pricebook:photo_stats
```

**Output:**
- Total active items
- Items with/without images
- Image sources breakdown
- Potential improvements from sync

## How to Use

### Step 1: Deploy the Code
The code needs to be deployed to production before you can run it.

### Step 2: Preview What Will Happen (Dry Run)
```bash
heroku run --app teeem-sam-dev "rake pricebook:sync_photos"
```

This will show you:
- How many photos will be matched
- Which items will be updated
- Confidence levels for each match

### Step 3: Apply the Changes
Once you're happy with the preview:
```bash
heroku run --app teeem-sam-dev "rake pricebook:sync_photos DRY_RUN=false"
```

### Step 4: Verify Results
Check the pricebook in the UI to see the images now linked to items.

## SharePoint Folder Structure

```
TEEEM SharePoint Site
└── Documents
    └── Warehousing
        ├── Bank Statements
        └── Pricebook Photos  ← 200+ product images
            ├── Alder Basin Mixer Chrome.png
            ├── Bosch 60cm Oven.png
            ├── Decina Bath 1525mm.png
            └── ... (200+ more)
```

**SharePoint URL:**
https://gotekna.sharepoint.com/sites/TEEEM/Shared%20Documents/Warehousing/Pricebook%20Photos

## Database Schema

The pricebook table already has these columns (no migration needed):
- `image_url` - The SharePoint web URL for the image
- `image_source` - Set to "sharepoint"
- `image_fetched_at` - Timestamp of when the image was linked
- `image_fetch_status` - "success" when linked

## Example Matches

Based on the 200+ photos found:

| Photo Filename | Matches To | Strategy |
|----------------|-----------|----------|
| `Bosch 60cm 4 Burner Gas on Glass Cooktop.png` | Item with similar name | Fuzzy Name Match |
| `Alder Tapware Soho Basin Mixer Chrome.png` | Alder tapware item | Fuzzy Name Match |
| `Decina Carina Bath 1525mm White.png` | Decina bath item | Fuzzy Name Match |
| `ACL CP-F0434-0 Swivel Bath Spout.png` | ACL item code | Exact Code Match (if exists) |

## Photo Categories in SharePoint

The folder contains photos for:
- **Plumbing:** Sinks, taps, basins, baths, showers
- **Tapware:** Alder, Arcisan, ACL brands
- **Kitchen Appliances:** Bosch ovens, cooktops, dishwashers, rangehoods
- **Building Materials:** Flooring, finishes, surfaces
- **Electrical:** Downlights, fans, light fittings
- **Bathroom Accessories:** Towel rails, toilet roll holders, shelves
- **Water Heaters:** Heat pumps
- **Doors:** B&D, Corinthian

## Troubleshooting

### Photos Not Matching?
The matching algorithm relies on filename similarity to item names. If photos aren't matching:

1. Check the item name in the database
2. Check the photo filename in SharePoint
3. Adjust the matching logic in `PricebookPhotoSyncService` if needed

### Missing Photos?
The service fetches up to 500 photos. If more exist, adjust the `top` parameter in the service.

### Wrong Matches?
Review the confidence levels. You can:
- Increase the similarity threshold (currently 0.7 = 70%)
- Manually update specific items in the database
- Improve item names to better match photo filenames

## Next Steps

1. **Deploy** the new service and rake tasks
2. **Run dry run** to preview matches
3. **Apply changes** when satisfied
4. **Monitor** the pricebook UI to see linked images
5. **Iterate** on matching logic if needed

## Maintenance

### Adding New Photos to SharePoint
1. Upload photos to `Warehousing/Pricebook Photos` folder
2. Run `rake pricebook:sync_photos` to link them

### Updating Existing Photos
1. Replace photo in SharePoint (keep same filename)
2. Run `rake pricebook:sync_photos` to update URLs

### Checking Sync Status
Run `rake pricebook:photo_stats` anytime to see current state.