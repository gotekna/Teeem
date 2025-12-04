# Email-to-Job Creation Implementation Plan

## Executive Summary

This plan outlines how to implement email-based job creation in TEEEM, allowing users to create new jobs either by:
1. **Sending emails to a dedicated address** (e.g., newjob@tekna.com.au)
2. **Drag-and-drop interface** where emails can be dragged into the application

The system will use AI to extract job details, customer information, and attachments from the email content.

---

## Current System Analysis

### Existing Infrastructure (What We Already Have)

#### ✅ Email System
- **EmailWarehouse model** - Stores all synced emails with full-text search
- **Outlook integration** - Active Microsoft Graph API integration
- **Email sync jobs** - Background jobs running every 10 minutes
- **Email-to-job matching** - Auto-assignment logic already exists
- **Email parser service** - Extracts structured data from emails

#### ✅ Job Management
- **Job model** - Complete job creation and management system
- **Job contacts** - Links contacts to jobs with roles (client, representative, etc.)
- **Job activities** - Activity logging for all job events
- **OneDrive folder creation** - Auto-creates job folders on creation

#### ✅ Contact Management
- **Contact model** - Comprehensive contact system with multiple types
- **Entity types** - Person, Company, Trust
- **Contact types** - Customer, Supplier, Sales, Land Agent
- **Xero sync** - Two-way sync with accounting system

#### ✅ AI Integration
- **Anthropic Claude API** - Already integrated (PlanReviewService)
- **API key configured** - Available via ENV['ANTHROPIC_API_KEY']
- **SmAiService** - Existing AI service pattern to follow

#### ✅ File Attachments
- **ActiveStorage** - Configured and working (DocumentTask model)
- **Cloudinary** - Image storage configured
- **Document tasks** - Job-specific document management

#### ✅ Background Jobs
- **SolidQueue** - Background job processor already configured
- **Recurring tasks** - Email sync runs every 10 minutes
- **Job patterns** - Multiple existing job examples (EmailWarehouseSyncJob, etc.)

---

## Implementation Approaches

### Approach 1: Email Forwarding/Dedicated Inbox (RECOMMENDED)

**How it works:**
1. User sets up email forwarding rule: newjob@tekna.com.au → system processes
2. System syncs this dedicated inbox folder every 10 minutes
3. When new email arrives, AI analyzes content and creates job automatically
4. User reviews and confirms job details in UI

**Pros:**
- ✅ Uses existing Outlook integration infrastructure
- ✅ Works with current email sync system (10-minute intervals)
- ✅ No new email service required
- ✅ Users can forward from any email client
- ✅ Can batch process multiple emails efficiently

**Cons:**
- ❌ Not real-time (10-minute delay)
- ❌ Requires email forwarding setup
- ❌ Needs dedicated Outlook folder monitoring

**Technical Implementation:**
1. Add special folder monitoring to EmailWarehouseSyncService
2. Create JobCreationFromEmailJob background job
3. Create EmailToJobService using Claude API
4. Add UI for reviewing pending job creations

### Approach 2: Drag-and-Drop from Existing Emails

**How it works:**
1. User browses their synced emails in TEEEM
2. Drags email onto "Create Job" drop zone
3. System extracts data via AI and creates job
4. User confirms/edits details

**Pros:**
- ✅ Uses emails already in the warehouse
- ✅ More user control over which emails create jobs
- ✅ No email forwarding setup required
- ✅ Can leverage existing email matching logic
- ✅ Immediate feedback (no waiting for sync)

**Cons:**
- ❌ Requires emails to be synced first (existing flow)
- ❌ More manual than automatic forwarding
- ❌ Requires frontend drag-drop implementation

**Technical Implementation:**
1. Add "Create Job from Email" API endpoint
2. Frontend drag-drop component
3. EmailToJobService with Claude AI extraction
4. Job creation workflow with confirmation step

### Approach 3: Hybrid (BEST USER EXPERIENCE)

Combine both approaches:
- **Automatic**: Monitor dedicated folder for forwarded emails
- **Manual**: Drag-and-drop from email warehouse
- Same backend service handles both paths

---

