# TEEEM Knowledge Base

> **For AI Assistants:** This document contains comprehensive information about the TEEEM project - a custom Airtable/Rapid Platform replacement for construction management. Use this to understand the project's architecture, current status, and technical decisions.

---

## Project Overview

**Project Name:** TEEEM (Tekna + Rapid)

**What It Is:** A custom-built database application builder (like Airtable/Rapid Platform) specifically designed for construction management, with a focus on spreadsheet imports and dynamic table creation.

**Why It Exists:** Replacing Rapid Platform which is shutting down. Need to migrate all construction data and workflows to a self-hosted solution with full control.

**Primary Use Case:** Construction company (Tekna) managing projects, estimates, price books, suppliers, jobs, and related construction data.

---

## Tech Stack

### Backend (Heroku)
- **Framework:** Ruby on Rails 8 (API mode)
- **Database:** PostgreSQL
- **Background Jobs:** Solid Queue
- **File Processing:** Roo (Excel/CSV parsing), Caxlsx (Excel generation)
- **Formula Engine:** Dentaku gem (safe mathematical expression evaluation)
- **Deployment:** Heroku (currently v38)
- **URL:** https://teeemlive-ce8e2660a615.herokuapp.com

### Frontend (Vercel)
- **Framework:** React 18 (standalone SPA)
- **Styling:** Tailwind CSS
- **HTTP Client:** Axios
- **Routing:** React Router v6
- **Icons:** Heroicons
- **Deployment:** Vercel production
- **URL:** https://frontend-6x3wgl3mi-jakes-projects-b6cf0fcb.vercel.app

### Architecture
- **Pattern:** API-only backend + React SPA frontend
- **Communication:** REST API with JSON
- **CORS:** Configured for Vercel domain
- **File Storage:** Database-backed (for cross-dyno access on Heroku)

---

## Core Concepts

### 1. Dynamic Tables
Unlike traditional databases where schema is fixed at development time, TEEEM creates actual PostgreSQL tables at runtime based on user input.

**How it works:**
- User uploads CSV/Excel or manually creates table
- System generates database migration on the fly
- Creates actual PostgreSQL table (e.g., `table_projects_123`)
- Creates dynamic ActiveRecord model class at runtime
- All CRUD operations work like normal Rails models

**Database Tables:**
- `tables` - Metadata about user-created tables
- `columns` - Column definitions for each table
- `table_*` - Actual data tables created dynamically

### 2. Column Types
Supports 26+ column types similar to Airtable:

**Text Types:**
- `single_line_text` - Short text (VARCHAR)
- `multi_line_text` - Long text (TEXT)
- `email` - Email with validation
- `phone` - Phone number
- `url` - URL with validation

**Number Types:**
- `number` - Decimal numbers
- `currency` - Money with $ formatting
- `percentage` - 0-100 with % display
- `whole_number` - Integers only
- `rating` - Star ratings

**Date/Time Types:**
- `date` - Date only
- `date_and_time` - DateTime with timezone
- `duration` - Time duration

**Relationship Types:**
- `lookup` - Foreign key to another table (one-to-many)
- `multiple_lookup` - Many-to-many relationships
- `lookup_field` - Display field from related record

**Computed Types:**
- `formula` - Mathematical expressions with field references
- `rollup` - Aggregate data from related records
- `count` - Count related records

**Special Types:**
- `boolean` - True/False checkbox
- `single_select` - Dropdown with options
- `multiple_select` - Multi-select dropdown
- `attachment` - File uploads
- `user` - Reference to user account
- `autonumber` - Auto-incrementing ID
- `created_time` - Timestamp when created
- `last_modified_time` - Timestamp of last edit
- `created_by` - User who created record
- `last_modified_by` - User who last edited

### 3. Formula Fields
**Implementation:** Uses Dentaku gem for safe expression evaluation

**Syntax:**
```
{Field Name} * {Other Field}
({Price} + {Tax}) * {Quantity}
{Amount} * 0.1
```

