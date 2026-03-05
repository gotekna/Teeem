# TEEEM SDA Management Hub

> **Dependencies:** Package 1 (SDA Enrolment) + Package 2 (NDIS Claims)
> **Related docs:** `PACKAGE-1-SDA-ENROLMENT.md`, `PACKAGE-2-NDIS-CLAIMS.md`, `SDA-ENROLMENT-WORKFLOW.md`

## Overview

A dedicated SDA management section (`/sda`) with portfolio-level tabs for managing enrolments, claims, and compliance across ALL SDA properties at once — not buried in individual property detail pages.

## Problem

Even with per-property SDA tools (Package 1 & 2), providers with 20-100+ dwellings need:
- **Batch operations** — Submit monthly claims for all properties at once
- **Portfolio view** — See all enrolment statuses, compliance gaps, revenue in one place
- **Quick onboarding** — Rapidly add new SDA properties with all required fields pre-filled
- **Cross-property reporting** — Revenue by design category, vacancy rates, compliance scores

## Solution: SDA Management Hub

### Route: `/sda`

New top-level navigation item with 5 tabs:

```
/sda
├── /sda/dashboard      → Portfolio overview (default)
├── /sda/properties     → All SDA properties list
├── /sda/enrolments     → Enrolment pipeline tracker
├── /sda/claims         → Batch claims management
└── /sda/compliance     → Compliance status tracker
```

---

## Tab 1: Dashboard (`/sda/dashboard`)

Portfolio-level overview cards + charts.

### Stats Cards (top row)

| Card | Data Source | Display |
|------|-----------|---------|
| Total SDA Dwellings | `properties.where(sda_enrolled: true).count` | Number + trend |
| Pending Enrolments | `properties.where(sda_category: present, sda_enrolled: false).count` | Number |
| Monthly Revenue | Sum of `tenancies.ndia_payment_amount` for active SDA tenancies | Currency |
| Occupancy Rate | Active SDA tenancies / Total SDA properties | Percentage |
| Compliance Score | Properties with all docs valid / Total enrolled | Percentage |
| Claims This Month | `NdisClaim.where(period: this_month).count` | Number + status breakdown |

### Charts

1. **Revenue by Design Category** — Bar chart: HPS vs FA vs IL vs R monthly revenue
2. **Enrolment Pipeline** — Funnel: Draft → Submitted → Under Review → Enrolled
3. **Vacancy Timeline** — Line chart: occupancy % over 12 months
4. **Claims Status** — Donut: Approved / Processing / Rejected / Draft

### Quick Actions

| Button | Action |
|--------|--------|
| Quick Enrol Property | Opens Quick Enrol wizard (see below) |
| Submit Monthly Claims | Opens batch claims for all occupied SDA properties |
| Download Portfolio Report | Generates PDF summary of all SDA properties |

---

## Tab 2: Properties (`/sda/properties`)

**TeeemTableView** listing ALL properties with SDA data, regardless of enrolment status.

### Columns

| Column | Source | Notes |
|--------|--------|-------|
| Property | `property.name` + `property.street_address` | Link to property detail |
| Design Category | `property.sda_category` | Badge: HPS / FA / IL / Robust |
| Building Type | `property.construction_type` | Apartment / House / etc. |
| Bedrooms | `property.bedrooms` | Number |
| Enrolled | `property.sda_enrolled` | Yes/No badge |
| Dwelling ID | `property.sda_dwelling_id` | NDIA reference |
| Enrolment Date | `property.sda_enrolment_date` | Date |
| Occupancy | Active tenancy count | Occupied / Vacant badge |
| Participant | Active tenancy → `sda_participant_contact` | Contact name |
| Weekly Rate | Active tenancy → `sda_weekly_rate` | Currency |
| Compliance | Doc completeness score | % with color coding |
| Status | Derived from enrolment + occupancy | Active / Vacant / Pending / Not Enrolled |

### Filters

- Design Category (multi-select)
- Enrolled status (Yes/No/All)
- Occupancy (Occupied/Vacant/All)
- Compliance (All Green / Issues / Critical)

### Row Actions

- View Property → `/properties/:id`
- Start Enrolment → Opens enrolment workflow
- Submit Claim → Opens single-property claim
- View Compliance → Scrolls to compliance docs

### Bulk Actions

- Bulk Submit Claims (select multiple → batch claim)
- Export Selected to CSV
- Generate Enrolment Pack (for non-enrolled properties)

---

## Tab 3: Enrolments (`/sda/enrolments`)

Pipeline view tracking ALL SDA enrolments across the portfolio.

### View Modes

