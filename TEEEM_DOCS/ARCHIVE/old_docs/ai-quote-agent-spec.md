# AI Quote Collection Agent - Feature Specification

## Overview

An intelligent automation system that streamlines the supplier quoting process by automatically reaching out to suppliers when new jobs are created, collecting quotes via email, and updating the pricebook with current pricing information.

---

## Business Problem

**Current Manual Process**:
1. New job is created with specific requirements
2. Estimator manually reviews job requirements
3. Estimator looks up relevant items in pricebook
4. Estimator identifies which suppliers to contact
5. Estimator drafts individual emails to each supplier
6. Estimator waits for responses (may take days)
7. Estimator manually updates pricebook with new quotes
8. Estimator compares quotes and selects best option

**Pain Points**:
- Time-consuming manual process (hours per job)
- Risk of missing suppliers or items
- Outdated pricebook information
- Human error in data entry
- Delayed estimates waiting for quotes
- Inconsistent email templates
- Difficulty tracking quote status

---

## Solution: AI-Powered Quote Agent

An automated agent that handles the entire quote collection workflow from trigger to pricebook update, saving hours of manual work and ensuring data accuracy.

---

## Key Features

### 1. Automatic Trigger on New Job
- Monitors for new job creation in TEEEM
- Analyzes job requirements and specifications
- Identifies required materials, equipment, or services
- Triggers quote collection workflow automatically

### 2. Intelligent Supplier Matching
- Cross-references job requirements with pricebook
- Identifies which items need current quotes
- Matches items to relevant suppliers in contacts database
- Considers supplier history, ratings, and specializations
- Supports multiple suppliers per item for comparison

### 3. Personalized Email Generation
- Drafts professional, context-aware quote requests
- Includes job details, specifications, and quantities
- Uses consistent branding and templates
- Personalizes based on supplier relationship history
- Attaches relevant documents or drawings if needed

### 4. Email Monitoring & Response Parsing
- Monitors designated email inbox for supplier responses
- Uses AI to parse unstructured email content
- Extracts key information: pricing, lead times, availability, terms
- Handles various email formats and attachments
- Recognizes and processes quote PDFs or spreadsheets

### 5. Automatic Pricebook Updates
- Updates pricebook with extracted quote data
- Timestamps quotes for freshness tracking
- Links quotes to specific suppliers and jobs
- Maintains quote history for auditing
- Flags significant price changes for review

### 6. Status Tracking & Follow-Up
- Tracks quote request status (sent, received, pending)
- Sends automatic follow-up reminders after X days
- Escalates non-responsive suppliers to team
- Provides dashboard of quote collection progress
- Estimates completion timeline

### 7. Quote Comparison & Recommendations
- Compares quotes across multiple suppliers
- Calculates total costs including shipping/fees
- Considers lead times and availability
- Factors in supplier reliability ratings
- Suggests optimal supplier selection

---

## Data Model

### Required Tables in TEEEM

**Jobs** (may already exist):
- id
- name
- status (new, quoting, quoted, in_progress, completed)
- requirements (text or structured data)
- estimated_start_date
- created_at

**Pricebook**:
- id
- item_name
- item_code
- category
- description
- unit_of_measure
- current_price
- last_quoted_date
- supplier_id (foreign key)
- lead_time_days
- notes

**Contacts/Suppliers**:
- id
- company_name
- contact_name
- email
- phone
- supplier_type (materials, equipment, services)
- specializations (tags/categories)
- rating (1-5 stars)
- notes

**Job_Items** (bridge table):
- id
- job_id
- pricebook_item_id
- quantity
- estimated_cost
- actual_cost
- supplier_id
- quote_status (requested, received, approved, ordered)

**Quote_Requests** (audit trail):
- id
- job_id
- supplier_id
- pricebook_item_id
- status (sent, received, expired, declined)
- email_sent_at
- email_received_at
- requested_by (AI or user)
- email_thread_id

**Quotes** (historical quotes):
- id
- quote_request_id
- supplier_id
- pricebook_item_id
- quoted_price
- lead_time_days
- valid_until_date
- quote_notes
- received_at
- raw_email_content (for reference)

---

## Technical Architecture

### Integration Points