## Detailed Technical Design

### 1. Database Schema Changes

**New Table: `email_job_proposals`**
```ruby
create_table :email_job_proposals do |t|
  t.references :email_warehouse, foreign_key: true, null: false
  t.references :created_by_user, foreign_key: { to_table: :users }, null: false
  t.references :job, foreign_key: true, null: true # Null until approved

  # AI-extracted data
  t.jsonb :extracted_data, default: {}, null: false
  # Structure: {
  #   job_title: "123 Main Street, Suburb",
  #   customer: { name: "John Smith", email: "...", phone: "..." },
  #   description: "Client wants new deck",
  #   attachments: [...],
  #   confidence_score: 0.85
  # }

  # AI processing metadata
  t.text :ai_prompt
  t.text :ai_response_raw
  t.integer :processing_time_ms

  # Status tracking
  t.string :status, default: 'pending' # pending, approved, rejected, error
  t.text :rejection_reason

  # Approval tracking
  t.references :approved_by_user, foreign_key: { to_table: :users }
  t.datetime :approved_at

  t.timestamps
end

add_index :email_job_proposals, :status
add_index :email_job_proposals, [:email_warehouse_id, :status]
```

**Optional: Dedicated Email Folder Tracking**
```ruby
add_column :email_sync_statuses, :monitor_job_creation_folder, :boolean, default: false
add_column :email_sync_statuses, :job_creation_folder_id, :string
```

### 2. New Service: EmailToJobService

```ruby
class EmailToJobService
  CLAUDE_MODEL = 'claude-sonnet-4-5-20250929'

  def initialize(email_warehouse, user:)
    @email = email_warehouse
    @user = user
    @anthropic_client = Anthropic::Client.new(api_key: ENV['ANTHROPIC_API_KEY'])
  end

  # Main entry point - analyzes email and creates proposal
  def create_job_proposal
    # 1. Extract data using Claude AI
    extracted_data = extract_job_data_with_ai

    # 2. Create proposal record
    proposal = EmailJobProposal.create!(
      email_warehouse: @email,
      created_by_user: @user,
      extracted_data: extracted_data,
      status: 'pending'
    )

    # 3. Return proposal for user review
    proposal
  end

  # Approve proposal and create actual job
  def approve_proposal(proposal, user_edits: {})
    # Merge user edits with AI-extracted data
    job_data = proposal.extracted_data.deep_merge(user_edits)

    # Create job
    job = Job.create!(
      title: job_data['job_title'],
      contract_value: job_data['contract_value'],
      site_supervisor_name: @user.name,
      site_supervisor_email: @user.email,
      # ... other fields
    )

    # Create/link customer contact
    customer = find_or_create_customer(job_data['customer'])
    job.job_contacts.create!(contact: customer, role: 'client', primary: true)

    # Link email to job
    @email.assign_to_job!(job, by_user: @user)

    # Download and attach files from email
    attach_email_files(job) if @email.has_attachments

    # Update proposal
    proposal.update!(
      job: job,
      status: 'approved',
      approved_by_user: @user,
      approved_at: Time.current
    )

    job
  end

  private

  def extract_job_data_with_ai
    prompt = build_extraction_prompt

    response = @anthropic_client.messages.create(
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    )

    # Parse AI response (expects JSON)
    JSON.parse(response.dig('content', 0, 'text'))
  end

  def build_extraction_prompt
    <<~PROMPT
      You are analyzing an email to extract information for creating a construction job.

      Email details:
      From: #{@email.from_email} (#{@email.from_name})
      Subject: #{@email.subject}
      Date: #{@email.received_at}

      Body:
      #{@email.body_text || strip_html(@email.body_html)}

      Extract the following information and return ONLY valid JSON:
      {
        "job_title": "Property address if mentioned, otherwise infer from context",
        "customer": {
          "name": "Customer name",
          "email": "Customer email (use From email if customer is sender)",
          "phone": "Phone number if mentioned",
          "company": "Company name if mentioned",
          "entity_type": "person or company"
        },
        "description": "Brief description of what the customer wants",
        "contract_value": null or estimated value if mentioned,
        "urgency": "urgent, normal, or low",
        "job_type": "renovation, new_build, extension, or other",
        "scope_of_work": "Detailed scope extracted from email",
        "attachments_mentioned": ["list of files mentioned or attached"],
        "confidence_score": 0.0 to 1.0 based on information quality,
        "missing_info": ["list of critical missing information"]
      }

      Important:
      - If address is not explicitly mentioned, try to infer from signature or context
      - Use the From email as customer email unless email mentions a different client
      - Be conservative with confidence_score - only high if address and customer are clear
      - List ALL missing critical information (address, customer name, scope, etc.)
    PROMPT
  end

  def find_or_create_customer(customer_data)
    # Try to find existing contact by email
    contact = Contact.find_by(email: customer_data['email'])
    return contact if contact

    # Create new contact
    Contact.create!(
      email: customer_data['email'],
      full_name: customer_data['name'],
      mobile_phone: customer_data['phone'],
      company_name: customer_data['company'],
      entity_type: customer_data['entity_type'] || 'person',
      contact_types: ['customer']
    )
  end

  def attach_email_files(job)
    # Note: Would need to implement Outlook attachment download
    # via Microsoft Graph API - fetch attachments from email
    # and attach to job using ActiveStorage
  end

  def strip_html(html)
    # Basic HTML stripping for AI prompt
    html&.gsub(/<[^>]*>/, ' ')&.gsub(/\s+/, ' ')&.strip
  end
end
```

