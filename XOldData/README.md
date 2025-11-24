# XOldData Archive

This directory contains files that were archived from the Trapid project on **November 24, 2025**.

These files were identified as unused, unreferenced, or unnecessary for the current development workflow. They have been moved here rather than deleted to preserve project history and allow for recovery if needed.

---

## Directory Structure

```
XOldData/
├── archive_backups/       # Large backup files that shouldn't be in git
├── backend_tests/         # Ad-hoc backend test/demo scripts
├── csv_imports/           # Historical CSV import data files
├── frontend_debug/        # Frontend debugging and monitoring scripts
├── json_generated/        # Auto-generated JSON mapping files
├── marketing_pdfs/        # Generated marketing documents
├── misc/                  # Miscellaneous config and template files
├── powershell_scripts/    # Windows PowerShell deployment scripts
├── screenshots/           # Development screenshots
└── security_tokens/       # ⚠️  Files containing hardcoded credentials
```

---

## Files Moved

### 1. Archive Backups (~24 MB)
**Location:** `archive_backups/`

- `backend.tar.gz` (23 MB) - Compressed backend directory backup
- `frontend copy/` (860 KB) - Duplicate frontend directory

**Reason:** Large binary files should not be tracked in git. Version control is for source code, not backups.

**Recovery:** If needed, extract `backend.tar.gz` or restore from git history before this cleanup.

---

### 2. CSV Import Data (~5 MB)
**Location:** `csv_imports/`

- `easybuildapp development Contacts.csv` (55 KB)
- `easybuildapp development Contacts-1.csv` (47 KB)
- `easybuildapp development Price Books.csv` (585 KB)
- `easybuildapp development Price Books(in).csv` (1.1 MB)
- `easybuildapp development Price Histories.csv` (1.9 MB)
- `easybuildapp development Purchase Orders-3.csv` (46 KB)
- `easybuildapp development Purchase Orders-4.csv` (68 KB)
- `pricebook_cleaned.csv` (699 KB)
- `pricebook_import.csv` (1.1 MB)
- `test_import.csv` (139 B)

**Reason:** Historical import data files used during initial setup. No longer needed for development.

**Recovery:** These files are preserved here if historical import data is needed.

---

### 3. One-Time Analysis Scripts
**Location:** `scripts/`

- `analyze_supplier_categories.rb` - Analyzed supplier/category relationships (generated JSON files in `json_generated/`)
- `import_data.rb` - Old import script (likely obsolete)
- `cleanup_pricebook.py` - One-time pricebook data cleanup
- `test_workflow.rb` - Workflow testing script
- `test_working_days.rb` - Schedule/working days testing script

**Reason:** These were one-time or ad-hoc scripts used during development. Not part of regular workflow.

**Recovery:** Scripts are functional and can be restored if similar analysis is needed.

---

### 4. ⚠️  Security-Sensitive HTML Files
**Location:** `security_tokens/`

- `INSTALL_BOOKMARKLET.html` - Auto-login bookmarklet with hardcoded JWT token
- `LOGIN_NOW.html` - Quick login page with hardcoded JWT token

**⚠️  SECURITY WARNING:**
Both files contain hardcoded JWT tokens that expire on **November 16, 2026**.

**Reason:** Hardcoded credentials should NEVER be in version control, even for development convenience.

**Recovery:** Tokens are still valid until Nov 2026. If auto-login is needed, regenerate these files with fresh tokens and DO NOT commit them to git. Add to `.gitignore` instead.

---

### 5. Marketing PDFs (~280 KB)
**Location:** `marketing_pdfs/`

- `TRAPID_EXECUTIVE_SUMMARY.pdf` (71 KB)
- `TRAPID_FEATURES_LIST.pdf` (71 KB)
- `TRAPID_MARKETING_BROCHURE.pdf` (71 KB)
- `TRAPID_SALES_DOCUMENT.pdf` (71 KB)

**Reason:** Generated PDFs that can be rebuilt from markdown source files using `generate_pdf.py`.

**Recovery:** Regenerate from source markdown files in `TRAPID_DOCS/` or restore from this archive.

---

### 6. Screenshots (~420 KB)
**Location:** `screenshots/`

- `Screenshot 2025-11-03 at 1.45.30 PM.png` (271 KB)
- `Screenshot 2025-11-05 at 9.02.29 AM.png` (149 KB)
- `images.png` (1.8 KB)

**Reason:** Development screenshots that are not referenced in documentation. Should be stored separately or in issues/PRs, not in main repo.

**Recovery:** Files preserved here if needed for reference.

---

### 7. Frontend Debug/Test Files
**Location:** `frontend_debug/`

- `test-gantt.js` - Playwright test script for Gantt chart drag operations
- `debug-cascade.js` - Browser console debug script
- `DRAG_DIAGNOSTICS.js` - Performance monitoring for drag operations

**Reason:** Ad-hoc debugging and testing scripts not part of formal test suite.

**Recovery:** Scripts are functional. Move back to `frontend/` if needed for debugging.

**Note:** `frontend/src/test/` directory did not exist or was already cleaned up.

---

### 8. Backend Test Scripts
**Location:** `backend_tests/`