**1. Kanban Board (default)**

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Not Started │  │ In Progress │  │  Submitted  │  │Under Review │  │  Enrolled   │
│             │  │             │  │             │  │             │  │             │
│ 12 Smith St │  │ 8 Park Ave  │  │ 45 King Rd  │  │ 3 Queen St  │  │ 100+ props  │
│ 5 Jones Rd  │  │ 22 High St  │  │             │  │             │  │             │
│ ...         │  │             │  │             │  │             │  │             │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

Cards show: Property address, design category badge, completeness %, days in stage.

**2. Table View**

TeeemTableView with columns:
| Column | Source |
|--------|--------|
| Property | Address + name |
| Status | Enrolment pipeline stage |
| Design Category | Badge |
| Completeness | % of fields/docs filled |
| Missing Items | Count of missing fields/docs |
| Started | Date workflow started |
| Days in Stage | Calculated |
| Assigned To | Workflow assignee |
| SLA Warning | 28-day NDIA SLA tracking |

### Enrolment Card Detail (click to expand)

Shows per-property:
- Completeness breakdown (fields filled / total)
- Missing fields list
- Missing documents list
- Workflow history (timeline of status changes)
- "Continue Enrolment" button → resumes workflow
- "View Property" link

### Quick Enrol Button

Top-right "Quick Enrol Property" button opens the Quick Enrol Wizard.

---

## Tab 4: Claims (`/sda/claims`)

Batch claims management across the entire SDA portfolio.

### Monthly Claims Generation

**"Generate Monthly Claims" button:**

1. System scans ALL active SDA tenancies
2. For each occupied property with an active SDA tenancy:
   - Calculates days occupied in the claim period
   - Applies correct SDA Price Guide rate (by design category + resident count)
   - Calculates pro-rata amounts for partial periods
   - Generates claim record in `draft` status
3. Shows review table of ALL generated claims

### Claims Review Table

| Column | Source |
|--------|--------|
| Property | Address |
| Participant | SDA participant contact name |
| NDIS Number | `tenancy.sda_plan_number` |
| Period | Claim start → end date |
| Days | Days occupied |
| Design Category | Property SDA category |
| Daily Rate | From Price Guide |
| Total Amount | Days × Rate |
| GST | Auto-calculated |
| Status | Draft / Submitted / Approved / Rejected / Paid |

### Claim Workflow

```
[Generate Claims] → [Review & Adjust] → [Submit All] → [Track Status] → [Reconcile]
```

1. **Generate** — Auto-creates draft claims for all eligible properties
2. **Review** — Table shows all drafts, user can edit amounts or exclude properties
3. **Submit** — Bulk submit via NDIA API (when available) or mark as manually submitted
4. **Track** — Real-time status updates per claim
5. **Reconcile** — Match NDIA payments to claims, sync with Xero

### Claim Status Tracking

| Status | Color | Description |
|--------|-------|-------------|
| Draft | Gray | Generated, not yet submitted |
| Submitted | Blue | Sent to NDIA |
| Processing | Amber | NDIA reviewing |
| Approved | Green | Approved, awaiting payment |
| Paid | Green (dark) | Payment received |
| Rejected | Red | Rejected with reason code |
| Resubmitted | Purple | Fixed and resubmitted |

### Claims History

- Monthly/quarterly/annual views
- Total claimed vs approved vs paid
- Rejection rate tracking
- Average days to payment
- Revenue by property / design category / period

### Manual Claims (Before API Access)

Until NDIA DPP API access is approved:
- Claims generated as a printable summary
- Copy-paste data for myplace portal entry
- User manually marks claims as "submitted" after portal entry
- User manually updates status when NDIA responds

---

## Tab 5: Compliance (`/sda/compliance`)

Portfolio-wide compliance document tracker.

### Compliance Matrix

| Property | Assessment | Fire Safety | Building Cert | Occupancy | Insurance | Floor Plans | Photos | Score |
|----------|-----------|-------------|---------------|-----------|-----------|-------------|--------|-------|
| 12 Smith St | Valid | Expiring | Valid | Valid | Valid | Missing | 12/15 | 85% |
| 8 Park Ave | Missing | Valid | Missing | Valid | Expired | Valid | 8/15 | 60% |

### Document Status Colors

| Status | Color | Action |
|--------|-------|--------|
| Valid | Green | None |
| Expiring (< 30 days) | Amber | Reminder sent |
| Expired | Red | Requires renewal |
| Missing | Gray | Upload needed |

### Compliance Alerts

- Documents expiring within 30 days
- Properties with compliance score < 80%
- Properties with critical documents missing (fire safety, assessment)

### Bulk Actions

- Export compliance report (PDF/CSV)
- Send reminders to property managers
- Schedule compliance review meetings

---

## Quick Enrol Wizard

