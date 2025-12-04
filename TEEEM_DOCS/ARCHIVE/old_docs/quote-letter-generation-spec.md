# Quote Letter Generation System - Feature Specification

## Overview

A comprehensive quote letter generation system that allows TEEEM users to create professional, branded quote PDFs with document attachments, electronic acceptance, customer feedback, and calendar integration.

## Business Problem

**Current Pain Point:**
- Customer information entered multiple times across different systems
- Manual quote letter creation in Word
- No tracking of whether customers have read quotes
- No easy way for customers to provide feedback or accept quotes
- Manual follow-up process

**Desired Outcome:**
- Single source of truth for all customer and job data
- Automated professional quote generation
- Track customer engagement (opened, read, accepted)
- Enable customer feedback and questions
- Streamline quote-to-job conversion
- Professional branding per trading entity

## Key Features Summary

### 1. Multi-Brand System
- Multiple trading entities under same ABN
- Each brand has unique logo, colors, contact details
- Office hours per brand
- Default brand configuration

### 2. Quote Templates
- HTML-based templates with variable placeholders
- Visual editor + Code view
- Copy templates to create new ones
- Different templates per job type (Lowset, Highset, Renovation, etc.)

### 3. Document Management
- Select documents from job folders
- Show validation status
- Attach to quotes
- Track document views

### 4. Customer Portal
- Public viewing link (token-based)
- Track opens and engagement
- Simple electronic acceptance
- Feedback and questions system
- Calendar booking integration

### 5. Office 365 Calendar Integration
- Check salesperson availability
- Customer books callback time
- Automatic calendar event creation
- Email confirmations

### 6. Task Management
- Automatic task creation on quote acceptance
- Tasks for customer questions
- Tasks for scheduled callbacks
- Assignment to salesperson

## Database Tables Needed

### New Tables:

**brands**
- trading_name
- logo_url
- phone, email, address, website
- office_hours (jsonb)
- primary_color, secondary_color, accent_color
- tagline
- is_active, is_default

**quote_templates**
- name, description
- html_content
- metadata (jsonb)
- is_active

**quote_template_job_types** (join table)
- quote_template_id
- job_type
- is_default

**generated_quotes**
- construction_id, estimate_id
- brand_id, quote_template_id, created_by_id
- quote_number, quote_date, valid_until
- status (draft, sent, viewed, accepted, expired)
- pdf_url, share_token
- tracking fields (sent_at, first_viewed_at, view_count, etc.)
- acceptance fields (accepted_at, accepted_by_name, accepted_by_ip)

**generated_quote_documents** (join table)
- generated_quote_id
- document_path, document_name, document_type
- display_order

### Modifications to Existing Tables:

**constructions**
- Add: brand_id
- Add: assigned_salesperson_id

**users**
- Add: office365_calendar_id
- Add: office365_email

## User Workflows

### Workflow 1: Setup Brands

1. Go to Settings → Brands
2. Create new brand
3. Upload logo
4. Set contact details and office hours
5. Choose brand colors
6. Set as default (optional)
7. Save

### Workflow 2: Setup Quote Templates

1. Go to Settings → Quote Templates
2. Copy existing template or create new
3. Edit in visual editor or code view
4. Insert variable placeholders
5. Associate with job types
6. Preview with sample data
7. Save

### Workflow 3: Generate Quote