#### 1. Lindy.ai Integration
**Why Lindy.ai**:
- No-code AI agent builder
- Built-in email integration
- Natural language processing capabilities
- Easy webhook configuration
- Can handle complex workflows
- Supports conditional logic

**Lindy Agent Configuration**:
- **Trigger**: Webhook from TEEEM when new job created
- **Actions**:
  - Query TEEEM API for job details and required items
  - Query TEEEM API for supplier contacts
  - Generate personalized emails using AI
  - Send emails via integrated email service
  - Monitor email inbox for responses
  - Parse email responses using NLP
  - Send parsed data back to TEEEM via webhook

#### 2. TEEEM Backend (Rails)
**New API Endpoints Needed**:

```ruby
# Webhook receiver for Lindy
POST /api/v1/webhooks/lindy
  - Receives quote data from Lindy agent
  - Validates and sanitizes data
  - Updates pricebook records
  - Creates quote history entries
  - Returns success/error response

# Job trigger endpoint
POST /api/v1/jobs/:id/trigger_quote_agent
  - Manually trigger agent for a job
  - Gathers job data and returns JSON payload
  - Creates quote_request records
  - Calls Lindy webhook to start process

# Quote status endpoint
GET /api/v1/jobs/:id/quote_status
  - Returns quote collection progress
  - Lists pending/received quotes
  - Shows estimated completion time

# Supplier recommendations
GET /api/v1/jobs/:id/supplier_recommendations
  - Returns AI analysis of best suppliers
  - Factors in price, lead time, rating
  - Provides comparison matrix
```

**Background Jobs**:
```ruby
# Auto-trigger on job creation
class TriggerQuoteAgentJob < ApplicationJob
  queue_as :default

  def perform(job_id)
    job = Job.find(job_id)
    # Send webhook to Lindy to start agent
    LindyWebhookService.trigger_quote_collection(job)
  end
end

# Follow-up reminders
class QuoteFollowUpJob < ApplicationJob
  queue_as :default

  def perform
    # Find quote requests > 3 days old with no response
    # Trigger Lindy to send follow-up emails
  end
end
```

#### 3. Email Service
**Options**:
- **Gmail API** (if using business Gmail)
- **SendGrid** (professional email delivery)
- **Mailgun** (good for programmatic sending)
- **Microsoft Graph API** (if using Outlook/Office 365)

**Lindy.ai** handles email integration natively, so likely will use their built-in capabilities.

#### 4. Database Schema Updates
```ruby
# Migration to add quote-related tables
class CreateQuotingTables < ActiveRecord::Migration[8.0]
  def change
    create_table :jobs do |t|
      t.string :name
      t.string :status, default: 'new'
      t.text :requirements
      t.date :estimated_start_date
      t.timestamps
    end

    create_table :pricebook do |t|
      t.string :item_name
      t.string :item_code
      t.string :category
      t.text :description
      t.string :unit_of_measure
      t.decimal :current_price, precision: 10, scale: 2
      t.date :last_quoted_date
      t.references :supplier, foreign_key: { to_table: :contacts }
      t.integer :lead_time_days
      t.text :notes
      t.timestamps
    end

    create_table :contacts do |t|
      t.string :company_name
      t.string :contact_name
      t.string :email
      t.string :phone
      t.string :supplier_type
      t.string :specializations, array: true, default: []
      t.integer :rating
      t.text :notes
      t.timestamps
    end

    create_table :job_items do |t|
      t.references :job, foreign_key: true
      t.references :pricebook_item, foreign_key: { to_table: :pricebook }
      t.decimal :quantity, precision: 10, scale: 2
      t.decimal :estimated_cost, precision: 10, scale: 2
      t.decimal :actual_cost, precision: 10, scale: 2
      t.references :supplier, foreign_key: { to_table: :contacts }
      t.string :quote_status, default: 'requested'
      t.timestamps
    end

    create_table :quote_requests do |t|
      t.references :job, foreign_key: true
      t.references :supplier, foreign_key: { to_table: :contacts }
      t.references :pricebook_item, foreign_key: { to_table: :pricebook }
      t.string :status, default: 'sent'
      t.datetime :email_sent_at
      t.datetime :email_received_at
      t.string :requested_by
      t.string :email_thread_id
      t.timestamps
    end

    create_table :quotes do |t|
      t.references :quote_request, foreign_key: true
      t.references :supplier, foreign_key: { to_table: :contacts }
      t.references :pricebook_item, foreign_key: { to_table: :pricebook }
      t.decimal :quoted_price, precision: 10, scale: 2
      t.integer :lead_time_days
      t.date :valid_until_date
      t.text :quote_notes
      t.datetime :received_at
      t.text :raw_email_content
      t.timestamps
    end
  end
end
```

