# OneDrive Folder Templates

This directory contains folder structure templates for automated OneDrive folder creation when new jobs are created in TEEEM.

## Purpose

When a new construction job is created in TEEEM, the system can automatically create a standardized folder structure in OneDrive based on these templates. This ensures consistency across projects and reduces manual setup time.

## Template Format

Templates are stored as JSON files with the following structure:

```json
{
  "template_name": "Template Name",
  "template_type": "residential|commercial|renovation",
  "description": "Brief description",
  "root_folder_pattern": "{job_code} - {project_name}",
  "folders": [
    {
      "name": "Folder Name",
      "level": 1,
      "order": 1,
      "description": "Optional description",
      "children": [...]
    }
  ]
}
```

## Available Variables

The following variables can be used in `root_folder_pattern` and folder names:

- `{job_code}` - Unique job identifier (e.g., "RES-2024-042")
- `{project_name}` - Project title (e.g., "Smith Residence")
- `{client_name}` - Client full name
- `{address}` - Job site address
- `{start_date}` - Project start date (YYYY-MM-DD)
- `{project_manager}` - Project manager name

## Available Templates

### Tekna Standard Residential (`tekna-residential-template.json`)

**Source:** Robert - Tekna
**Type:** Residential Construction
**Region:** Australia (Queensland)
**Total Folders:** 30 (including subfolders)

A comprehensive folder structure for residential construction projects including:

#### Main Folders (Level 1)

1. **01 REVIT** - REVIT models and architectural files
2. **02 Land Info** - Land information, surveys, and site documentation
3. **03 Contract** - Contract documents and sales information
   - Sales Info
   - Sent
4. **04 Certification** - Certification, approvals, and inspection documentation
   - Final Inspection Form 16, Form 11 or 21
   - Final Send For Inc Certificates
   - SDA Plan Approved
   - Send SDA Approval
   - Start Approved Plan And Approval
   - Start To Send For Certification
5. **05 Estimation** - Cost estimation, quotes, and utility connections
   - Energex Connection
   - Estimation
   - Quotes
6. **06 Colour Selection** - Color selections and finish specifications
7. **07 Photos** - Construction progress photos organized by stage
   - 01 SITE (Site preparation)
   - 02 SLAB (Foundation and slab)
   - 03 FRAME (Framing stage)
   - 04 ENCLOSED (Lock-up/enclosed stage)
   - 05 FIXING (Fixing and finishing)
   - 06 Practical Completion
   - 07 Supervisor Photos
8. **08 SITE** - Site management documents and logs
9. **09 Handover** - Handover documentation and client materials
10. **10 Finance** - Financial documents
    - Invoices PDF

#### Folder Naming Convention

- Top-level folders use numerical prefixes (01-10) for logical ordering
- Subfolders may use numerical prefixes for workflow stages (e.g., Photos)
- ALL CAPS used for major categories (REVIT, SITE, FRAME, etc.)
- Title Case used for descriptive names

#### Usage Notes

**Certification Folder (04):**
- Contains compliance and approval documentation specific to Australian building regulations
- SDA (Specialist Disability Accommodation) folders for accessible housing projects
- Form 16, Form 11, Form 21 are Queensland building certification forms

**Photos Folder (07):**
- Organized chronologically by construction stage
- Follows typical residential build sequence
- Supervisor Photos separate for quality control documentation

**Estimation Folder (05):**
- Energex Connection: Queensland electricity infrastructure connection applications
- Keep all quotes organized in dedicated subfolder

**Finance Folder (10):**
- Store only PDF versions of invoices for easy sharing and archiving

## Creating New Templates

To create a new template:

1. Copy an existing template JSON file
2. Rename it appropriately (e.g., `company-name-template-type.json`)
3. Update the metadata:
   - `template_name`
   - `template_type`
   - `description`
   - `created_by`
4. Modify the folder structure as needed
5. Ensure `level` and `order` values are correct
6. Update the total folder count in metadata
7. Document the template in this README

## Implementation

These templates will be used to:

1. **Seed default templates** in the database when OneDrive sync feature is deployed
2. **Allow users to create custom templates** by duplicating and modifying these
3. **Automatically create folders** when new jobs are created in TEEEM
4. **Maintain consistency** across projects within an organization

## Database Migration

When implementing, use this structure to seed the `folder_templates` and `folder_template_items` tables:

```ruby
FolderTemplate.create!(
  name: "Tekna Standard Residential",
  template_type: "residential",
  is_system_default: true,
  folder_template_items_attributes: [
    # ... generated from JSON
  ]
)
```

## Future Templates

Additional templates to consider:

- **Commercial Build** - Multi-unit and commercial construction
- **Renovation Projects** - Home renovation workflow
- **Luxury Residential** - High-end custom homes
- **Multi-Unit Development** - Apartments and townhouses

## Maintenance

- Templates should be reviewed quarterly
- Update templates based on user feedback and regulatory changes
- Version templates when making significant changes
- Keep deprecated templates for historical job reference

---

**Last Updated:** 2025-11-05
**Maintained By:** TEEEM Development Team