**How it works:**
1. Formula stored in `column.settings[:formula]`
2. Not stored in database - computed on read
3. FormulaEvaluator service processes expressions
4. Replaces `{Field Name}` with actual values
5. Evaluates using Dentaku (no eval() - secure)
6. Returns computed value

**Example:**
- Formula: `{Price} * {Quantity}`
- Record: `{ price: 100, quantity: 5 }`
- Result: `500`

### 4. Type Detection
When importing spreadsheets, system automatically detects column types by analyzing data patterns:

**Detection Logic:**
- Sample first 100 non-empty rows
- Check for patterns:
  - All numeric → Number or Currency
  - Contains @ → Email
  - Date patterns → Date or DateTime
  - true/false patterns → Boolean
  - Everything else → Text
- Confidence score (if < 80%, default to Text)

**Service:** `TypeDetector` class in `backend/app/services/type_detector.rb`

### 5. Import Flow
**Steps:**
1. **Upload:** User drags CSV/Excel file
2. **Parse:** SpreadsheetParser extracts headers and sample data
3. **Detect:** TypeDetector analyzes each column
4. **Preview:** User sees detected types, can adjust
5. **Create Table:** TableBuilder generates schema
6. **Execute:** Background job (ImportJob) processes all rows
7. **Navigate:** Auto-redirect to table view

**Key Feature:** File contents stored in database (`import_sessions.file_data`) because Heroku worker dynos have separate filesystems from web dynos.

---

## Current Implementation Status

### ✅ Fully Working Features

**1. CSV/Excel Import**
- Drag-and-drop upload
- Type detection
- Preview before import
- Progress tracking
- Background job processing
- Error handling

**2. Table Management**
- Create tables from imports
- View all tables in dashboard
- Dynamic table generation
- Metadata storage

**3. Column Management**
- Add columns dynamically (plus button)
- Change column types after creation
- Airtable-style type selector modal
- 26 field types available
- Configuration slideouts for complex types

**4. Data Management (CRUD)**
- View records in Google Sheets-style table
- Inline editing (click to edit cells)
- Add new rows
- Delete rows
- Pagination (50 per page)
- Basic search

**5. Lookup/Relationships**
- Link tables together
- Autocomplete search when selecting related records
- Display related record's chosen field
- Foreign key constraints

**6. Formula Fields**
- Create computed columns
- Reference other fields with `{Field Name}`
- Basic math operations (+, -, *, /, %)
- Evaluated server-side with Dentaku
- Results displayed in table

**7. Currency Formatting**
- Custom CurrencyCell component
- Inline editing with $ symbol
- Proper decimal formatting

**8. UX Enhancements**
- Sticky first column (Google Sheets style)
- Sticky # column
- Hover states on rows
- Dark mode support
- Responsive design

### ⏳ Partially Implemented

**Column Types:**
- Most types defined but not all have custom UI
- Formula works, but no IF/CONCATENATE/SUM functions yet
- No attachment/file upload yet
- No user assignment yet
- No choice fields with options yet

**Search/Filter:**
- Basic search works
- No advanced filters
- No saved views
- No global search across tables

### ❌ Not Started

**Export:**
- Export to CSV/Excel planned but not built

**Bulk Operations:**
- No multi-select
- No bulk edit/delete

**User Management:**
- No authentication yet
- No roles/permissions
- No user accounts

**Workflows:**
- Automation section planned but not started

---

## File Structure

### Backend (`/backend`)
```
app/
├── controllers/api/v1/
│   ├── tables_controller.rb      # Table CRUD
│   ├── columns_controller.rb     # Column CRUD
│   ├── records_controller.rb     # Dynamic record CRUD
│   ├── imports_controller.rb     # File upload & import
│   └── constructions_controller.rb
├── models/
│   ├── table.rb                  # Table metadata
│   ├── column.rb                 # Column definitions
│   ├── import_session.rb         # Import tracking
│   └── construction.rb
├── services/
│   ├── formula_evaluator.rb     # Formula computation
│   ├── table_builder.rb         # Dynamic table creation
│   ├── type_detector.rb         # Column type detection
│   ├── spreadsheet_parser.rb    # CSV/Excel parsing
│   └── data_importer.rb         # Row import logic
└── jobs/
    └── import_job.rb             # Background import processing
```

