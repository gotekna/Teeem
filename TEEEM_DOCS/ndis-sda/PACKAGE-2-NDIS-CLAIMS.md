# TEEEM NDIS Claims Automation Package

## Overview

Automate NDIS SDA payment claims directly from TEEEM using the NDIA Digital Partnership Program (DPP) REST APIs. Eliminate manual portal entry, reduce claim rejections, and get paid faster.

## Problem

SDA providers currently:
- Manually log into the myplace provider portal to submit each claim
- Calculate SDA payment amounts from price guides manually
- Risk rejected claims from data entry errors (wrong participant, wrong dates, wrong amounts)
- Wait days to discover a claim was rejected
- Can't easily reconcile NDIS payments against their accounting system
- Spend 5-10 hours/week on claims administration for a 20+ property portfolio

## Solution

### Feature 1: Automated Claim Submission

Submit SDA payment claims directly from TEEEM to NDIA via API:

```
TEEEM Property Data → Calculate Amount → Submit Claim → Track Payment
        ↓                    ↓                ↓              ↓
  Participant ID      SDA Price Guide     NDIA API      Auto-reconcile
  Dwelling type       Category rates      Real-time     with Xero
  Dates occupied      Pro-rata calc       response
```

**Claim data auto-populated from:**

| Claim Field | TEEEM Source |
|------------|--------------|
| Participant NDIS number | Tenant contact (custom field) |
| Service booking number | Property SDA booking reference |
| Claim period (from/to) | Tenancy dates |
| Support item number | SDA design category + building type |
| Quantity | Days occupied in period |
| Unit price | NDIA SDA Price Guide (auto-updated) |
| Total amount | Calculated (quantity x unit price) |
| GST | Auto-calculated per NDIA rules |

### Feature 2: SDA Price Guide Integration

Automatically apply correct SDA pricing:

| Design Category | 1 Resident | 2 Residents | 3 Residents |
|----------------|-----------|-------------|-------------|
| Improved Liveability | $24.04/day | $17.47/day | $14.69/day |
| Fully Accessible | $41.59/day | $30.06/day | $25.23/day |
| Robust | $31.81/day | $23.06/day | $19.35/day |
| High Physical Support | $62.47/day | $44.91/day | $37.66/day |

*Prices updated automatically when NDIA publishes new price guide*

- Auto-detects design category from property record
- Pro-rata calculations for partial periods
- Handles rate changes mid-period
- Vacancy period rules applied automatically

### Feature 3: Claim Status Dashboard

Real-time visibility into all claims:

```
Submitted → Processing → Approved → Paid
                       → Rejected (reason shown)
                       → Info Required (action needed)
```

- All claims in one view (not buried in NDIA portal)
- Filter by property, participant, period, status
- Rejected claim alerts with reason codes
- Resubmission workflow for rejected claims
- Monthly/quarterly summary reports

### Feature 4: Payment Reconciliation

Match NDIA payments to claims and sync with accounting:

- Auto-match incoming payments to submitted claims
- Flag discrepancies (partial payments, unexpected rejections)
- Xero integration: auto-create invoices and match payments
- Revenue reporting by property, design category, period

### Feature 5: Bulk Claims

Submit claims for entire portfolio in one action:

- Monthly bulk claim generation for all occupied SDA dwellings
- Review screen showing all claims before submission
- One-click submit all
- Progress tracking during bulk submission
- Error handling: continue on failure, report issues

## Technical Implementation

### NDIA API Integration

**Endpoints used (via Digital Partnership Program):**

```
POST   /api/claims              → Submit payment claim
GET    /api/claims/{id}         → Check claim status
GET    /api/claims              → List all claims
POST   /api/service-bookings    → Create/manage bookings
GET    /api/service-bookings    → List bookings
GET    /api/participants/{id}   → Verify participant details
```

**Authentication:** OAuth 2.0 (client credentials flow)

**Rate Limits:** Per DPP agreement (typically 100 requests/minute)

### Data Model

New models:

```ruby
# SDA Claim
class NdisClaim < ApplicationRecord
  belongs_to :property
  belongs_to :tenant_contact, class_name: "Contact"

  # Fields
  # ndis_participant_number: string
  # service_booking_number: string
  # claim_period_start: date
  # claim_period_end: date
  # support_item_number: string
  # quantity: decimal (days)
  # unit_price: decimal
  # total_amount: decimal
  # gst_amount: decimal
  # status: enum (draft, submitted, processing, approved, rejected, paid)
  # ndia_reference: string
  # rejection_reason: text
  # submitted_at: datetime
  # paid_at: datetime
end

# SDA Price Guide (updated annually)
class NdisPriceGuide < ApplicationRecord
  # design_category: string
  # building_type: string
  # resident_count: integer
  # daily_rate: decimal
  # effective_from: date
  # effective_to: date
end
```

### Integration Architecture

```
┌─────────────────────────────────────────────────┐
│                    TEEEM                          │
│                                                   │
│  Property ──→ NdisClaim ──→ NDIA API Gateway     │
│     ↓              ↑              ↓               │
│  Tenancy      Price Guide    Claim Response       │
│     ↓              ↑              ↓               │
│  Contact      Auto-calc     Status Updates        │
│                                   ↓               │
│                              Xero Sync            │
└─────────────────────────────────────────────────┘
```

### Security Requirements (DPP)

- OAuth 2.0 client credentials
- TLS 1.2+ for all API calls
- Audit log of all claim submissions
- PII handling compliant with Privacy Act 1988
- Annual security assessment

## Pricing Model (SaaS)

| Tier | Claims/month | Price/month |
|------|-------------|-------------|
| Starter | Up to 50 | $149 |
| Professional | Up to 200 | $399 |
| Enterprise | Unlimited | $799 |

*ROI: Saves 5-10 hours/week of admin time ($250-500/week at $50/hr)*

## Timeline

| Phase | Scope | Duration |
|-------|-------|----------|
| Phase 1 | NDIA API integration + single claim submission | 3 weeks |
| Phase 2 | Bulk claims + status dashboard | 2 weeks |
| Phase 3 | Price guide auto-update + calculations | 1 week |
| Phase 4 | Xero reconciliation | 2 weeks |
| Phase 5 | Reporting + analytics | 1 week |

**Prerequisite:** NDIA DPP API access approved (see email request)

## Compliance Notes

- All API usage subject to NDIA Terms of Use
- Claims must comply with NDIS (Provider Compliance and Enforcement) Rules
- Audit trail required for all automated submissions
- Provider remains responsible for claim accuracy (TEEEM is a tool, not a delegate)