- `add_variables_via_api.rb` - Bulk-add Unreal Engine variables via API (9 KB)
- `test_financial_backend.rb` - Financial system testing script
- `gantt_drag_test.rb` - Gantt drag functionality test
- `invoice_matching_demo.rb` - Invoice matching demonstration
- `xero_bank_sync_test.rb` - Xero bank synchronization test

**Reason:** Manual test/demo scripts, not automated RSpec tests. Not part of regular CI/CD workflow.

**Recovery:** Scripts are functional. If needed, move to `backend/scripts/manual_tests/` for better organization.

---

### 9. PowerShell Scripts
**Location:** `powershell_scripts/`

- `auto_bump_version.ps1` - Automatic version bumping (Windows)
- `bump_version.ps1` - Manual version bumping (Windows)
- `deploy_to_production.ps1` - Production deployment (Windows)

**Reason:** Windows-specific scripts. Project uses shell scripts (`increment-version.sh`, `start_trapid_servers.sh`, etc.) for these tasks.

**Recovery:** Restore if Windows CI/CD is needed. Otherwise, use existing shell scripts.

---

### 10. Generated JSON Mappings
**Location:** `json_generated/`

- `category_suppliers_mapping.json` - Categories → Suppliers
- `supplier_categories_mapping.json` - Suppliers → Categories
- `supplier_category_relationships.json` - Full relationship graph

**Reason:** Auto-generated by `analyze_supplier_categories.rb`. Can be regenerated if needed.

**Recovery:** Run analysis script or restore from this archive.

---

### 11. Miscellaneous Files
**Location:** `misc/`

- `project.toml` (54 B) - Unclear purpose, minimal content
- `UpHomes NDIS Template.xlsx` (24 KB) - Appears to be sample data or client template

**Reason:** Files with unclear purpose or specific to historical client context.

**Recovery:** Files preserved here if context becomes clear later.

---

## Space Savings

**Total space recovered:** ~29 MB

Breakdown:
- Archive backups: ~24 MB
- CSV imports: ~5 MB
- Marketing PDFs: ~280 KB
- Screenshots: ~420 KB
- Other files: ~100 KB

---

## What Was NOT Moved

The following files were considered but kept in the repo:

### Files to Keep:
- `vercel.json` - May be needed for Vercel deployments
- `package.json` (root) - Used for project-wide scripts
- Test pages with routes - Useful for development (e.g., `/table-test`, `/pdf-measure-test`)
- `DataTableExample.jsx` - Developer reference implementation (documented in README)
- Scripts in `/scripts/` - Actively maintained utilities
- `Design` model/controller - Underutilized but still in use for house design templates

### Rake Tasks to Review:
The following rake tasks in `backend/lib/tasks/` may be one-time setup tasks. Consider archiving after confirming they're no longer needed:

- `add_tekna_users.rake` - Specific user setup
- `populate_supplier_categories.rake` - Initial data seeding
- `setup_pricebook_categories.rake` - Initial setup
- `copy_gold_standard_columns.rake` - Data migration
- `format_phone_numbers.rake` - One-time data cleanup
- `import_*_from_csv.rake` - One-time imports
- `seed_competitor_features.rake` - Initial seeding
- `seed_meeting_types.rake` - Initial seeding
- `fix_gold_standard_column_types.rake` - One-time fix

**Recommendation:** Review these with product team before archiving.

---

## Recommended Next Steps

### 1. Update `.gitignore`
Add these patterns to prevent future accumulation:

```gitignore
# Large data files
*.csv
!config/**/*.csv  # Keep config CSVs
*.tar.gz

# Generated PDFs (can be rebuilt from markdown)
*_EXECUTIVE_SUMMARY.pdf
*_FEATURES_LIST.pdf
*_MARKETING_BROCHURE.pdf
*_SALES_DOCUMENT.pdf

# Development convenience files with credentials
INSTALL_BOOKMARKLET.html
LOGIN_NOW.html

# Screenshots (unless explicitly needed)
Screenshot*.png

# Frontend duplicates
frontend\ copy/

# Excel templates (unless needed for tests)
*.xlsx
!test/**/*.xlsx  # Keep test fixtures

# Generated JSON mappings
*_mapping.json
*_relationships.json
```

### 2. Document File Organization
Create guidelines in project README for where to put:
- Import data files → `/data/` directory (gitignored)
- Test scripts → `/backend/scripts/manual_tests/` or `/frontend/tests/`
- Marketing materials → Separate repository or storage
- Screenshots → GitHub issues, PRs, or wiki

### 3. Security Review
- Rotate JWT tokens from archived HTML files if they're still valid in production
- Audit other files for hardcoded credentials
- Set up pre-commit hooks to catch credentials before commit

---

## Restoration Instructions

To restore any file from this archive:

```bash
# Single file
cp XOldData/[category]/[filename] [original_location]

# Entire category
cp -r XOldData/[category]/* [destination]/

# Example: Restore a script
cp XOldData/scripts/analyze_supplier_categories.rb .
```

---

## Archive Metadata

- **Date Archived:** November 24, 2025
- **Archived By:** Claude Code (automated cleanup)
- **Git Commit Before Cleanup:** See git log for commit hash
- **Total Files:** 50+ files
- **Total Size:** ~29 MB

---

## Questions?

If you need to restore files or have questions about why something was archived:
1. Check this README for context
2. Review git history before the cleanup commit
3. Contact the development team
4. All files are preserved here and can be restored

---

**Last Updated:** November 24, 2025