Streamlined flow to add a NEW SDA property and start enrolment in one step.

### Wizard Steps

#### Step 1: Property Selection

**Option A:** Select existing property (dropdown of non-SDA properties)
**Option B:** Create new property (minimal fields)

If creating new:
| Field | Required | Notes |
|-------|----------|-------|
| Property name | Yes | e.g., "12 Smith Street SDA" |
| Street address | Yes | |
| Suburb | Yes | |
| State | Yes | Dropdown |
| Postcode | Yes | |
| Property type | No | Auto-set to relevant type |

#### Step 2: SDA Details

| Field | Required | Pre-filled From |
|-------|----------|----------------|
| Design Category | Yes | — (user selects) |
| Building Type | Yes | Property type if set |
| Bedrooms | Yes | Property bedrooms if set |
| Max Residents | Yes | Default: bedrooms count |
| New Build or Existing | Yes | — |
| Year Built | If existing | Property year_built if set |
| Completion Date | If new build | — |

#### Step 3: Assessor Details

| Field | Required | Notes |
|-------|----------|-------|
| Assessor Name | No | Can be added later |
| Assessor Number | No | Can be added later |
| Assessment Date | No | Can be added later |
| Skip for now | — | Checkbox to defer |

#### Step 4: Key Documents

Quick upload for critical documents:
- [ ] SDA Assessment Certificate (PDF)
- [ ] Certificate of Occupancy (PDF)
- [ ] Fire Safety Statement (PDF)
- [ ] Property Photos (multiple upload)
- [ ] Skip for now (can upload later)

#### Step 5: Review & Enrol

Summary of all entered data + "Start Enrolment" button.

On submit:
1. Creates property (if new) with SDA fields populated
2. Sets `sda_category` on property
3. Starts the BPMN enrolment workflow (see `SDA-ENROLMENT-WORKFLOW.md`)
4. Redirects to Enrolments tab showing the new pipeline item

**Total time:** ~2-3 minutes vs 30+ minutes manually.

---

## Data Model Additions

### New Table: `ndis_claims`

```ruby
create_table :ndis_claims do |t|
  t.references :tenant, null: false
  t.references :property, null: false
  t.references :tenancy, null: false
  t.references :contact  # SDA participant

  t.string :ndis_participant_number
  t.string :service_booking_number
  t.date :claim_period_start
  t.date :claim_period_end
  t.string :support_item_number    # SDA line item code
  t.decimal :quantity, precision: 6, scale: 2  # days
  t.decimal :unit_price, precision: 10, scale: 2  # daily rate
  t.decimal :total_amount, precision: 10, scale: 2
  t.decimal :gst_amount, precision: 10, scale: 2
  t.string :status, default: "draft"
  # draft, submitted, processing, approved, rejected, paid, resubmitted
  t.string :ndia_reference
  t.text :rejection_reason
  t.string :rejection_code
  t.datetime :submitted_at
  t.datetime :approved_at
  t.datetime :paid_at
  t.decimal :paid_amount, precision: 10, scale: 2
  t.jsonb :metadata, default: {}

  t.timestamps
end

add_index :ndis_claims, [:property_id, :claim_period_start]
add_index :ndis_claims, :status
add_index :ndis_claims, :ndia_reference, unique: true
```

### New Table: `ndis_price_guides`

```ruby
create_table :ndis_price_guides do |t|
  t.string :design_category, null: false
  t.string :building_type
  t.integer :resident_count, null: false
  t.decimal :daily_rate, precision: 10, scale: 2, null: false
  t.date :effective_from, null: false
  t.date :effective_to
  t.string :support_item_number
  t.string :financial_year  # "2025-26"
  t.jsonb :metadata, default: {}

  t.timestamps
end

add_index :ndis_price_guides, [:design_category, :resident_count, :effective_from],
          name: "idx_price_guides_category_residents_date", unique: true
```

### New Fields on Properties

```ruby
# Additional SDA fields (beyond existing sda_category, sda_enrolled, etc.)
add_column :properties, :sda_building_type, :string
add_column :properties, :sda_enrolment_status, :string, default: "not_started"
# not_started, in_progress, submitted, under_review, info_requested, approved, enrolled, rejected
add_column :properties, :sda_max_residents, :integer
add_column :properties, :sda_new_or_existing, :string   # new_build, existing
add_column :properties, :sda_assessor_name, :string
add_column :properties, :sda_assessor_number, :string
add_column :properties, :sda_assessment_date, :date
add_column :properties, :sda_gst_credits_claimed, :boolean, default: false
add_column :properties, :sda_gst_amount_claimed, :decimal, precision: 12, scale: 2
add_column :properties, :sda_features, :jsonb, default: {}
add_column :properties, :completion_date, :date
add_column :properties, :lot_number, :string
```

