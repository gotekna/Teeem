# Plan: Job Address Extraction and Geocoding

## Overview
Extract addresses from job titles, geocode them to get lat/lng, and standardize job titles to include house/lot numbers with the address.

## Current State
- Jobs have `title`, `location`, `latitude`, `longitude` fields
- All jobs currently have `nil` for location/lat/lng
- Job titles follow patterns like:
  - `XC 15-16 Esther` (prefix-lotNumber Address)
  - `101-7 Wategos Street` (jobNumber-houseNumber Street)
  - `XC KIT 06/25 - 89 - 464 Chelsea Road` (prefix - number - houseNumber Street)
  - `KIT - Complete` (no address - skip these)
- **Mapbox already configured** in frontend (`frontend/src/utils/mapboxGeocoding.js`)
- Free tier: 100,000 requests/month

## Implementation Steps

### Step 1: Create JobAddressService
A service to:
1. **Parse job title** to extract:
   - Job prefix (e.g., "XC", "KIT", "XC KIT 06/25")
   - House/Lot number
   - Street address
2. **Build search address** by appending ", QLD Australia" for geocoding
3. **Geocode address** using Mapbox Geocoding API (already have token)
4. **Return structured data** with address components and coordinates

### Step 2: Add Mapbox Geocoding to Backend
- Use existing Mapbox token (need to add `MAPBOX_ACCESS_TOKEN` to backend Heroku config)
- Bias results towards Brisbane/SE QLD
- Fall back to "South East QLD, Australia" if address unclear

### Step 3: Create Rake Task
- `jobs:geocode_all` - Process all jobs
- `jobs:geocode_preview` - Preview without saving
- `jobs:geocode[job_id]` - Process single job

### Step 4: Title Standardization Rules
Transform titles to consistent format:
- **Input**: `XC 15-16 Esther`
- **Output**: `XC-15 | 16 Esther Street, Suburb QLD 4XXX`

Format: `{PREFIX}-{JOB#} | {HOUSE#} {STREET}, {SUBURB} {STATE} {POSTCODE}`

### Step 5: Database Updates
Update Job record with:
- `location` - Full formatted address from Google
- `latitude` - Decimal coordinate
- `longitude` - Decimal coordinate
- `title` - Standardized title (optional - confirm with user)

## Title Parsing Patterns

| Current Title | Extracted Address | Prefix | Job# | House# |
|--------------|-------------------|--------|------|--------|
| `XC 15-16 Esther` | 16 Esther | XC | 15 | 16 |
| `101-7 Wategos Street` | 7 Wategos Street | - | 101 | 7 |
| `XC KIT 06/25 - 89 - 464 Chelsea Road` | 464 Chelsea Road | XC KIT 06/25 | 89 | 464 |
| `50 - L513 Hickory` | L513 Hickory | - | 50 | L513 |
| `KIT - Complete` | (skip - no address) | - | - | - |

## API Requirements
- **Mapbox Geocoding API** (already have token in frontend)
- Need to copy `MAPBOX_ACCESS_TOKEN` to backend Heroku config
- Region bias to Brisbane/SE QLD (proximity: 153.0251,-27.4698)
- Free tier: 100,000 requests/month

## User Decisions
1. **Update job titles** - YES, standardize to format like `XC-15 | 16 Esther St, Suburb QLD`
2. **API** - Use existing Mapbox (not Google Maps)

## Files to Create/Modify
1. `backend/app/services/job_address_service.rb` - Main service with title parsing and Mapbox integration
2. `backend/lib/tasks/job_address.rake` - Rake tasks for batch processing
3. `backend/app/models/job.rb` - Add helper methods

## Execution Summary

### Phase 1: Setup
- Copy Mapbox token to backend Heroku config

### Phase 2: Create Service
- Parse job title patterns
- Call Mapbox API to geocode
- Return structured address + coordinates

### Phase 3: Rake Tasks
- Preview mode to show what would change
- Apply mode to update jobs
- Support single job processing

### Phase 4: Run
- Preview all jobs first
- Apply changes
- Verify in UI
