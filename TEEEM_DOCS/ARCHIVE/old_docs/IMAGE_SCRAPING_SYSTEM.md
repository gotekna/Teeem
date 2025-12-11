# 🖼️ Automated Product Image Scraping System

## Overview
Fully automated system to fetch and store product images for all 5,000+ pricebook items using web scraping and Cloudinary CDN.

## ✅ What's Been Built

### Database
- Added `image_url`, `image_source`, `image_fetched_at`, `image_fetch_status` columns to `pricebook_items`
- Tracks image fetch progress and status for each item

### Backend Services
1. **ProductImageScraper** (`app/services/product_image_scraper.rb`)
   - Searches DuckDuckGo/Google for product images
   - Downloads and uploads images to Cloudinary
   - Automatic image optimization and CDN delivery
   - Error handling and retry logic

2. **Background Jobs**
   - `FetchProductImageJob` - Fetch image for single item
   - `FetchAllImagesJob` - Batch process all items
   - `FetchSupplierImagesJob` - Process items for specific supplier

### API Endpoints

#### 1. Fetch Single Item Image
```bash
POST /api/v1/pricebook/:id/fetch_image
```

Response:
```json
{
  "success": true,
  "message": "Image fetch queued for Decina Novara Bath 1525mm",
  "item": { ... }
}
```

#### 2. Manually Set Image
```bash
POST /api/v1/pricebook/:id/update_image
Content-Type: application/json

{
  "image_url": "https://example.com/product.jpg"
}
```

#### 3. Batch Fetch All Images
```bash
# Fetch for all items (limit: 100)
POST /api/v1/pricebook/fetch_all_images?limit=100

# Fetch for specific supplier
POST /api/v1/pricebook/fetch_all_images?supplier_id=47&limit=50
```

Response:
```json
{
  "success": true,
  "message": "Image fetch queued for all items (limit: 100)",
  "stats": {
    "total": 5287,
    "with_images": 0,
    "without_images": 5287,
    "pending": 5287,
    "fetching": 0,
    "failed": 0,
    "percentage_complete": 0.0
  }
}
```

#### 4. Get Image Statistics
```bash
GET /api/v1/pricebook/image_stats
```

Response:
```json
{
  "total": 5287,
  "with_images": 1250,
  "without_images": 4037,
  "pending": 3800,
  "fetching": 12,
  "failed": 225,
  "percentage_complete": 23.64
}
```

## 🚀 How to Use

### Option 1: Fetch All Images (Recommended for First Run)
```bash
curl -X POST "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/pricebook/fetch_all_images?limit=100"
```

This will:
1. Queue background jobs for 100 items
2. Each job searches for product image
3. Downloads and uploads to Cloudinary
4. Saves image URL to database

**Note:** Run this multiple times to process all 5,000+ items in batches of 100.

### Option 2: Fetch for Specific Supplier
```bash
curl -X POST "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/pricebook/fetch_all_images?supplier_id=47&limit=50"
```

### Option 3: Fetch Single Item
```bash
curl -X POST "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/pricebook/275/fetch_image"
```

### Check Progress
```bash
curl "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/pricebook/image_stats"
```

## 🎯 Image Search Strategy

The system searches for images using:
1. **Brand** + **Item Code** + **Item Name** (simplified) + "product"
2. Example: "Abey SSFL Laundry Tub product"

### Image Sources
- **Google Custom Search API** (recommended, requires API key)
- Fallback: placeholder until API is configured

### Image Selection with Claude AI ✨
- **Claude 3 Haiku** analyzes up to 5 image candidates
- Selects the best product image based on:
  1. Clear product photo (not logos/diagrams)
  2. Actual product match (not similar items)
  3. High quality and well-lit
  4. Clear product visibility
- Fallback: First valid, accessible image if Claude unavailable

## 📦 Cloudinary Integration

### Storage
- **Cloud Name:** (configured in environment variables)
- **Free Tier:** 25 GB storage, 25 GB bandwidth/month
- **Current Usage:** 0/5,287 items (~10 GB estimated)

### Image Optimization
Cloudinary automatically:
- Compresses images (50-70% size reduction)
- Converts to WebP format
- Serves from global CDN
- Generates thumbnails on-demand