1. Open job detail page
2. Click "Generate Quote"
3. Review pre-filled details (quote #, date, brand, template)
4. Select documents to attach (see validation status)
5. Preview PDF
6. Generate & Send
7. Customer receives email with link

### Workflow 4: Customer Experience

1. Customer receives email
2. Clicks "View Quote" link
3. Views quote online with branding
4. Can:
   - Download PDF
   - Accept quote (simple form)
   - Ask questions (feedback form)
   - Request callback (calendar booking)
5. All actions tracked

### Workflow 5: Salesperson Follow-up

1. Receives notification when customer acts
2. Tasks automatically created:
   - Quote accepted → Follow up task
   - Question asked → Respond within 24 hours
   - Callback requested → Meeting in calendar
3. Reply to customer through system
4. Mark tasks complete

## Key Components

### Component 1: Brand Management

**Location:** Settings → Brands

**Features:**
- List all brands
- Create/Edit brand
- Set default brand
- Activate/Deactivate
- Upload logo (auto-resize)
- Configure office hours
- Set brand colors

### Component 2: Quote Template Management

**Location:** Settings → Quote Templates

**Features:**
- List all templates
- Create/Edit template
- Dual editor (Visual + Code)
- Copy template
- Preview with sample data
- Associate with job types
- Variable placeholders for dynamic content

### Component 3: Job Setup

**Location:** Job Creation/Edit Form

**New Fields:**
- Brand selection (dropdown with default)
- Salesperson assignment (required)
- Display default quote template based on job type

### Component 4: Quote Generation

**Location:** Job Detail → Generate Quote

**Multi-Step Wizard:**
1. Quote details (number, date, validity)
2. Document selection (with validation status)
3. Customization (optional)
4. Preview
5. Generate & Send

### Component 5: Customer Portal

**Location:** Public URL `/quotes/:share_token`

**Features:**
- Branded quote display
- Countdown timer (office hours aware)
- Download PDF button
- Accept Quote button (simple e-signature)
- Ask Question button (feedback form)
- Request Callback button (calendar widget)
- Mobile responsive

### Component 6: Quote Dashboard

**Location:** Job Detail → Quotes Tab

**Features:**
- List all quotes for job
- View tracking stats
- Customer interaction history
- Conversation threads
- Resend/Edit options

### Component 7: Office 365 Integration

**Features:**
- Calendar permission setup
- Availability checking
- Time slot display
- Booking creation
- Meeting invites

## API Endpoints Summary

```ruby
# Brands
GET/POST    /api/v1/brands
GET/PATCH   /api/v1/brands/:id
POST        /api/v1/brands/:id/set_default

# Templates
GET/POST    /api/v1/quote_templates
GET/PATCH   /api/v1/quote_templates/:id
POST        /api/v1/quote_templates/:id/copy
GET         /api/v1/quote_templates/:id/preview

# Quotes
POST        /api/v1/constructions/:id/quotes
GET         /api/v1/constructions/:id/quotes
GET/PATCH   /api/v1/quotes/:id
POST        /api/v1/quotes/:id/send
GET         /api/v1/quotes/:id/pdf

# Customer Portal (public)
GET         /quotes/:share_token
POST        /quotes/:share_token/accept
POST        /quotes/:share_token/feedback
POST        /quotes/:share_token/callback
GET         /quotes/:share_token/availability
```

## Template Variables Available

### Customer
- `{{customer_name}}`
- `{{customer_email}}`
- `{{customer_phone}}`
- `{{customer_address}}`

### Job
- `{{job_title}}`
- `{{job_address}}`
- `{{job_type}}`

### Brand
- `{{brand_name}}`
- `{{brand_logo}}`
- `{{brand_phone}}`
- `{{brand_email}}`
- `{{brand_address}}`

### Quote
- `{{quote_number}}`
- `{{quote_date}}`
- `{{valid_until}}`
- `{{quote_total}}`
- `{{line_items_table}}`

### Salesperson
- `{{salesperson_name}}`
- `{{salesperson_phone}}`
- `{{salesperson_email}}`

## Implementation Phases

### Phase 1: Foundation (2 weeks)
- Database migrations
- Brand management UI
- Quote template management UI
- Job form updates

### Phase 2: Quote Generation (2 weeks)
- Generation wizard
- Document selection
- PDF generation
- Email sending

### Phase 3: Customer Portal (2 weeks)
- Public viewing page
- Acceptance functionality
- Feedback system
- View tracking

### Phase 4: Calendar Integration (2 weeks)
- Office 365 setup
- Availability checking
- Booking widget
- Event creation

### Phase 5: Polish (2 weeks)
- Task integration
- Email templates
- Mobile testing
- Security audit

## Technical Notes

### PDF Generation
- Use WickedPDF (HTML to PDF)
- Store in Active Storage
- Link to OneDrive for backup

### Security
- Share tokens: UUID
- Rate limiting (5 actions per 10 min)
- Log all actions with IP
- HTTPS only

### Email
- Use existing provider
- Track opens/clicks
- SPF/DKIM configured

### Calendar
- Microsoft Graph API
- Additional scopes needed
- Error handling for failures

## Success Metrics

- Time to create quote: < 5 minutes
- Quote open rate: > 60%
- Acceptance rate: +20% improvement
- Response time: < 24 hours
- Callback booking: > 30%

---

This specification provides everything needed to implement the Quote Letter Generation system for TEEEM.