### Frontend (`/frontend`)
```
src/
├── components/
│   ├── table/
│   │   ├── AddColumnModal.jsx        # Add column UI
│   │   ├── ColumnHeader.jsx          # Column header with type dropdown
│   │   ├── CurrencyCell.jsx          # Currency editing
│   │   ├── AutocompleteLookupCell.jsx # Lookup search
│   │   └── LookupConfigSlideout.jsx  # Lookup configuration
│   └── imports/
│       ├── FileUploader.jsx          # Drag-drop upload
│       └── ImportPreview.jsx         # Import preview/config
├── pages/
│   ├── Dashboard.jsx                 # Table list
│   ├── TablePage.jsx                 # Google Sheets view
│   └── ImportPage.jsx                # Import wizard
└── utils/
    ├── api.js                        # Axios client
    └── formatters.js                 # Value formatting
```

---

## API Endpoints

### Tables
```
GET    /api/v1/tables              # List all tables
POST   /api/v1/tables              # Create table
GET    /api/v1/tables/:id          # Get table details
PATCH  /api/v1/tables/:id          # Update table
DELETE /api/v1/tables/:id          # Delete table
```

### Columns
```
GET    /api/v1/tables/:table_id/columns           # List columns
POST   /api/v1/tables/:table_id/columns           # Add column
GET    /api/v1/tables/:table_id/columns/:id       # Get column
PATCH  /api/v1/tables/:table_id/columns/:id       # Update column
DELETE /api/v1/tables/:table_id/columns/:id       # Delete column
```

### Records (Dynamic)
```
GET    /api/v1/tables/:table_id/records           # List records
POST   /api/v1/tables/:table_id/records           # Create record
GET    /api/v1/tables/:table_id/records/:id       # Get record
PATCH  /api/v1/tables/:table_id/records/:id       # Update record
DELETE /api/v1/tables/:table_id/records/:id       # Delete record
```

### Imports
```
POST   /api/v1/imports                             # Upload file
POST   /api/v1/imports/preview                     # Preview import
POST   /api/v1/imports/:id/execute                 # Execute import
GET    /api/v1/imports/:id/status/:session_key    # Check status
```

---

## Database Schema

### Core Tables

**tables:**
```ruby
t.string :name                    # Display name
t.string :singular_name           # Singular form
t.string :plural_name             # Plural form
t.string :database_table_name     # Actual PG table name
t.string :icon                    # Icon name
t.string :title_column            # Primary display field
t.boolean :searchable             # Enable search
t.text :description               # Table description
t.timestamps
```

**columns:**
```ruby
t.references :table               # Parent table
t.string :name                    # Display name
t.string :column_name             # Database column name
t.string :column_type             # Type (single_line_text, etc.)
t.jsonb :settings                 # Type-specific config
t.integer :position               # Display order
t.boolean :required               # Required field
t.boolean :searchable             # Include in search
t.integer :lookup_table_id        # For lookup type
t.string :lookup_display_column   # Field to display from lookup
t.timestamps
```

**import_sessions:**
```ruby
t.string :session_key             # Unique identifier
t.string :file_path               # Temp file location
t.string :original_filename       # User's filename
t.integer :file_size              # File size in bytes
t.text :file_data                 # Base64 file contents
t.string :status                  # pending/processing/completed/failed
t.float :progress                 # 0-100%
t.integer :total_rows             # Total rows to import
t.integer :processed_rows         # Rows imported so far
t.jsonb :result                   # Import results/errors
t.datetime :expires_at            # Cleanup time
t.datetime :completed_at          # When finished
t.timestamps
```

### Dynamic Tables
Created at runtime, e.g., `table_projects_123`:
```ruby
create_table :table_projects_123 do |t|
  t.string :name                  # From columns config
  t.decimal :budget               # From columns config
  t.integer :lookup_contact_id    # Lookup foreign key
  t.timestamps
end
```