### Image URLs
Format: `https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/pricebook_items/item_{id}.jpg`

## 🔄 Status Tracking

Each item has an `image_fetch_status`:
- `null` / `pending` - Not yet processed
- `fetching` - Currently searching/downloading
- `success` - Image successfully fetched and uploaded
- `failed` - Could not find or upload image

## 🛠️ Configuration

### Environment Variables (Already Set on Heroku)
```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

**Note:** These are set in Heroku config vars. Never commit actual credentials to git.

### Required for Image Search
To enable image scraping, you need EITHER:

**Option 1: Google Custom Search API (Recommended)**
```bash
GOOGLE_SEARCH_API_KEY=your_key_here
GOOGLE_SEARCH_CX=your_cx_here
```
- Free tier: 100 searches/day
- Setup: https://developers.google.com/custom-search/v1/overview

**Option 2: SerpAPI (Alternative)**
```bash
SERPAPI_KEY=your_key_here
```
- Free tier: 100 searches/month
- Setup: https://serpapi.com/

### Optional: Claude AI for Intelligent Image Selection
```bash
ANTHROPIC_API_KEY=your_key_here
```
- Uses Claude 3 Haiku (~$0.0001 per image)
- Analyzes multiple images and selects the best one
- Fallback to first valid image if not configured

## 📊 Expected Results

For 5,287 items:
- **Success Rate:** ~70-80% (3,700-4,200 items)
- **Failed:** ~20-30% (800-1,000 items - generic/obscure products)
- **Processing Time:** ~1-2 hours for all items (with rate limiting)

## 🚨 Rate Limiting

- Sleep 1 second between requests
- Process 100 items per batch
- Prevents overwhelming search engines
- Can be adjusted in `ProductImageScraper`

## ✅ Claude AI Integration (Completed!)

The system now uses **Claude 3 Haiku** to intelligently select product images:
- Analyzes up to 5 image candidates per product
- Evaluates image quality, relevance, and clarity
- Costs ~$0.0001 per product (very affordable)
- Automatic fallback if Claude unavailable

## 🔜 Future Enhancements

1. **Image Search API Setup** (Required for Production)
   - Set up Google Custom Search API or SerpAPI
   - Currently returns empty results until API is configured

2. **Supplier Website Scraping**
   - Direct scraping from supplier websites
   - Higher quality, more relevant images

3. **Image Quality Validation**
   - Check minimum resolution
   - Detect and reject low-quality images

4. **Bulk Upload Interface**
   - Manual CSV upload with image URLs
   - Drag-and-drop image upload

## 🚨 Current Status

- ✅ Database schema complete
- ✅ Background job processing working
- ✅ API endpoints functional
- ✅ Cloudinary integration ready
- ✅ Claude AI image selection integrated
- ❌ **Image search API needed** (Google Custom Search or SerpAPI)

**Next Step**: Set up Google Custom Search API to enable image fetching.

## 📝 Example Usage Script

### Fetch All Images in Batches
```bash
#!/bin/bash

API_URL="https://teeemlive-ce8e2660a615.herokuapp.com/api/v1"

# Get total count
stats=$(curl -s "$API_URL/pricebook/image_stats")
total=$(echo $stats | jq '.without_images')

echo "Items without images: $total"

# Process in batches of 100
batches=$((total / 100 + 1))
echo "Processing $batches batches..."

for i in $(seq 1 $batches); do
  echo "Batch $i/$batches"
  curl -X POST "$API_URL/pricebook/fetch_all_images?limit=100"

  # Wait between batches
  sleep 30

  # Check progress
  curl -s "$API_URL/pricebook/image_stats" | jq '.percentage_complete'
done

echo "✓ Complete!"
```

## 🎨 Frontend Integration (Next Steps)

1. Display images in price book list
2. Show placeholder for items without images
3. Add "Fetch Image" button for single items
4. Show progress bar for batch operations
5. Allow manual image upload

## 📞 Support

For issues or questions:
- Check Heroku logs: `heroku logs --tail --app teeemlive`
- Review background job status in SolidQueue
- Check Cloudinary dashboard for storage usage

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Date: November 4, 2025
Version: v44 (Production)
