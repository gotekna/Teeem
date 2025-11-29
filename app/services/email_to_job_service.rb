require 'anthropic'

class EmailToJobService
  CLAUDE_MODEL = 'claude-sonnet-4-5-20250929'
  MAX_TOKENS = 2000
  RATE_LIMIT_PER_HOUR = 20

  class RateLimitError < StandardError; end
  class AIExtractionError < StandardError; end
  class JobCreationError < StandardError; end

  def initialize(email_warehouse, user:)
    @email = email_warehouse
    @user = user
  end

  # Main entry point - analyzes email and creates proposal
  def create_job_proposal
    # Check rate limit
    check_rate_limit!

    # Download PDF attachments if not already synced
    sync_pdf_attachments_if_needed

    # Extract data using Claude AI
    start_time = Time.current
    extracted_data = extract_job_data_with_ai
    processing_time = ((Time.current - start_time) * 1000).to_i

    # Get AI prompt and response for logging
    prompt = build_extraction_prompt
    ai_response = extracted_data.delete('_raw_response') # Remove from data, store separately

    # Create proposal record
    proposal = EmailJobProposal.create!(
      email_warehouse: @email,
      created_by_user: @user,
      extracted_data: extracted_data,
      ai_prompt: prompt,
      ai_response_raw: ai_response,
      processing_time_ms: processing_time,
      ai_model_used: CLAUDE_MODEL,
      status: 'pending'
    )

    Rails.logger.info "Created job proposal #{proposal.id} from email #{@email.id} with confidence #{extracted_data['confidence_score']}"

    proposal
  rescue RateLimitError => e
    Rails.logger.error "Rate limit hit for user #{@user.id}: #{e.message}"
    raise
  rescue StandardError => e
    Rails.logger.error "Job proposal creation failed: #{e.class} - #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")

    # Create error proposal
    EmailJobProposal.create!(
      email_warehouse: @email,
      created_by_user: @user,
      extracted_data: { error: e.message },
      status: 'error',
      error_message: e.message
    )
  end

  # Approve proposal and create actual job
  def approve_proposal(proposal, user_edits: {})
    # Merge user edits with AI-extracted data
    job_data = proposal.extracted_data.deep_merge(user_edits)

    # Determine customer contact
    # Priority: user-selected client > AI-detected customer
    customer = nil
    if user_edits['client_contact_id'].present?
      customer = Contact.find_by(id: user_edits['client_contact_id'])
    else
      # Fallback to AI-detected customer
      customer = find_or_create_customer(job_data['customer'])
    end

    # Check if extracted "customer" is actually a sales agent
    is_sales_agent = customer&.is_sales? || customer&.is_land_agent?

    # Map AI job type to system job_type_id
    job_type_id = map_job_type(job_data['job_type']) || user_edits['job_type_id']

    # Default to "Enquiry" status for new jobs from email
    job_status_id = user_edits['job_status_id'] || JobStatus.find_by(name: 'Enquiry')&.id

    # Create job
    job = Job.create!(
      title: user_edits['job_title'] || job_data['job_title'] || "Job from #{@email.from_email}",
      job_type_id: job_type_id,
      job_status_id: job_status_id,
      site_supervisor_name: @user.name,
      site_supervisor_email: @user.email,
      site_supervisor_phone: @user.mobile_phone,
      contract_value: user_edits['contract_value'] || job_data['contract_value']&.to_f
    )

    # Link customer to job
    # If they're a sales agent, link as external_sales instead of client
    if customer
      if is_sales_agent
        # This is a sales agent sending on behalf of their client
        job.job_contacts.create!(
          contact: customer,
          role: 'external_sales',
          primary: false
        )
        Rails.logger.info "Linked #{customer.full_name} as external_sales (detected as sales agent)"
      else
        # Normal customer - link as client
        job.job_contacts.create!(
          contact: customer,
          role: 'client',
          primary: true
        )
      end
    end

    # Link internal sales rep (the user who dropped the email in the folder)
    if @email.synced_by_user && @email.synced_by_user.id != @user.id
      link_internal_sales_rep(job, @email.synced_by_user)
    end

    # Find and link external sales reps from email chain
    link_external_sales_reps(job, @email)

    # Link external sales from user manual selection
    if user_edits['external_sales_contact_ids'].present?
      user_edits['external_sales_contact_ids'].each do |contact_id|
        link_external_sales_contact(job, contact_id)
      end
    end

    # Link referral contact if detected or manually selected
    if user_edits['referral_contact_id'].present?
      link_referral_contact_by_id(job, user_edits['referral_contact_id'])
    elsif job_data['referral_contact'].present?
      link_referral_contact(job, job_data)
    end

    # Link email to job
    @email.assign_to_job!(job, by_user: @user)

    # Mark proposal as approved
    proposal.mark_approved!(by_user: @user, job: job)

    # Log activity
    JobActivity.log_job_created(job, user: @user)

    Rails.logger.info "Job #{job.id} created from proposal #{proposal.id}"

    job
  rescue StandardError => e
    Rails.logger.error "Job creation from proposal failed: #{e.message}"
    proposal.mark_error!(error_msg: e.message)
    raise JobCreationError, e.message
  end

  private

  def check_rate_limit!
    recent_count = EmailJobProposal
      .where(created_by_user: @user)
      .where('created_at > ?', 1.hour.ago)
      .count

    if recent_count >= RATE_LIMIT_PER_HOUR
      raise RateLimitError, "Too many proposals created recently. Limit: #{RATE_LIMIT_PER_HOUR} per hour."
    end
  end

  def extract_job_data_with_ai
    prompt = build_extraction_prompt

    begin
      response = call_claude_api(prompt)
      raw_response = response # Store raw for logging

      # Parse JSON response
      extracted = parse_json_response(response)

      # Add raw response for logging (will be removed before storing)
      extracted['_raw_response'] = raw_response

      # Add internal and external sales person detection
      add_sales_people_info(extracted)

      extracted
    rescue JSON::ParserError => e
      # AI returned invalid JSON - create low confidence response
      Rails.logger.error "Claude returned invalid JSON: #{e.message}"
      data = {
        'job_title' => @email.subject,
        'customer' => {
          'name' => @email.from_name || extract_name_from_email(@email.from_email),
          'email' => @email.from_email
        },
        'confidence_score' => 0.1,
        'error' => 'AI returned invalid response',
        'missing_info' => ['all fields - AI extraction failed'],
        '_raw_response' => response
      }
      add_sales_people_info(data)
      data
    end
  end

  def build_extraction_prompt
    # Get email body (prefer text, fallback to stripped HTML)
    email_body = @email.body_text.presence || strip_html(@email.body_html)

    # Extract text from PDF attachments if present
    pdf_content = nil
    if @email.files.attached?
      pdf_texts = @email.extract_pdf_text
      if pdf_texts.present?
        pdf_content = pdf_texts.map do |pdf|
          "--- PDF Attachment: #{pdf[:filename]} (#{pdf[:pages]} pages) ---\n#{pdf[:text]}"
        end.join("\n\n")
      end
    end

    <<~PROMPT
      You are analyzing an email to extract information for creating a construction job in Australia.

      Email details:
      From: #{@email.from_email}#{" (#{@email.from_name})" if @email.from_name.present?}
      Subject: #{@email.subject}
      Date: #{@email.received_at}
      Has Attachments: #{@email.has_attachments ? 'Yes' : 'No'}

      Email Body:
      #{email_body}

      #{pdf_content.present? ? "\nPDF Attachments Content:\n#{pdf_content}" : ""}

      Extract the following information and return ONLY valid JSON (no markdown, no code blocks, just raw JSON):

      {
        "job_title": "Property address if mentioned (e.g., '123 Main Street, Brisbane QLD 4000'), otherwise infer from context or use subject line",
        "customer": {
          "name": "Customer's full name (if not mentioned, extract from email sender name)",
          "email": "Customer email (use sender email if customer is the sender)",
          "phone": "Phone number if mentioned in email",
          "company": "Company name if mentioned",
          "entity_type": "person or company (infer from context)"
        },
        "referral": {
          "name": "Name of person who referred this job (look for phrases like 'referred by', 'recommended by', 'sent by', or similar)",
          "email": "Email of referral person if mentioned",
          "phone": "Phone of referral person if mentioned",
          "company": "Company of referral person if mentioned"
        },
        "description": "Brief 1-2 sentence description of what the customer wants",
        "scope_of_work": "Detailed scope extracted from email - what needs to be built/renovated/fixed",
        "contract_value": null or estimated value if mentioned as a number (no currency symbols),
        "urgency": "urgent, normal, or low based on language used",
        "job_type": "renovation, new_build, extension, repair, or other",
        "attachments_mentioned": ["list of any files mentioned or attached"],
        "confidence_score": 0.0 to 1.0 based on how much critical information is present,
        "missing_info": ["list of critical missing information like 'property address', 'customer name', 'scope of work', etc."]
      }

      Confidence scoring guidelines:
      - 0.9-1.0: Clear address, customer details, specific scope, attachments
      - 0.7-0.89: Address and customer identified, general scope mentioned
      - 0.5-0.69: Some info present but key details missing (e.g., no address or vague scope)
      - 0.3-0.49: Minimal information, mostly missing critical data
      - 0.0-0.29: Almost no usable information

      Important notes for Australian context:
      - Look for Australian address formats (Street, Suburb, State, Postcode)
      - Common Australian phone formats: (07) 3xxx xxxx, 0412 xxx xxx, +61 7 xxxx xxxx
      - If email mentions "quote" or "estimate", customer likely wants pricing
      - Be conservative with confidence_score - only high if address and customer are very clear
      - In missing_info, list ALL critical information that's not found or unclear
      - Return ONLY the JSON object, no additional text, no markdown formatting
    PROMPT
  end

  def call_claude_api(prompt)
    api_key = ENV['ANTHROPIC_API_KEY']
    raise AIExtractionError, "ANTHROPIC_API_KEY not configured" unless api_key

    client = Anthropic::Client.new(
      access_token: api_key,
      anthropic_version: "2023-06-01"  # Required for Messages API
    )

    # Call Claude API using the Messages API (anthropic gem v0.3+)
    response = client.messages(
      parameters: {
        model: "claude-3-haiku-20240307",  # Claude 3 Haiku (fast & available)
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      }
    )

    # Extract text from response
    response.dig("content", 0, "text") || response.dig(:content, 0, :text) || ""
  rescue Anthropic::Error => e
    Rails.logger.error "Anthropic API error: #{e.message}"
    raise AIExtractionError, "Claude API error: #{e.message}"
  end

  def parse_json_response(response_text)
    # Try to find JSON in response (Claude sometimes adds explanation)
    # Look for JSON object between curly braces
    json_match = response_text.match(/\{.*\}/m)

    if json_match
      JSON.parse(json_match[0])
    else
      # No JSON found
      raise JSON::ParserError, "No JSON object found in response"
    end
  end

  def find_or_create_customer(customer_data)
    return nil unless customer_data.is_a?(Hash)

    email = customer_data['email']
    return nil unless email.present?

    # Try to find existing contact by email
    contact = Contact.find_by(email: email)
    return contact if contact

    # Create new contact
    Contact.create!(
      email: email,
      full_name: customer_data['name'],
      mobile_phone: normalize_phone(customer_data['phone']),
      company_name_or_trust: customer_data['company'],
      entity_type: customer_data['entity_type'] || 'person',
      contact_types: ['customer']
    )
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error "Failed to create customer: #{e.message}"
    # Try to find by email again in case of race condition
    Contact.find_by(email: email)
  end

  def normalize_phone(phone)
    return nil if phone.blank?

    # Remove common formatting characters
    phone.gsub(/[\s\-\(\)]/, '')
  end

  def strip_html(html)
    return nil if html.blank?

    # Basic HTML stripping for AI prompt
    html.gsub(/<[^>]*>/, ' ')
        .gsub(/&nbsp;/, ' ')
        .gsub(/&[a-z]+;/, ' ')
        .gsub(/\s+/, ' ')
        .strip
  end

  def extract_name_from_email(email)
    # Extract name from email address like john.smith@example.com -> John Smith
    local_part = email.split('@').first
    local_part.split(/[._]/).map(&:capitalize).join(' ')
  end

  # Map AI-extracted job type text to system JobType ID
  def map_job_type(ai_job_type)
    return nil if ai_job_type.blank?

    # Mapping of AI job type keywords to your system's JobType names
    type_mappings = {
      'renovation' => 'House Renovation',
      'extension' => 'House Renovation',
      'new_build' => 'House',
      'new build' => 'House',
      'house' => 'House',
      'duplex' => 'Duplex',
      'townhouse' => 'Townhouse',
      'apartment' => 'Micro Apartment',
      'unit' => 'Townhouse',
      'kitchen' => 'Kitchen',
      'repair' => 'House Renovation',
      'ndis' => 'NDIS House'
    }

    # Try exact match first
    matched_name = type_mappings[ai_job_type.downcase]

    # Find the JobType by name
    if matched_name
      JobType.find_by(name: matched_name)&.id
    else
      # Default to House Renovation for general construction work
      JobType.find_by(name: 'House Renovation')&.id
    end
  end

  # Link internal sales rep to job
  def link_internal_sales_rep(job, sales_user)
    # Check if user has an associated contact record
    contact = Contact.find_by(email: sales_user.email)
    return unless contact

    # Link as internal sales rep (avoid duplicates)
    unless job.job_contacts.exists?(contact: contact, role: 'internal_sales')
      job.job_contacts.create!(
        contact: contact,
        role: 'internal_sales',
        primary: false
      )
      Rails.logger.info "Linked internal sales rep #{sales_user.name} to job #{job.id}"
    end
  rescue StandardError => e
    Rails.logger.error "Failed to link internal sales rep: #{e.message}"
  end

  # Find and link external sales reps from email participants
  def link_external_sales_reps(job, email)
    # Get all email participants (from, to, cc)
    all_participants = [
      email.from_email,
      *email.to_emails,
      *email.cc_emails
    ].compact.uniq

    # Find contacts who are sales agents
    all_participants.each do |participant_email|
      contact = Contact.find_by(email: participant_email)
      next unless contact

      # Check if this contact is a sales agent
      # (they have 'sales' or 'agent' in their contact_types or their role)
      is_sales = contact.contact_types&.any? { |t| t.match?(/sales|agent/i) } ||
                 contact.primary_role&.match?(/sales|agent/i)

      if is_sales
        # Link as external sales (avoid duplicates)
        unless job.job_contacts.exists?(contact: contact, role: 'external_sales')
          job.job_contacts.create!(
            contact: contact,
            role: 'external_sales',
            primary: false
          )
          Rails.logger.info "Linked external sales rep #{contact.full_name} to job #{job.id}"
        end
      end
    end
  rescue StandardError => e
    Rails.logger.error "Failed to link external sales reps: #{e.message}"
  end

  # Link external sales contact by ID (from user manual selection)
  def link_external_sales_contact(job, contact_id)
    contact = Contact.find_by(id: contact_id)
    return unless contact

    # Link as external sales (avoid duplicates)
    unless job.job_contacts.exists?(contact: contact, role: 'external_sales')
      job.job_contacts.create!(
        contact: contact,
        role: 'external_sales',
        primary: false
      )
      Rails.logger.info "Linked external sales #{contact.full_name} to job #{job.id} (user selected)"
    end
  rescue StandardError => e
    Rails.logger.error "Failed to link external sales contact: #{e.message}"
  end

  # Link referral contact to job (from AI detection)
  def link_referral_contact(job, job_data)
    referral_data = job_data['referral_contact']
    return unless referral_data.is_a?(Hash) && referral_data['contact_id'].present?

    contact = Contact.find_by(id: referral_data['contact_id'])
    return unless contact

    # Link as referral (avoid duplicates)
    unless job.job_contacts.exists?(contact: contact, role: 'referral')
      job.job_contacts.create!(
        contact: contact,
        role: 'referral',
        primary: false
      )
      Rails.logger.info "Linked referral #{contact.full_name} to job #{job.id}"
    end
  rescue StandardError => e
    Rails.logger.error "Failed to link referral contact: #{e.message}"
  end

  # Link referral contact by ID (from user manual selection)
  def link_referral_contact_by_id(job, contact_id)
    contact = Contact.find_by(id: contact_id)
    return unless contact

    # Link as referral (avoid duplicates)
    unless job.job_contacts.exists?(contact: contact, role: 'referral')
      job.job_contacts.create!(
        contact: contact,
        role: 'referral',
        primary: false
      )
      Rails.logger.info "Linked referral #{contact.full_name} to job #{job.id} (user selected)"
    end
  rescue StandardError => e
    Rails.logger.error "Failed to link referral contact: #{e.message}"
  end

  # Add sales people detection to extracted data
  def add_sales_people_info(extracted_data)
    # Internal sales: The user who synced/forwarded the email (Jake, Robert, etc.)
    internal_sales_user = @user
    internal_sales_contact = Contact.find_by(email: internal_sales_user.email)

    extracted_data['internal_sales'] = {
      'user_name' => internal_sales_user.name,
      'user_email' => internal_sales_user.email,
      'contact_exists' => internal_sales_contact.present?,
      'contact_id' => internal_sales_contact&.id,
      'needs_contact_creation' => internal_sales_contact.nil?
    }

    # External sales: Search email participants for sales agents
    all_participants = [
      @email.from_email,
      *@email.to_emails,
      *@email.cc_emails
    ].compact.uniq

    external_sales = []
    all_participants.each do |participant_email|
      # Skip if this is the internal sales person
      next if participant_email == internal_sales_user.email
      # Skip if this is the customer
      next if participant_email == extracted_data.dig('customer', 'email')

      contact = Contact.find_by(email: participant_email)

      # Check if this person might be a sales agent
      is_sales_agent = contact && (
        contact.contact_types&.any? { |t| t.match?(/sales|agent/i) } ||
        contact.primary_role&.match?(/sales|agent/i)
      )

      # Also check email domain for common sales/real estate patterns
      is_likely_sales = participant_email.match?(/@(realestate|ljhooker|century21|ray-white|bodable)/i)

      if is_sales_agent || is_likely_sales
        external_sales << {
          'email' => participant_email,
          'name' => contact&.full_name || extract_name_from_email(participant_email),
          'contact_exists' => contact.present?,
          'contact_id' => contact&.id,
          'needs_contact_creation' => contact.nil?,
          'detected_reason' => is_sales_agent ? 'existing_contact_marked_as_sales' : 'email_domain_pattern'
        }
      end
    end

    extracted_data['external_sales'] = external_sales

    # Referral: Check if AI extracted a referral person
    referral_data = extracted_data['referral']
    if referral_data.is_a?(Hash) && referral_data['name'].present?
      referral_email = referral_data['email']
      referral_contact = nil

      # Try to find existing contact by email
      if referral_email.present?
        referral_contact = Contact.find_by(email: referral_email)
      end

      # If no email or no contact found, try searching by name
      if referral_contact.nil? && referral_data['name'].present?
        referral_contact = Contact.where("LOWER(full_name) LIKE ?", "%#{referral_data['name'].downcase}%").first
      end

      extracted_data['referral_contact'] = {
        'name' => referral_data['name'],
        'email' => referral_email,
        'phone' => referral_data['phone'],
        'company' => referral_data['company'],
        'contact_exists' => referral_contact.present?,
        'contact_id' => referral_contact&.id,
        'needs_contact_creation' => referral_contact.nil?
      }
    else
      extracted_data['referral_contact'] = nil
    end

    extracted_data
  end

  def sync_pdf_attachments_if_needed
    # Skip if no attachments or already synced
    return unless @email.has_attachments && !@email.files.attached?

    begin
      outlook_service = OutlookService.new(@user)
      @email.sync_attachments_from_outlook(outlook_service)
      Rails.logger.info "Synced #{@email.files.count} PDF attachments for email #{@email.id}"
    rescue StandardError => e
      Rails.logger.error "Failed to sync attachments for email #{@email.id}: #{e.message}"
      # Don't fail the whole process if attachment sync fails
    end
  end
end