---

## User Interface

### 1. Jobs Page
**New Job Creation**:
- Checkbox: "Auto-collect supplier quotes" (checked by default)
- Shows quote collection status banner when active
- Displays progress: "Collecting quotes... 3 of 7 received"

**Job Detail View**:
- Quote Status Section showing:
  - Requested suppliers and items
  - Response status (pending/received)
  - Time since request sent
  - Follow-up scheduled time
- Quote Comparison Table:
  - Item | Supplier | Price | Lead Time | Rating | Action
  - Sortable columns
  - "Select" button to approve supplier

### 2. Pricebook Page
**Enhanced with Quote Data**:
- "Last Quoted" date column
- "Quote Age" indicator (green < 30 days, yellow < 90 days, red > 90 days)
- "Request New Quote" button for individual items
- Quote history modal showing price trends over time

### 3. Contacts/Suppliers Page
**Supplier Performance**:
- Response rate metric
- Average response time
- Quote accuracy (estimated vs actual)
- Reliability rating (auto-calculated + manual override)

### 4. Settings > Integrations
**Lindy.ai Configuration**:
- API key input
- Email account connection status
- Agent status (active/paused)
- Email template customization
- Follow-up timing settings (default: 3 days)
- Notification preferences

### 5. Dashboard Widget
**Quote Collection Summary**:
- Active quote requests count
- Average response time
- Quotes received today/this week
- Pending follow-ups
- Quick action: "Trigger bulk pricebook refresh"

---

## Workflow Diagram