### 3. Background Job: JobCreationFromEmailJob

```ruby
class JobCreationFromEmailJob < ApplicationJob
  queue_as :default

  def perform(email_warehouse_id, user_id)
    email = EmailWarehouse.find(email_warehouse_id)
    user = User.find(user_id)

    service = EmailToJobService.new(email, user: user)
    proposal = service.create_job_proposal

    # Notify user that proposal is ready for review
    # Could use ActionCable, email notification, or in-app notification
    notify_user_of_proposal(user, proposal)

  rescue StandardError => e
    Rails.logger.error "Job creation from email failed: #{e.message}"
    # Could create error notification for user
  end

  private

  def notify_user_of_proposal(user, proposal)
    # Implementation depends on notification system
    # For now, could just log or create a notification record
  end
end
```

### 4. API Endpoints

```ruby
# config/routes.rb
namespace :api do
  namespace :v1 do
    resources :email_job_proposals, only: [:index, :show, :create, :update] do
      member do
        post :approve
        post :reject
      end
    end

    # Shortcut endpoint for drag-and-drop
    post 'email_warehouse/:id/create_job', to: 'email_warehouse#create_job_from_email'
  end
end

# app/controllers/api/v1/email_job_proposals_controller.rb
class Api::V1::EmailJobProposalsController < ApplicationController
  # GET /api/v1/email_job_proposals
  # List pending proposals for review
  def index
    proposals = EmailJobProposal
      .includes(:email_warehouse, :created_by_user)
      .where(status: params[:status] || 'pending')
      .order(created_at: :desc)
      .page(params[:page])

    render json: { proposals: proposals.map { |p| serialize_proposal(p) } }
  end

  # POST /api/v1/email_job_proposals
  # Create new proposal from email
  def create
    email = EmailWarehouse.find(params[:email_warehouse_id])
    service = EmailToJobService.new(email, user: current_user)
    proposal = service.create_job_proposal

    render json: { success: true, proposal: serialize_proposal(proposal) }
  end

  # POST /api/v1/email_job_proposals/:id/approve
  # Approve proposal and create job
  def approve
    proposal = EmailJobProposal.find(params[:id])
    service = EmailToJobService.new(proposal.email_warehouse, user: current_user)

    user_edits = params[:edits] || {}
    job = service.approve_proposal(proposal, user_edits: user_edits)

    render json: {
      success: true,
      job: job.as_json,
      message: "Job '#{job.title}' created successfully"
    }
  end

  # POST /api/v1/email_job_proposals/:id/reject
  def reject
    proposal = EmailJobProposal.find(params[:id])
    proposal.update!(
      status: 'rejected',
      rejection_reason: params[:reason]
    )

    render json: { success: true }
  end
end
```

