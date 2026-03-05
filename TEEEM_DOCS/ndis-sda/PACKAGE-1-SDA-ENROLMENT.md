# TEEEM SDA Dwelling Enrolment Package

## Overview

Streamline the NDIS Specialist Disability Accommodation (SDA) dwelling enrolment process by auto-generating enrolment forms, tracking approval status, and managing compliance documentation — all from existing TEEEM property data.

## Problem

SDA providers currently:
- Manually fill out NDIA enrolment forms (PDF or portal) for each property
- Re-enter data that already exists in their property management system
- Track enrolment status via spreadsheets or email
- Lose time chasing compliance documents across multiple systems
- Risk errors from manual data entry (wrong design category, missing certs)

## Solution

### Feature 1: Auto-Generated Enrolment Forms

Pre-fill the NDIA SDA Dwelling Enrolment Form from TEEEM property data:

| Enrolment Field | TEEEM Source |
|----------------|--------------|
| Provider name & number | Company Settings |
| Dwelling address | Property address |
| Design category (Improved Liveability / Fully Accessible / Robust / High Physical Support) | Property custom field |
| Building type (Apartment / Duplex / Group home / House / Townhouse / Villa) | Property type field |
| Number of bedrooms | Property bedrooms field |
| Number of residents | Property custom field / tenancy |
| Fire safety features | Property compliance documents |
| Accessibility features checklist | Property custom fields |
| Supporting photos | Property documents (warehouse) |

**Output:** Pre-filled PDF form ready for submission, or copy-paste data for the my NDIS provider portal.

### Feature 2: Enrolment Status Tracker

Track each property through the NDIA approval pipeline:

```
Draft → Submitted → Under Review → Info Requested → Approved → Enrolled
                                  → Rejected (with reasons)
```

- Dashboard showing all properties and their enrolment status
- Automated reminders when 28-day SLA is approaching
- Document checklist per property (what's submitted, what's missing)
- History log of all submissions and NDIA responses

### Feature 3: Compliance Document Manager

Link required compliance documents to each SDA property:

| Required Document | Status |
|-------------------|--------|
| Building compliance certificate | Uploaded / Missing / Expired |
| SDA design standard assessment | Uploaded / Missing |
| Fire safety statement | Uploaded / Missing / Expired |
| Accessibility audit report | Uploaded / Missing |
| Photos (exterior, interior, accessibility features) | 12/15 uploaded |
| Floor plans | Uploaded / Missing |

- Expiry tracking with automated alerts
- Bulk export for NDIA submission
- Version history for re-submissions

### Feature 4: SDA Property Dashboard

Dedicated view for SDA portfolio management:

- Total enrolled dwellings vs pending
- Vacancy status (feeds into NDIA vacancy reporting)
- Design category breakdown
- Compliance status overview (all green / items needing attention)
- Revenue per dwelling (links to Claims package)

## Technical Implementation

### Data Model

New fields on Property model (or custom fields via Foundation):
- `sda_design_category` (enum: improved_liveability, fully_accessible, robust, high_physical_support)
- `sda_building_type` (enum: apartment, duplex, group_home, house, townhouse, villa)
- `sda_enrolment_status` (enum: draft, submitted, under_review, info_requested, approved, enrolled, rejected)
- `sda_enrolment_date` (date)
- `sda_enrolled_date` (date)
- `sda_max_residents` (integer)
- `ndis_dwelling_id` (string - NDIA reference number)

### PDF Generation

Use existing TEEEM PDF generation (wkhtmltopdf or similar) to produce the NDIA enrolment form pre-filled with property data.

### Integration Points

- Property detail page → new "SDA" tab
- Documents tab → SDA compliance folder auto-created
- Portal → Owner can view enrolment status
- Notifications → Expiry alerts, status change alerts

## Pricing Model (SaaS)

| Tier | Properties | Price/month |
|------|-----------|-------------|
| Starter | Up to 10 | $99 |
| Professional | Up to 50 | $299 |
| Enterprise | Unlimited | $599 |

Add-on: Compliance monitoring + alerts: +$49/month

## Timeline

| Phase | Scope | Duration |
|-------|-------|----------|
| Phase 1 | Property SDA fields + status tracker | 2 weeks |
| Phase 2 | PDF form generation | 1 week |
| Phase 3 | Compliance document manager | 2 weeks |
| Phase 4 | SDA dashboard + portal view | 1 week |

## Future: NDIA API Integration

When NDIA opens dwelling enrolment APIs (currently manual only):
- Direct submission from TEEEM → NDIA
- Real-time status updates
- Automated vacancy reporting