---

## Key Technical Decisions

### 1. Why Database-Backed File Storage?
**Problem:** Heroku web and worker dynos have separate ephemeral filesystems. Files uploaded to web dyno aren't accessible to worker dyno.

**Solution:** Store file contents in `import_sessions.file_data` (TEXT column). Worker dyno restores file from database before processing.

**Code:** `ImportJob#perform` checks if file exists, if not, writes from database.

### 2. Why Dentaku for Formulas?
**Problem:** Need to evaluate user-submitted mathematical expressions safely.

**Why Not eval():** Major security risk - allows arbitrary code execution.

**Why Dentaku:**
- No eval() - parses and evaluates safely
- Supports variables
- Supports functions (can extend)
- Good performance
- Battle-tested gem

### 3. Why Dynamic Models?
**Problem:** Can't define all table models at development time - they're created by users at runtime.

**Solution:**
- Store metadata in `tables` and `columns`
- Use `Class.new(ApplicationRecord)` to create model classes dynamically
- Use `Object.const_set` to register them
- Reload models when schema changes

**Trade-off:** More complex than static models, but required for user-defined schemas.

### 4. Why Rails + React (not Rails with Hotwire)?
**Decision Made By User:**
- Rails API for backend logic
- React SPA for rich interactive UI
- Allows independent deployment
- Frontend can be served from CDN (Vercel edge)
- Clean separation of concerns

---

## Common Patterns & Conventions

### 1. Column Settings Storage
Complex column types store configuration in `jsonb :settings`:

```ruby
# Formula column
column.settings = {
  formula: "{Price} * {Quantity}"
}

# Lookup column (also has dedicated columns for this)
column.settings = {
  # Usually stored in lookup_table_id and lookup_display_column
}

# Future: Choice field
column.settings = {
  options: [
    { value: 'new', label: 'New', color: 'blue' },
    { value: 'in_progress', label: 'In Progress', color: 'yellow' }
  ]
}
```

### 2. Record Serialization
`RecordsController#record_to_json` handles special types:

```ruby
# Lookup - returns object with id and display value
{
  contact_id: {
    id: 123,
    display: "John Smith"
  }
}

# Formula - computes on the fly
{
  total: 500.00  # Computed from {Price} * {Quantity}
}

# Regular fields - return as-is
{
  name: "Project ABC",
  budget: 100000.50
}
```

### 3. Error Handling
**Import Errors:**
- Try/catch around entire import
- On error: destroy table, keep import_session, show error to user
- Log to Rails.logger for debugging

**API Errors:**
- Return `{ success: false, error: "message" }` format
- Frontend shows alert() for now (TODO: better error UI)

### 4. Type Coercion
When changing column types, system attempts conversion:
- Text → Number: try `Float(value)`, set nil if fails
- Number → Text: always succeeds with `.to_s`
- Preview shows how many records would lose data

---

## Environment Variables

### Backend (Heroku)
```bash
DATABASE_URL=<postgres connection string>
RAILS_ENV=production
RAILS_SERVE_STATIC_FILES=true
RAILS_LOG_TO_STDOUT=true
SECRET_KEY_BASE=<rails secret>
```

### Frontend (Vercel)
```bash
VITE_API_URL=https://teeemlive-ce8e2660a615.herokuapp.com
```

---

## Development Workflow

### Running Locally

**Backend:**
```bash
cd backend
bundle install
rails db:create db:migrate
rails server  # Port 3000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev  # Port 5173
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api/v1/tables
- CORS configured for localhost

### Deploying

**Backend to Heroku:**
```bash
cd /Users/jakebaird/teeem
git add -A
git commit -m "Description"
git subtree push --prefix backend heroku main
```

**Frontend to Vercel:**
```bash
cd frontend
vercel --prod
```

### Committing Changes
```bash
git add -A
git commit -m "Feature description

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Business Context

