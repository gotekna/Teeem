# Single Source of Truth - Column Type System

## Overview

**Trinity T19.001-T19.021 is the SINGLE SOURCE OF TRUTH** for all column type definitions.

See **Bible Rule #19.37** for the authoritative rule.

## The Hierarchy

```
Trinity T19.001-T19.021 (SSoT - RULES)
    │
    │ Defines: SQL type, validation rules, examples, usage
    │
    ├──► columns table (Table ID 1) - IMPLEMENTATION
    │    Must match Trinity rules
    │
    ├──► gold_standard_items - PROOF
    │    Sample data demonstrating each type
    │
    └──► Frontend COLUMN_TYPES - CACHE/FALLBACK ONLY
         Reads from API, never edited directly
```

## What Each Source Contains

### Trinity T19.001-T19.021 (Source of Truth)

- **Location:** `trinities` table, category=teacher, chapter=19
- **Access:** `GET /api/v1/trinity?category=teacher&chapter_number=19`
- **Contains:** SQL type, validation rules, examples, usage description
- **Edit via:** Trapid UI → Documentation page

### columns table (Implementation)

- **Location:** `columns` table where `table_id = 1` (Gold Standard)
- **Access:** `GET /api/v1/column_types`
- **Contains:** column_name, column_type, max_length, required, etc.
- **Must match:** Trinity rules

### gold_standard_items (Proof)

- **Location:** `gold_standard_items` table
- **Access:** `GET /api/v1/gold_standard_items`
- **Contains:** Sample data for each column type
- **Purpose:** Demonstrates column types work correctly

### Frontend COLUMN_TYPES (Cache Only)

- **Location:** `frontend/src/constants/columnTypes.js`
- **Purpose:** Fallback when API unavailable, cached for performance
- **NEVER edit as source** - it reads from API

## Maintenance Process

### Adding a New Column Type

1. **Create Trinity Entry**
   - Go to Trapid UI → Documentation page
   - Add new Teacher entry in Chapter 19
   - Section: T19.022 (next available number)
   - Include: SQL type, validation rules, examples, usage

2. **Update Gold Standard Table**
   - Add column to columns table (Table ID 1)
   - Column type must match Trinity entry

3. **Add Sample Data**
   - Add sample value to gold_standard_items

4. **Update Backend** (if needed)
   - Add to `Column::COLUMN_TYPE_MAP` in `backend/app/models/column.rb`
   - This maps type to Rails type for migrations

5. **Verify Sync**
   - Run `gold-standard-sst` agent
   - Fix any mismatches reported

### Updating Validation Rules

1. **Edit Trinity Entry**
   - Update T19.xxx description with new rules

2. **Update columns table** (if structural)
   - Update max_length, min_value, etc.

3. **Verify Sync**
   - Run `gold-standard-sst` agent

### Verifying Sync

Run the agent:
```bash
# Via Claude Code
/run gold-standard-sst

# Or check Sync tab in UI
http://localhost:5173/admin/system?tab=gold-standard-sync
```

## What NOT to Do

**NEVER edit `frontend/src/constants/columnTypes.js` as source**
- It's a cache/fallback only
- Changes will be overwritten by API reads

**NEVER hardcode column types in controllers**
- Read from `Column::COLUMN_SQL_TYPE_MAP` or API
- No duplicate maps in code

**NEVER skip Trinity when adding types**
- Trinity is the source of truth
- Everything else derives from it

**NEVER assume sources are in sync**
- Run agent to verify
- Fix drift immediately

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/column_types` | Get all column types from Gold Standard |
| `GET /api/v1/trinity?category=teacher&chapter_number=19` | Get Trinity entries |
| `GET /api/v1/gold_table_sync` | Check sync status across all sources |
| `GET /api/v1/gold_standard_items` | Get sample data |

## Agent: gold-standard-sst

The `gold-standard-sst` agent validates:

- Trinity T19.xxx entries are complete (SQL type, validation, examples, usage)
- columns table (Table ID 1) matches Trinity rules
- gold_standard_items has valid samples for each type
- No hardcoded duplicates in code
- Frontend COLUMN_TYPES is marked as cache/fallback only

## Helper Functions (Frontend)

The frontend provides helper functions that read from the cached/fallback data:

```javascript
import {
  COLUMN_TYPES,           // Cache/fallback array
  getColumnTypeLabel,     // Get display label
  getColumnTypeIcon,      // Get HeroIcon component
  getColumnTypeEmoji,     // Get emoji icon
  getColumnTypesByCategory,
  getColumnCategories,
  getColumnTypesWithCache // Fetches from API with caching
} from '../../constants/columnTypes'
```

**Important:** These read from cache. The source of truth is Trinity.

---

**Last Updated:** 2025-11-22
**Status:** Trinity is Single Source of Truth
**Bible Rule:** #19.37
**Agent:** gold-standard-sst
