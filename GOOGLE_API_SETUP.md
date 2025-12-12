# Google Custom Search API Setup

This guide shows how to set up Google Custom Search API for fetching product images.

## Step 1: Get Google Custom Search API Key

1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Create a new project or select an existing one
3. Enable the **Custom Search API**:
   - Go to **APIs & Services** → **Library**
   - Search for "Custom Search API"
   - Click **Enable**
4. Create credentials:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **API Key**
   - Copy the API key

## Step 2: Create a Programmable Search Engine

1. Go to [Programmable Search Engine](https://programmablesearchengine.google.com/)
2. Click **Add** to create a new search engine
3. Settings:
   - **Sites to search**: `www.google.com` (or leave blank to search entire web)
   - **Name**: "Product Image Search" (or any name)
   - **Image search**: Turn ON
4. Click **Create**
5. Copy the **Search engine ID** (also called CX)

## Step 3: Set Environment Variables on Heroku

For **teeem-sam-dev**:
```bash
heroku config:set GOOGLE_SEARCH_API_KEY=your_api_key_here --app teeem-sam-dev
heroku config:set GOOGLE_CX=your_search_engine_id_here --app teeem-sam-dev
```

For **teeemlive** (production):
```bash
heroku config:set GOOGLE_SEARCH_API_KEY=your_api_key_here --app teeemlive
heroku config:set GOOGLE_CX=your_search_engine_id_here --app teeemlive
```

## Step 4: Verify Configuration

```bash
heroku config --app teeem-sam-dev | grep GOOGLE
```

Should show:
```
GOOGLE_CX:                your_cx_id
GOOGLE_SEARCH_API_KEY:    your_api_key
```

## Step 5: Run the Rake Task

```bash
# Test with a few items first
heroku run --app teeem-sam-dev "cd backend && rake pricebook:fetch_plumbing_fitoff_images"
```

## What Happens

1. **Searches Google Images** - Uses your API key to search for product images
2. **Claude AI Selection** - Analyzes images and picks the best one (if ANTHROPIC_API_KEY is set)
3. **Downloads Image** - Downloads the selected image temporarily
4. **Uploads to SharePoint** - Uploads to `Warehousing/Photo Test` folder
5. **Updates Database** - Marks item as `image_fetch_status: 'fetched_to_test_folder'`

## Cost

- **Google Custom Search API**: Free tier includes 100 queries/day
- **Anthropic API**: Already configured (uses existing key)

## Test Folder Location

Images are uploaded to:
`SharePoint → TEEEM Site → Shared Documents → Warehousing → Photo Test`

You can review them there before moving to the main `Pricebook Photos` folder.

## Troubleshooting

**"No images found"**
- Check API key is valid
- Check CX (search engine ID) is correct
- Verify API is enabled in Google Cloud Console

**"Failed to upload to SharePoint"**
- Check Organization Microsoft App credentials are connected
- Verify permissions include `Sites.ReadWrite.All`

**Rate limits**
- Free tier: 100 queries/day
- Paid tier: 10,000 queries/day ($5 per 1,000 queries)