```
┌─────────────────┐
│  New Job        │
│  Created        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  TEEEM Backend │
│  - Creates job  │
│  - Triggers     │
│    webhook      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Lindy.ai Agent │
│  Receives       │
│  Webhook        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Query TEEEM   │
│  - Get job data │
│  - Get items    │
│  - Get suppliers│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Generate       │
│  Emails with AI │
│  - Personalize  │
│  - Add context  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Send Emails    │
│  to Suppliers   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Monitor Inbox  │
│  - Watch for    │
│    responses    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Parse Response │
│  - Extract data │
│  - NLP parsing  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Send to TEEEM │
│  via Webhook    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Update         │
│  Pricebook      │
│  - Save quote   │
│  - Update price │
│  - Log history  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Notify User    │
│  Quote Received │
└─────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (1-2 weeks)
- ✅ Create database tables for jobs, pricebook, contacts, quotes
- ✅ Build basic CRUD UI for managing these tables
- ✅ Create API endpoints for webhook integration
- ✅ Set up Lindy.ai account and basic agent

### Phase 2: Lindy Integration (1 week)
- Configure Lindy agent with TEEEM webhook triggers
- Build email template generation logic
- Test email sending to real suppliers
- Implement response monitoring

### Phase 3: Email Parsing (1-2 weeks)
- Train Lindy agent to parse various email formats
- Build logic to extract pricing, lead times, terms
- Handle edge cases (PDFs, spreadsheets, unclear responses)
- Test with historical supplier emails

### Phase 4: Pricebook Updates (1 week)
- Build webhook receiver endpoint
- Implement data validation and sanitization
- Create quote history logging
- Build pricebook update logic with audit trail

### Phase 5: UI Development (1-2 weeks)
- Build quote status dashboard
- Create quote comparison interface
- Add supplier performance metrics
- Build settings/configuration page

### Phase 6: Testing & Refinement (1 week)
- End-to-end testing with real jobs
- Refine email templates based on supplier feedback
- Optimize parsing accuracy
- Fix edge cases and bugs

### Phase 7: Production Rollout (1 week)
- Gradual rollout to selected jobs
- Monitor performance and accuracy
- Collect user feedback
- Full rollout to all new jobs

---

## Success Metrics

### Efficiency Gains
- **Time Saved**: Target 80% reduction in manual quote collection time
- **Response Rate**: Target 90%+ supplier response rate
- **Accuracy**: Target 95%+ accurate parsing of supplier responses

### Business Impact
- **Faster Estimates**: Reduce quote turnaround from days to hours
- **Pricebook Freshness**: 80%+ of items quoted within 90 days
- **Cost Savings**: Better pricing through broader supplier comparison
- **Error Reduction**: 90%+ reduction in data entry errors

### User Adoption
- **Activation Rate**: 80%+ of new jobs use auto-quote feature
- **Satisfaction**: 4.5/5 star rating from estimators
- **Manual Override**: <10% of quote requests require manual intervention

---

## Risks & Mitigation

### Risk 1: Email Parsing Accuracy
**Risk**: AI may misinterpret supplier responses
**Mitigation**:
- Human review queue for uncertain parses
- Confidence scoring on extracted data
- Continuous learning from corrections

### Risk 2: Supplier Pushback
**Risk**: Suppliers may not like automated emails
**Mitigation**:
- Professional, personalized templates
- Option for suppliers to opt into "API mode"
- Human touch points for key relationships

### Risk 3: Email Deliverability
**Risk**: Emails marked as spam
**Mitigation**:
- Use authenticated email domain (SPF, DKIM)
- Professional email templates
- Reasonable sending frequency limits

### Risk 4: Data Privacy/Security
**Risk**: Sensitive pricing data in emails
**Mitigation**:
- Encrypted email storage
- Access controls on quote data
- Audit logging of all data access

### Risk 5: Lindy.ai Dependency
**Risk**: External service downtime or changes
**Mitigation**:
- Fallback to manual process if Lindy unavailable
- Abstract integration layer for potential future replacement
- Monitor Lindy.ai status and SLA

---

## Cost Estimate

### Development Time
- Backend: 40 hours
- Frontend: 30 hours
- Lindy.ai Configuration: 20 hours
- Testing: 20 hours
- **Total**: ~110 hours

### Operational Costs
- **Lindy.ai**: ~$99-299/month (depending on plan and usage)
- **Email Service**: ~$10-50/month (if separate from Lindy)
- **Heroku**: No additional cost (within existing infrastructure)
- **Total**: ~$110-350/month

### ROI Calculation
If saves 5 hours/week per estimator:
- 5 hours × $50/hour = $250/week
- $250/week × 4 weeks = $1,000/month saved
- **ROI**: Positive after first month

---

## Future Enhancements

### Version 2.0
- Multi-language support for international suppliers
- Supplier portal for direct quote submission
- Integration with accounting software (QuickBooks, Xero)
- Predictive pricing based on historical trends
- Automatic purchase order generation

### Version 3.0
- Machine learning for supplier selection optimization
- Contract negotiation automation
- Volume discount calculations
- Alternative product suggestions
- Market price monitoring and alerts

---

## Questions to Answer

Before starting implementation:

1. **Email Account**: Which email will the agent use? Dedicated account or shared?
2. **Supplier List**: How many suppliers typically quoted per job?
3. **Response Time**: What's acceptable turnaround for quotes?
4. **Approval Process**: Should all pricebook updates be auto-approved or require review?
5. **Existing Tools**: Any current quoting software that needs integration?
6. **Email Format**: Do suppliers currently use any standardized format?
7. **Volume**: How many jobs per week will trigger this agent?
8. **Fallback**: If no response after X days, what happens?

---

## Getting Started Checklist

- [ ] Set up Lindy.ai account
- [ ] Create dedicated email account for agent
- [ ] Design database schema for jobs, pricebook, contacts, quotes
- [ ] Build basic CRUD interfaces for new tables
- [ ] Create webhook endpoints in TEEEM backend
- [ ] Configure Lindy agent with test workflow
- [ ] Send test emails to friendly suppliers
- [ ] Build quote parsing logic
- [ ] Create quote dashboard UI
- [ ] Run pilot with 2-3 real jobs
- [ ] Collect feedback and iterate
- [ ] Full production rollout

---

*Document created: October 29, 2025*
*Status: Planning Phase*
*Next Review: Before Phase 1 implementation*