### 5. Frontend Components

**React Component: EmailJobProposalCard**
```jsx
// Displays AI-extracted job data for review
function EmailJobProposalCard({ proposal, onApprove, onReject, onEdit }) {
  const { extracted_data } = proposal;
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState({});

  return (
    <div className="border rounded-lg p-6 shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold">
            {extracted_data.job_title || 'No address detected'}
          </h3>
          <p className="text-sm text-gray-500">
            From: {proposal.email.from_email}
          </p>
        </div>
        <div className={`px-3 py-1 rounded text-sm ${
          extracted_data.confidence_score > 0.8 ? 'bg-green-100 text-green-800' :
          extracted_data.confidence_score > 0.5 ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {Math.round(extracted_data.confidence_score * 100)}% confidence
        </div>
      </div>

      {/* Extracted Data */}
      <div className="space-y-3 mb-4">
        <DataField
          label="Customer"
          value={extracted_data.customer.name}
          editable={editing}
          onChange={(v) => setEdits({...edits, customer: {...edits.customer, name: v}})}
        />
        <DataField label="Email" value={extracted_data.customer.email} />
        <DataField label="Phone" value={extracted_data.customer.phone} />
        <DataField label="Scope" value={extracted_data.scope_of_work} />
      </div>

      {/* Missing Info Warning */}
      {extracted_data.missing_info?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
          <p className="text-sm font-medium text-yellow-800">Missing Information:</p>
          <ul className="text-sm text-yellow-700 list-disc list-inside">
            {extracted_data.missing_info.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => setEditing(!editing)}
          className="btn-secondary"
        >
          {editing ? 'Cancel Edit' : 'Edit Details'}
        </button>
        <button
          onClick={() => onApprove(proposal.id, edits)}
          className="btn-primary"
        >
          Create Job
        </button>
        <button
          onClick={() => onReject(proposal.id)}
          className="btn-ghost text-red-600"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
```

**Drag-and-Drop Integration**
```jsx
// Add to email list view
function EmailList({ emails }) {
  const handleDragStart = (e, email) => {
    e.dataTransfer.setData('email_id', email.id);
  };

  return (
    <div>
      {emails.map(email => (
        <div
          key={email.id}
          draggable
          onDragStart={(e) => handleDragStart(e, email)}
          className="cursor-move"
        >
          {/* Email content */}
        </div>
      ))}
    </div>
  );
}

// Drop zone component
function CreateJobDropZone() {
  const handleDrop = async (e) => {
    e.preventDefault();
    const emailId = e.dataTransfer.getData('email_id');

    // Call API to create proposal
    const response = await api.post('/email_job_proposals', {
      email_warehouse_id: emailId
    });

    // Show proposal review modal
    showProposalReview(response.data.proposal);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center"
    >
      <p className="text-gray-600">Drop email here to create job</p>
    </div>
  );
}
```

---

## Implementation Phases

### Phase 1: Core AI Extraction (Week 1)
- [ ] Create `email_job_proposals` table migration
- [ ] Implement `EmailToJobService` with Claude AI
- [ ] Add API endpoints for proposal CRUD
- [ ] Test AI extraction with sample emails
- [ ] Tune AI prompts for accuracy

**Success Criteria:**
- AI can extract job details with >70% accuracy
- Service can create proposals from emails
- API returns structured data

### Phase 2: Manual Drag-and-Drop (Week 2)
- [ ] Implement drag-and-drop UI components
- [ ] Build proposal review interface
- [ ] Add edit capabilities for AI-extracted data
- [ ] Implement approval workflow
- [ ] Add customer matching/creation logic

**Success Criteria:**
- Users can drag emails to create jobs
- Review interface shows all extracted data
- Users can edit before approving
- Jobs are created with correct relationships

### Phase 3: Attachment Handling (Week 3)
- [ ] Implement Microsoft Graph attachment download
- [ ] Attach files to jobs using ActiveStorage
- [ ] Support PDF, images, and documents
- [ ] Handle attachment size limits
- [ ] Add attachment preview in proposal review

**Success Criteria:**
- Email attachments download successfully
- Files attach to created jobs
- Users can preview attachments

### Phase 4: Automatic Monitoring (Week 4)
- [ ] Add dedicated folder monitoring to EmailWarehouseSyncService
- [ ] Create JobCreationFromEmailJob background job
- [ ] Implement notification system for new proposals
- [ ] Add batch processing for multiple emails
- [ ] Create admin dashboard for monitoring

**Success Criteria:**
- System automatically detects emails in designated folder
- Proposals created without user action
- Users notified of pending proposals
- Batch processing works efficiently

### Phase 5: Polish & Optimization (Week 5)
- [ ] Add Trinity documentation entries
- [ ] Create user guide for email-to-job feature
- [ ] Implement error handling and retry logic
- [ ] Add analytics/metrics tracking
- [ ] Performance optimization for AI calls
- [ ] Add caching for common extractions

**Success Criteria:**
- Documentation complete in Trinity system
- Users can successfully create jobs from emails
- Error handling is robust
- Performance is acceptable (<10s per email)

---

## Configuration & Setup

### 1. Email Forwarding Setup (Option A)

**For Microsoft 365/Outlook:**
1. Create email forwarding rule in Outlook:
   - Rule: "If sent to newjob@tekna.com.au"
   - Action: "Move to folder 'TEEEM - Job Creation'"
2. Configure EmailWarehouseSyncService to monitor this folder
3. Set `monitor_job_creation_folder: true` in email_sync_statuses

### 2. Environment Variables

```bash
# Already configured
ANTHROPIC_API_KEY=sk-ant-...  # For Claude AI

# Optional: Rate limiting
EMAIL_JOB_CREATION_MAX_PER_HOUR=20
```

### 3. SolidQueue Configuration

Add to `config/solid_queue.yml`:
```yaml
production:
  recurring_tasks:
    - key: monitor_job_creation_emails
      class_name: MonitorJobCreationEmailsJob
      schedule: every 10 minutes  # Same as existing email sync
```

---

## AI Prompt Engineering

### Prompt Template Strategy

**Version 1: Basic Extraction**
- Extract obvious fields only
- High confidence threshold (>0.8)
- Focus on address and customer

**Version 2: Enhanced Context**
- Use email thread history for context
- Look for attachments with plans/specs
- Infer job type from language

**Version 3: Smart Defaults**
- Learn from previously created jobs
- Suggest based on customer history
- Pre-fill common fields

### Confidence Scoring

```ruby
# Low confidence (0.0-0.4): Missing critical info
- No address found
- No clear customer identified
- Ambiguous scope

# Medium confidence (0.5-0.7): Some info missing
- Address found but not confirmed
- Customer identified but no contact details
- General scope mentioned

# High confidence (0.8-1.0): Complete information
- Clear address in email
- Customer details present
- Specific scope of work
- Attachments with plans
```

---

## Testing Strategy

### Unit Tests
```ruby
# spec/services/email_to_job_service_spec.rb
RSpec.describe EmailToJobService do
  describe '#extract_job_data_with_ai' do
    context 'with complete email' do
      let(:email) { create(:email_warehouse, :with_job_details) }

      it 'extracts all job fields' do
        service = described_class.new(email, user: user)
        data = service.send(:extract_job_data_with_ai)

        expect(data['job_title']).to be_present
        expect(data['customer']['email']).to eq(email.from_email)
        expect(data['confidence_score']).to be > 0.7
      end
    end

    context 'with minimal email' do
      let(:email) { create(:email_warehouse, :minimal) }

      it 'returns low confidence' do
        service = described_class.new(email, user: user)
        data = service.send(:extract_job_data_with_ai)

        expect(data['confidence_score']).to be < 0.5
        expect(data['missing_info']).to include('address')
      end
    end
  end
end
```

### Integration Tests
```ruby
# spec/requests/email_job_proposals_spec.rb
RSpec.describe 'Email Job Proposals' do
  describe 'POST /api/v1/email_job_proposals' do
    it 'creates proposal from email' do
      email = create(:email_warehouse)

      post '/api/v1/email_job_proposals', params: {
        email_warehouse_id: email.id
      }

      expect(response).to have_http_status(:success)
      expect(EmailJobProposal.count).to eq(1)
    end
  end

  describe 'POST /api/v1/email_job_proposals/:id/approve' do
    it 'creates job from proposal' do
      proposal = create(:email_job_proposal)

      post "/api/v1/email_job_proposals/#{proposal.id}/approve"

      expect(response).to have_http_status(:success)
      expect(Job.count).to eq(1)
      expect(proposal.reload.status).to eq('approved')
    end
  end
end
```

### Manual Testing Checklist
- [ ] Email with clear address and customer details
- [ ] Email with missing address
- [ ] Email from existing customer
- [ ] Email from new customer
- [ ] Email with attachments (PDF plans)
- [ ] Email thread (multiple back-and-forth)
- [ ] Email with pricing information
- [ ] Email with urgent request
- [ ] Bulk test: 10 emails at once
- [ ] Edge case: Forwarded email
- [ ] Edge case: Email with multiple properties mentioned

---

## Error Handling

### AI API Failures
```ruby
def extract_job_data_with_ai
  start_time = Time.current

  begin
    response = @anthropic_client.messages.create(...)
    extracted_data = JSON.parse(response.dig('content', 0, 'text'))

    # Add metadata
    extracted_data['_meta'] = {
      processing_time_ms: ((Time.current - start_time) * 1000).to_i,
      model: CLAUDE_MODEL,
      tokens_used: response['usage']
    }

    extracted_data

  rescue Anthropic::RateLimitError => e
    # Queue for retry after delay
    raise RetryableError, "Rate limit hit, retry in 60s"

  rescue JSON::ParserError => e
    # AI returned invalid JSON - try to salvage or fail gracefully
    {
      'job_title' => @email.subject,
      'customer' => { 'email' => @email.from_email },
      'confidence_score' => 0.1,
      'error' => 'AI returned invalid response',
      'missing_info' => ['all fields - AI extraction failed']
    }

  rescue StandardError => e
    Rails.logger.error("AI extraction failed: #{e.message}")
    Sentry.capture_exception(e) if defined?(Sentry)
    raise
  end
end
```

### Email Sync Failures
- If email sync fails, jobs won't be created
- Monitor EmailSyncStatus for errors
- Notify admins if sync has been failing >1 hour

### Job Creation Validation Errors
- Proposal saved even if job creation fails
- User can edit and retry
- Log validation errors for analysis

---

## Security Considerations

### 1. Email Content Privacy
- Only process emails from authenticated users
- Don't expose full email content in logs
- Sanitize AI prompts of sensitive data

### 2. Customer Data
- Verify email addresses before creating contacts
- Don't auto-create contacts for internal emails
- Flag suspicious patterns (spam, phishing)

### 3. Rate Limiting
```ruby
# Prevent abuse of AI API
class EmailToJobService
  MAX_PROPOSALS_PER_USER_PER_HOUR = 20

  def create_job_proposal
    # Check rate limit
    recent_count = EmailJobProposal
      .where(created_by_user: @user)
      .where('created_at > ?', 1.hour.ago)
      .count

    if recent_count >= MAX_PROPOSALS_PER_USER_PER_HOUR
      raise RateLimitError, "Too many proposals created recently"
    end

    # ... proceed
  end
end
```

### 4. API Key Protection
- Never log or expose ANTHROPIC_API_KEY
- Use Rails encrypted credentials in production
- Monitor API usage for anomalies

---

## Cost Analysis

### Anthropic Claude API Costs

**Model:** Claude Sonnet 4.5
- **Input:** $3 per million tokens
- **Output:** $15 per million tokens

**Per Email Estimate:**
- Prompt (email content): ~1,000 tokens
- Response (JSON data): ~500 tokens
- **Cost per email:** ~$0.01

**Monthly Projections:**
- 50 jobs/month: $0.50
- 200 jobs/month: $2.00
- 1000 jobs/month: $10.00

**Conclusion:** Cost is negligible compared to time saved.

### Infrastructure Costs
- No additional servers required (uses SolidQueue)
- No additional storage (uses existing DB)
- Email sync already running (no extra cost)

---

## Rollout Plan

### Beta Phase (Internal Testing)
1. Deploy to staging environment
2. Test with Tekna internal team (5-10 users)
3. Collect feedback on AI accuracy
4. Iterate on prompts and UI

### Limited Release (Select Customers)
1. Enable for 2-3 power users
2. Monitor usage and success rates
3. Track: proposals created, approval rate, time saved
4. Fix bugs and improve UX

### General Availability
1. Announce feature in release notes
2. Add to user documentation
3. Create video tutorial
4. Monitor adoption rates
5. Collect user feedback

---

## Success Metrics

### Quantitative
- **Proposal Creation Rate:** % of emails that generate proposals
- **Approval Rate:** % of proposals that become jobs
- **Time to Job Creation:** Average time from email → approved job
- **AI Accuracy:** % of proposals requiring no edits
- **User Adoption:** # of users using feature monthly

### Qualitative
- User satisfaction survey
- Time saved vs manual entry
- Reduction in data entry errors
- Improved customer response time

### Target KPIs (After 3 Months)
- 70% approval rate for AI proposals
- 50% reduction in job creation time
- 80% user satisfaction rating
- <5% error rate in extracted data

---

## Future Enhancements

### Phase 2 Features
1. **Smart Reply Suggestions**
   - AI generates response templates
   - "Thanks for your inquiry, we'll call you at..."

2. **Automatic Document Classification**
   - AI categorizes attachments (plans, specs, quotes)
   - Auto-files into correct job folder

3. **Price Estimation**
   - AI estimates job value from scope
   - Compares to historical similar jobs

4. **Multi-property Detection**
   - Detect when email mentions multiple addresses
   - Create multiple job proposals

5. **Email Thread Analysis**
   - Analyze full conversation history
   - Extract evolving requirements

6. **Template Learning**
   - Learn from user edits
   - Improve accuracy over time

### Integration Opportunities
- **SMS-to-Job:** Apply same logic to text messages
- **Voice-to-Job:** Transcribe voicemails and extract data
- **Form-to-Job:** Pre-fill web forms with AI

---

## Recommended Approach: Hybrid Implementation

**Start with Manual Drag-and-Drop (Phases 1-3)**
- Lower risk, faster to market
- Users have full control
- Validate AI accuracy first

**Add Automatic Monitoring (Phase 4)**
- After AI proven accurate (>70% approval rate)
- Users trust the system
- Can handle edge cases

**Benefits of Hybrid:**
- Flexibility for different workflows
- Gradual user adoption
- Lower initial complexity
- Easier troubleshooting

---

## Open Questions for User

1. **Dedicated Email Address:**
   - Preferred format: newjob@tekna.com.au or jobs@tekna.com.au?
   - Should it be per-user or organization-wide?

2. **Approval Workflow:**
   - Auto-create jobs for high-confidence (>0.9)?
   - Or always require manual approval?

3. **Customer Matching:**
   - When email sender matches existing customer, link automatically?
   - Or always ask user to confirm?

4. **Attachment Handling:**
   - Auto-download all attachments?
   - Or let user select which to attach?

5. **Notification Preference:**
   - Email notification when proposal ready?
   - In-app notification only?
   - Both?

6. **Priority Implementation:**
   - Start with drag-and-drop OR dedicated inbox?
   - Which would provide most immediate value?

---

## Summary Recommendation

**Implement Hybrid Approach in 5 Phases:**

1. ✅ **Week 1:** Build AI extraction service (core)
2. ✅ **Week 2:** Add manual drag-and-drop UI (quick win)
3. ✅ **Week 3:** Implement attachment handling
4. ⏸️ **Week 4:** Add automatic monitoring (after validation)
5. ⏸️ **Week 5:** Polish and optimize

**This approach:**
- Delivers value quickly (Week 2)
- Validates AI accuracy before automation
- Minimizes risk
- Allows iterative improvement
- Keeps costs low

**Expected Outcome:**
- Reduce job creation time by 50%
- Improve data accuracy
- Enable faster customer response
- Scale to handle growth