### New Fields on TenantSettings (CompanySetting)

```ruby
add_column :tenant_settings, :ndis_registration_number, :string
```

---

## Navigation

### Sidebar Entry

Add via `NavigationItem` model:

```ruby
NavigationItem.create!(
  name: "SDA",
  href: "/sda",
  icon: "building-2",  # or "home" or custom SDA icon
  position: 35,  # After Properties (30), before Settings
  tenant_id: tenant.id,
  visible: true
)
```

Only visible to tenants with SDA properties or SDA module enabled.

### Property Detail Integration

Add "SDA" tab to property detail page (if property has `sda_category` set):
- Links to per-property SDA view
- Shows enrolment status, tenancy SDA details
- "View in SDA Hub" link → `/sda/properties` filtered to this property

---

## API Endpoints

### SDA Dashboard
```
GET /api/v1/sda/dashboard
→ { stats: {...}, charts: {...} }
```

### SDA Properties
```
GET /api/v1/sda/properties
→ { properties: [...], pagination: {...} }
# Returns all properties with SDA data, including tenancy info
```

### Enrolments
```
GET    /api/v1/sda/enrolments
→ { enrolments: [...] }  # Properties grouped by enrolment status

POST   /api/v1/sda/enrolments/quick_enrol
→ Creates property + starts workflow
Body: { property: {...}, sda_details: {...}, documents: [...] }
```

### Claims
```
GET    /api/v1/ndis_claims
POST   /api/v1/ndis_claims/generate_monthly
→ Auto-generates draft claims for all eligible properties
Body: { period_start: "2026-03-01", period_end: "2026-03-31" }

POST   /api/v1/ndis_claims/bulk_submit
→ Submits multiple claims
Body: { claim_ids: [1, 2, 3, ...] }

PATCH  /api/v1/ndis_claims/:id
→ Update claim status/details

GET    /api/v1/ndis_claims/summary
→ { total_claimed: 45000, approved: 38000, pending: 7000, ... }
```

### Price Guide
```
GET    /api/v1/ndis_price_guides
→ Current price guide rates

GET    /api/v1/ndis_price_guides/rate
→ Rate for specific category + residents
Params: { design_category: "high_physical_support", resident_count: 2 }
```

### Compliance
```
GET    /api/v1/sda/compliance
→ { properties: [{ id, address, documents: [{type, status, expiry}], score }] }
```

---

## Implementation Phases

### Phase 1: SDA Hub Shell + Properties Tab (1 week)
- Create `/sda` route with tab navigation
- Properties tab with TeeemTableView showing SDA properties
- Basic dashboard with stats cards
- Navigation item in sidebar
- Database migration for new SDA fields on properties

### Phase 2: Quick Enrol Wizard (1 week)
- Multi-step wizard component
- Property creation + SDA field population
- Document upload integration
- BPMN workflow trigger on completion

### Phase 3: Enrolments Pipeline (1 week)
- Kanban board view for enrolment stages
- Table view alternative
- Integration with BPMN workflow status
- SLA tracking and alerts

### Phase 4: Claims Tab (2 weeks)
- `ndis_claims` table + model
- `ndis_price_guides` table + seed data
- Monthly claim generation service
- Claims review and editing UI
- Manual submission tracking (pre-API)
- Claims history and reporting

### Phase 5: Compliance Tab (1 week)
- Compliance matrix view
- Document status tracking
- Expiry alerts
- Bulk compliance reporting

### Phase 6: NDIA API Integration (2-3 weeks, pending DPP access)
- Claims API submission
- Real-time status polling
- Payment reconciliation
- Xero sync for NDIS payments

---

## Pricing Model

The SDA Management Hub is part of the broader SDA module:

| Tier | SDA Properties | Enrolment | Claims | Compliance | Price/month |
|------|---------------|-----------|--------|------------|-------------|
| Starter | Up to 10 | Yes | Manual | Basic | $199 |
| Professional | Up to 50 | Yes | Auto | Full | $499 |
| Enterprise | Unlimited | Yes | Auto + API | Full + Alerts | $999 |

*Includes Package 1 (Enrolment) + Package 2 (Claims) features.*

---

## Future Enhancements

- **Participant Management** — Track SDA participants, their plans, funding levels
- **Vacancy Reporting** — Auto-submit vacancy data to NDIA (when API available)
- **SIL Integration** — Supported Independent Living claims alongside SDA
- **Multi-Provider** — Manage SDA dwellings across multiple NDIS provider registrations
- **Investor Portal** — Property investors can view SDA revenue and compliance status
- **AI Document Processing** — Auto-extract data from assessment certificates, fire safety statements