### User: Tekna (Construction Company)
- Australian construction firm
- Previously using Rapid Platform (shutting down)
- Need to migrate all data urgently
- ~10 users (estimate)
- Critical tables: Projects, Estimates, Price Book, Suppliers, Jobs

### Primary Use Cases

**1. Price Book Management**
- Store unit rates for construction items
- Track supplier pricing
- Historical cost data
- Margin calculations

**2. Estimating**
- Create project estimates
- Line item breakdown
- Reference price book
- Quantity takeoffs
- Markup calculations

**3. Job Management**
- Track active jobs
- Budget vs actual
- Stage/milestone tracking
- Change orders
- Payment schedules

**4. Project Data**
- Store project details
- Link contacts and suppliers
- Track timelines
- Document storage (future)

### Migration Strategy
1. Export all tables from Rapid as CSV
2. Import into TEEEM one by one
3. Recreate relationships (lookups)
4. Test critical workflows
5. Train team
6. Go live

---

## Future Roadmap

### Phase 1: Core Platform ✅ (Mostly Complete)
- ✅ Import spreadsheets
- ✅ Create tables dynamically
- ✅ Basic CRUD operations
- ✅ Column type editing
- ✅ Lookup relationships
- ✅ Formula fields (basic)
- ⏳ Export data

### Phase 2: Enhanced Features (Current)
- ⏳ Advanced formula functions (IF, CONCATENATE, SUM)
- ⏳ Choice fields with options
- ⏳ Multiple select
- ⏳ Attachment/file uploads
- ⏳ Better search and filters
- ⏳ Saved views

### Phase 3: Polish & Performance
- ⏳ User accounts and authentication
- ⏳ Roles and permissions
- ⏳ Bulk operations
- ⏳ Performance optimization
- ⏳ Mobile responsive improvements

### Phase 4: Construction-Specific Features
- ❌ Price book specialized views
- ❌ Estimating templates
- ❌ Quote generation (PDF)
- ❌ Budget vs actual reporting
- ❌ Job costing dashboards

### Phase 5: Integrations
- ❌ Accounting software (Xero/MYOB)
- ❌ Email notifications
- ❌ Calendar integration
- ❌ Document generation

---

## Troubleshooting Guide

### Common Issues

**1. Import Stuck at Processing**
- Check Heroku logs: `heroku logs --tail`
- Check Solid Queue: `heroku run rails console` → `SolidQueue::Job.where(finished_at: nil)`
- File might not exist on worker dyno (should be fixed with file_data solution)

**2. Formula Returning ERROR**
- Check formula syntax: `{Field Name}` must match exactly
- Field names are case-sensitive
- Check Heroku logs for Dentaku parse errors
- Make sure referenced fields exist and are numeric

**3. Lookup Not Showing Options**
- Verify lookup_table_id is set
- Verify lookup_display_column exists in related table
- Check CORS if API calls failing from frontend
- Check browser console for errors

**4. Column Type Change Failed**
- Check for data incompatibility (text → number with non-numeric values)
- Use preview feature to see what will break
- May need to clean data first

**5. CORS Errors**
- Check backend `config/initializers/cors.rb`
- Verify Vercel domain is allowed
- Check VITE_API_URL is set correctly on Vercel

---

## Testing Approach

### What's Tested
- Import flow with sample CSVs
- Type detection accuracy
- Table/column creation
- Basic CRUD operations
- Manual testing in production

### What's Not Tested
- No automated tests yet
- No CI/CD pipeline
- No test coverage metrics

**Testing Philosophy:** Move fast, test manually, fix bugs as discovered. Once stable, add automated tests for critical paths.

---

## Performance Considerations

### Current Performance
- Page loads < 2s on good connection
- Import processing: ~1000 rows/minute
- Table view: Pagination at 50 records (acceptable)

### Known Bottlenecks
- Formula evaluation on every record fetch (could cache)
- N+1 queries on lookup fields (needs includes optimization)
- Large imports (10k+ rows) slow (could batch)

### Future Optimizations
- Cache computed formula values
- Eager load associations
- Background job for large imports
- Pagination optimization
- Index commonly queried columns

