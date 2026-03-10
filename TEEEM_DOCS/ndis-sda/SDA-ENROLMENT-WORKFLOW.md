# SDA Dwelling Enrolment Workflow — Single-Click Submission

## Overview

A BPMN workflow that takes an SDA property from "new" to "enrolled" with the NDIA. Each step auto-populates from TEEEM data. The user reviews, uploads missing docs, and clicks through — no manual data entry.

---

## Portal Form Fields → TEEEM Mapping

Every field the NDIA my NDIS provider portal requires, mapped to where it comes from in TEEEM.

### Section 1: Provider Details

| Portal Field | Type | TEEEM Source | Auto-Fill? |
|-------------|------|-------------|------------|
| Provider ABN | Text | `company_settings.abn` | Yes |
| Provider legal name | Text | `company_settings.company_name` | Yes |
| Provider trading name | Text | `company_settings.trading_name` | Yes |
| NDIS registration number | Text | `company_settings.ndis_registration_number` (new field) | Yes |
| Provider contact name | Text | `current_user.name` | Yes |
| Provider contact email | Text | `current_user.email` | Yes |
| Provider contact phone | Text | `company_settings.phone` | Yes |

### Section 2: Dwelling Details

| Portal Field | Type | TEEEM Source | Auto-Fill? |
|-------------|------|-------------|------------|
| Street number | Text | `property.address_number` | Yes |
| Street name | Text | `property.address_street` | Yes |
| Suburb | Text | `property.suburb` | Yes |
| State/Territory | Dropdown | `property.state` | Yes |
| Postcode | Text | `property.postcode` | Yes |
| Lot number (if applicable) | Text | `property.lot_number` (new field) | Yes |
| Is the dwelling built? | Yes/No | Always "Yes" (can't enrol unbuilt) | Yes |
| Date of practical completion | Date | `property.completion_date` (new field) | Yes |

### Section 3: Design Category

| Portal Field | Type | TEEEM Source | Auto-Fill? |
|-------------|------|-------------|------------|
| Design category | Dropdown | `property.sda_design_category` (new field) | Yes |
| | | Options: Improved Liveability, Fully Accessible, Robust, High Physical Support | |
| Building type | Dropdown | `property.sda_building_type` (new field) | Yes |
| | | Options: Apartment, Duplex, Group Home, House, Townhouse, Villa | |
| Number of bedrooms | Number | `property.bedrooms` | Yes |
| Maximum number of residents | Number | `property.sda_max_residents` (new field) | Yes |
| Is this a new build or existing? | Dropdown | `property.sda_new_or_existing` (new field) | Yes |
| Year originally built (if existing) | Number | `property.year_built` (new field) | Yes |

### Section 4: Design Standard Compliance

| Portal Field | Type | TEEEM Source | Auto-Fill? |
|-------------|------|-------------|------------|
| Accredited SDA assessor name | Text | `property.sda_assessor_name` (new field) | Yes |
| Assessor registration number | Text | `property.sda_assessor_number` (new field) | Yes |
| Assessment date | Date | `property.sda_assessment_date` (new field) | Yes |
| Assessment certificate | Upload | `property.documents` (type: SDA Assessment) | Yes |
| Complies with SDA Design Standard v1.1 | Checkbox | From assessor cert | Manual confirm |

### Section 5: Fire Safety & Building Compliance

| Portal Field | Type | TEEEM Source | Auto-Fill? |
|-------------|------|-------------|------------|
| Certificate of occupancy | Upload | `property.documents` (type: Certificate of Occupancy) | Yes |
| Fire safety statement/certificate | Upload | `property.documents` (type: Fire Safety) | Yes |
| Building compliance certificate | Upload | `property.documents` (type: Building Compliance) | Yes |
| Essential services maintenance | Upload | `property.documents` (type: Essential Services) | Yes |

### Section 6: Accessibility Features (per Design Category)

#### Improved Liveability
| Portal Field | Type | TEEEM Source | Auto-Fill? |
|-------------|------|-------------|------------|
| Enhanced lighting | Checkbox | `property.sda_features` JSON | Yes |
| Level transitions (no trip hazards) | Checkbox | `property.sda_features` JSON | Yes |
| Acoustic insulation | Checkbox | `property.sda_features` JSON | Yes |
| Luminance contrast | Checkbox | `property.sda_features` JSON | Yes |
| Accessible fittings | Checkbox | `property.sda_features` JSON | Yes |

#### Fully Accessible
| Portal Field | Type | TEEEM Source | Auto-Fill? |
|-------------|------|-------------|------------|
| Wide doorways (min 850mm) | Checkbox | `property.sda_features` JSON | Yes |
| Roll-in shower | Checkbox | `property.sda_features` JSON | Yes |
| Wheelchair turning circles | Checkbox | `property.sda_features` JSON | Yes |
| Accessible kitchen | Checkbox | `property.sda_features` JSON | Yes |
| Wheel-in wardrobe | Checkbox | `property.sda_features` JSON | Yes |
| Accessible controls throughout | Checkbox | `property.sda_features` JSON | Yes |

#### High Physical Support
| Portal Field | Type | TEEEM Source | Auto-Fill? |
|-------------|------|-------------|------------|
| Ceiling tracking hoists | Checkbox | `property.sda_features` JSON | Yes |
| Emergency backup power | Checkbox | `property.sda_features` JSON | Yes |
| Enhanced environmental controls | Checkbox | `property.sda_features` JSON | Yes |
| Assistive technology provisions | Checkbox | `property.sda_features` JSON | Yes |
| Caregiver space | Checkbox | `property.sda_features` JSON | Yes |

#### Robust
| Portal Field | Type | TEEEM Source | Auto-Fill? |
|-------------|------|-------------|------------|
| Reinforced walls/fixtures | Checkbox | `property.sda_features` JSON | Yes |
| Impact-resistant surfaces | Checkbox | `property.sda_features` JSON | Yes |
| Secure windows/doors | Checkbox | `property.sda_features` JSON | Yes |
| Durable finishes | Checkbox | `property.sda_features` JSON | Yes |

### Section 7: GST Information

| Portal Field | Type | TEEEM Source | Auto-Fill? |
|-------------|------|-------------|------------|
| Are you registered for GST? | Yes/No | `company_settings.gst_registered` | Yes |
| Did you claim GST tax credits on construction? | Yes/No | `property.sda_gst_credits_claimed` (new field) | Yes |
| GST amount claimed | Currency | `property.sda_gst_amount_claimed` (new field) | Yes |

### Section 8: Ownership & Legal

| Portal Field | Type | TEEEM Source | Auto-Fill? |
|-------------|------|-------------|------------|
| Proof of ownership / legal authority | Upload | `property.documents` (type: Title/Ownership) | Yes |
| Tenancy agreement template | Upload | `property.documents` (type: Tenancy Agreement) | Yes |

### Section 9: Declaration

| Portal Field | Type | TEEEM Source | Auto-Fill? |
|-------------|------|-------------|------------|
| Declarant name | Text | `current_user.name` | Yes |
| Declarant position | Text | `current_user.role` / Company Director | Yes |
| Declaration date | Date | Today's date | Yes |
| Declaration accepted | Checkbox | Manual confirm required | No |

---

## BPMN Workflow Definition

### Process: `sda_dwelling_enrolment`

```
[Start] → [Preflight Check] → [Data Collection] → [Assessor Booking]
    → [Assessment Complete] → [Document Upload] → [Review & Generate]
    → [Submit to Portal] → [Track Approval] → [Enrolled] → [End]
```

### Nodes

#### 1. Start Event: `sda_enrolment_start`
- **Trigger:** Manual (user clicks "Start SDA Enrolment" on property page)
- **Subject:** Property record
- **Variables populated:**
  - `property_id`, `property_address`, `company_abn`, `company_name`
  - All property fields auto-loaded

#### 2. Service Task: `preflight_check`
- **Name:** Pre-Flight Data Check
- **Service:** `Bpmn::SdaPreflightService`
- **What it does:**
  - Checks which required fields are already filled in TEEEM
  - Generates a completeness score (e.g., "72% ready — 8 fields missing")
  - Lists missing documents
  - Lists missing property fields
- **Output:** `missing_fields[]`, `missing_documents[]`, `completeness_pct`
- **Auto-advance:** Yes (no user input needed)

#### 3. User Task: `data_collection`
- **Name:** Complete Property SDA Details
- **Assigned to:** Workflow initiator
- **Form:** Adaptive form showing ONLY missing fields (pre-filled ones shown as read-only)
- **Form sections:**
  - SDA Design Category (dropdown)
  - Building Type (dropdown)
  - Number of bedrooms (if not set)
  - Max residents
  - Assessor details (name, number, date)
  - GST information
  - Any other missing fields from preflight
- **Due date:** 7 days
- **Skip condition:** If completeness = 100%, auto-skip

#### 4. User Task: `assessor_booking`
- **Name:** Book SDA Assessor
- **Assigned to:** Workflow initiator
- **Form fields:**
  - Assessor name
  - Assessor registration number
  - Booked date
  - Assessor company
  - Notes
- **Skip condition:** If assessor details already filled, auto-skip
- **Help text:** Links to SDA assessor directory

#### 5. User Task: `assessment_complete`
- **Name:** Upload Assessment Certificate
- **Assigned to:** Workflow initiator
- **Form fields:**
  - Assessment date (date picker)
  - Assessment outcome (Passed / Failed / Conditional)
  - Design category confirmed (dropdown — may differ from initial)
  - Upload: Assessment certificate PDF
  - Upload: Photos (exterior, interior, accessibility features)
- **Due date:** 30 days
- **Reminder:** 7 days before due

#### 6. User Task: `document_upload`
- **Name:** Upload Required Documents
- **Assigned to:** Workflow initiator
- **Form:** Checklist of required documents with upload buttons
  - [ ] Certificate of Occupancy
  - [ ] Fire Safety Statement
  - [ ] Building Compliance Certificate
  - [ ] Essential Services Maintenance Report
  - [ ] Proof of Ownership / Legal Authority
  - [ ] SDA Assessment Certificate (pre-filled from step 5)
  - [ ] Property Photos (min 5: exterior, living, bedroom, bathroom, kitchen)
  - [ ] Floor Plans
  - [ ] Tenancy Agreement Template
- **Pre-filled:** Documents already in TEEEM property warehouse are auto-linked
- **Skip condition:** If all documents already uploaded, auto-skip

#### 7. Service Task: `generate_enrolment_pack`
- **Name:** Generate Enrolment Pack
- **Service:** `Bpmn::SdaEnrolmentPackGenerator`
- **What it does:**
  - Generates PDF summary of all enrolment data
  - Creates field-by-field printout matching portal form
  - Bundles all documents into a ZIP
  - Generates portal copy-paste data (for manual portal entry)
  - Saves pack to property documents
- **Output:** `enrolment_pack_url`, `portal_data_json`

#### 8. User Task: `review_and_approve`
- **Name:** Review & Submit Enrolment
- **Assigned to:** Company admin / Director
- **Form:**
  - Read-only summary of ALL fields (matches portal layout)
  - Document list with preview links
  - "I confirm all details are accurate" checkbox
  - "Submit to NDIA Portal" button
  - "Download Enrolment Pack" button
- **Actions:**
  - Approve → advances to submission tracking
  - Reject → sends back to data collection with notes
  - Download → gets ZIP of all docs + pre-filled form

#### 9. User Task: `submit_to_portal`
- **Name:** Submit to NDIA Portal
- **Assigned to:** Workflow initiator (or designated portal user)
- **Instructions:**
  1. Open my NDIS provider portal (link provided)
  2. Click "Enrol a dwelling"
  3. Copy data from TEEEM (clipboard buttons for each section)
  4. Upload documents from downloaded pack
  5. Submit in portal
  6. Enter NDIA reference number back into TEEEM
- **Form fields:**
  - NDIA reference number (text — entered after portal submission)
  - Date submitted (date)
  - Confirmation screenshot (optional upload)
- **Helper:** Side-by-side view — TEEEM data on left, portal instructions on right

#### 10. Exclusive Gateway: `enrolment_outcome`
- **Condition:** Based on `enrolment_status` variable
- **Paths:**
  - `approved` → End (Enrolled)
  - `info_requested` → Back to data collection
  - `rejected` → End (Rejected) with notification

#### 11. User Task: `track_approval`
- **Name:** Track NDIA Approval
- **Assigned to:** Workflow initiator
- **Form fields:**
  - Status update (dropdown: Under Review / Info Requested / Approved / Rejected)
  - NDIA comments (text)
  - Additional documents requested (uploads)
- **Timer:** Auto-reminder every 7 days until resolved
- **28-day SLA alert:** Warning at day 21, escalation at day 28

#### 12. End Event: `enrolled`
- **Name:** Dwelling Enrolled
- **Actions on completion:**
  - Update property status to "SDA Enrolled"
  - Set `property.ndis_dwelling_id`
  - Set `property.sda_enrolment_status = "enrolled"`
  - Set `property.sda_enrolled_date`
  - Send notification to property team
  - Create calendar event for first compliance review (12 months)

#### 13. End Event: `rejected`
- **Name:** Enrolment Rejected
- **Actions on completion:**
  - Update `property.sda_enrolment_status = "rejected"`
  - Log rejection reasons
  - Send notification with next steps

---

## New Property Fields Required

### Database Migration

```ruby
# add_sda_fields_to_properties.rb
add_column :properties, :sda_design_category, :string
# improved_liveability, fully_accessible, robust, high_physical_support

add_column :properties, :sda_building_type, :string
# apartment, duplex, group_home, house, townhouse, villa

add_column :properties, :sda_enrolment_status, :string, default: "not_started"
# not_started, in_progress, submitted, under_review, info_requested,
# approved, enrolled, rejected

add_column :properties, :sda_max_residents, :integer
add_column :properties, :sda_new_or_existing, :string   # new_build, existing
add_column :properties, :sda_assessor_name, :string
add_column :properties, :sda_assessor_number, :string
add_column :properties, :sda_assessment_date, :date
add_column :properties, :sda_gst_credits_claimed, :boolean, default: false
add_column :properties, :sda_gst_amount_claimed, :decimal, precision: 12, scale: 2
add_column :properties, :sda_features, :jsonb, default: {}
add_column :properties, :sda_enrolled_date, :date
add_column :properties, :ndis_dwelling_id, :string
add_column :properties, :completion_date, :date
add_column :properties, :year_built, :integer
add_column :properties, :lot_number, :string

add_column :company_settings, :ndis_registration_number, :string
```

### New Document Types (WarehouseFolder)

```
SDA Documents/
├── SDA Assessment Certificate
├── Certificate of Occupancy
├── Fire Safety Statement
├── Building Compliance Certificate
├── Essential Services Report
├── Proof of Ownership
├── Floor Plans
├── Property Photos/
│   ├── Exterior
│   ├── Living Areas
│   ├── Bedrooms
│   ├── Bathrooms
│   ├── Kitchen
│   └── Accessibility Features
├── Tenancy Agreement Template
└── NDIA Enrolment Pack (generated)
```

---

## User Experience: Single-Click Flow

### From Property Detail Page

1. User navigates to Property → **SDA tab** (new)
2. Sees SDA status card showing completeness: "Ready to enrol: 85%"
3. Clicks **"Start Enrolment"** button
4. Workflow starts → preflight check runs instantly
5. Form appears showing ONLY the 3 missing fields (everything else pre-filled)
6. User fills in 3 fields, clicks Next
7. Document checklist appears — 7/9 already uploaded from property docs
8. User uploads 2 missing docs, clicks Next
9. Full review page shows everything — user confirms
10. **"Generate Enrolment Pack"** → ZIP downloads with everything
11. User opens NDIA portal, pastes data (clipboard buttons), uploads docs
12. Enters NDIA reference number back into TEEEM
13. Workflow tracks approval with automatic reminders

**Total manual effort:** Fill ~3-5 missing fields, upload ~2 missing docs, copy-paste to portal. Everything else is automatic.

---

## Future: Full Automation (When NDIA Opens API)

When dwelling enrolment APIs become available:
- Step 9 (Submit to Portal) becomes a **service task** — direct API submission
- Step 11 (Track Approval) gets **real-time status updates** via webhook/polling
- Zero manual portal interaction required
- True single-click: Review → Submit → Done