---

## Security Notes

### Current Security Posture
- ⚠️ No authentication yet (anyone can access)
- ✅ SQL injection prevented by ActiveRecord parameterization
- ✅ Formula injection prevented by Dentaku (no eval)
- ✅ File uploads validated (CSV/XLSX only)
- ✅ CORS properly configured
- ⚠️ No rate limiting
- ⚠️ No audit logging

### Before Production Launch
- [ ] Add authentication (Devise or JWT)
- [ ] Add authorization (CanCanCan or Pundit)
- [ ] Add rate limiting (Rack::Attack)
- [ ] Add audit logging for data changes
- [ ] Security review of dynamic SQL generation
- [ ] XSS protection audit
- [ ] HTTPS only (already enforced by Heroku/Vercel)

---

## Glossary

**TEEEM:** Project name (Tekna + Rapid)

**Rapid Platform:** Original no-code platform being replaced

**Dynamic Table:** PostgreSQL table created at runtime by user action

**Column Type:** The data type and behavior of a table column (text, number, formula, etc.)

**Lookup:** Foreign key relationship to another table

**Formula Field:** Computed column using mathematical expressions

**Import Session:** Tracking record for CSV/Excel import process

**Solid Queue:** Rails background job processor

**Dentaku:** Ruby gem for safe mathematical expression evaluation

**Type Detection:** Automatic inference of column types from spreadsheet data

---

## Quick Reference

### Most Important Files
- `backend/app/services/formula_evaluator.rb` - Formula computation
- `backend/app/controllers/api/v1/records_controller.rb` - Dynamic record CRUD
- `backend/app/services/table_builder.rb` - Creates database tables
- `frontend/src/pages/TablePage.jsx` - Main data grid view
- `frontend/src/components/table/AddColumnModal.jsx` - Column creation UI

### Most Important Concepts
1. Tables are created dynamically (not in migrations)
2. Formulas computed on read (not stored)
3. File contents in database for Heroku cross-dyno access
4. Column types drive UI behavior and validation
5. Lookups are foreign keys with custom display logic

### Quick Commands
```bash
# Deploy backend
git subtree push --prefix backend heroku main

# Deploy frontend
cd frontend && vercel --prod

# View Heroku logs
heroku logs --tail

# Rails console
heroku run rails console

# Check background jobs
heroku run rails runner "p SolidQueue::Job.count"
```

---

## Contact & Resources

**Project Location:** `/Users/jakebaird/teeem`

**Git Repository:** Local git repo, deploying to:
- Heroku: teeemlive
- Vercel: frontend project

**Documentation:**
- This knowledge base
- `rapid-rebuild-plan.md` - Original project plan
- Code comments in services and controllers

**Deployment Status:**
- Backend: Heroku v38 (production)
- Frontend: Vercel (production)
- Status: Operational, actively used for testing

---

## For AI Assistants

### How to Help Effectively

**When asked about features:**
1. Check this doc first for current status
2. Reference existing implementations
3. Consider dynamic table architecture
4. Maintain consistency with Airtable/Rapid patterns

**When implementing new features:**
1. Follow existing patterns (see column types, services)
2. Update both frontend and backend
3. Handle errors gracefully
4. Test with real data
5. Consider mobile UX
6. Update this knowledge base

**When debugging:**
1. Check Heroku logs first
2. Look at recent commits
3. Consider cross-dyno file access issues
4. Check CORS configuration
5. Verify environment variables

**When designing UI:**
1. Match Airtable/Google Sheets UX patterns
2. Use Tailwind CSS utilities
3. Support dark mode
4. Keep it simple and clean
5. Mobile responsive by default

### What You Should Know
- User (Jake) is the developer and end user
- Moving fast, prioritizing features over perfection
- Using Claude Code for development
- Production-first approach (test in prod)
- Australian timezone
- Construction industry context important

---

**Last Updated:** November 3, 2025
**Version:** 1.0
**Status:** Active Development - Phase 5
