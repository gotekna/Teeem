require "anthropic"

class EmailToJobService
  CLAUDE_MODEL = "claude-sonnet-4-5-20250929"
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
    ai_response = extracted_data.delete("_raw_response") # Remove from data, store separately

    # Create proposal record
    proposal = EmailJobProposal.create!(
      email_warehouse: @email,
      created_by_user: @user,
      extracted_data: extracted_data,
      ai_prompt: prompt,
      ai_response_raw: ai_response,
      processing_time_ms: processing_time,
      ai_model_used: CLAUDE_MODEL,
      status: "pending"
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
      status: "error",
      error_message: e.message
    )
  end

  # Public method for re-extracting data (used by re_extract endpoint)
  def extract_job_data
    sync_pdf_attachments_if_needed
    extract_job_data_with_ai
  end

  # Approve proposal and create actual job
  def approve_proposal(proposal, user_edits: {})
    # If job was already created (e.g., via Price Up), just link and approve
    if user_edits["skip_job_creation"] && user_edits["linked_job_id"].present?
      job = Job.find(user_edits["linked_job_id"])
      proposal.update!(status: "approved", job_id: job.id)
      return job
    end

    # Merge user edits with AI-extracted data
    job_data = proposal.extracted_data.deep_merge(user_edits)

    # Determine customer contact
    # Priority: user-selected client > AI-detected customer
    customer = nil
    if user_edits["client_contact_id"].present?
      customer = Contact.find_by(id: user_edits["client_contact_id"])
    else
      # Fallback to AI-detected customer
      customer = find_or_create_customer(job_data["customer"])
    end

    # Check if extracted "customer" is actually a sales agent
    is_sales_agent = customer&.is_sales? || customer&.is_land_agent?

    # Map AI job type to system job_type_id
    job_type_id = map_job_type(job_data["job_type"]) || user_edits["job_type_id"]

    # Default to "Enquiry" status for new jobs from email
    enquiry_status = JobStatus.find_by(name: "Enquiry")
    job_status_id = user_edits["job_status_id"] || enquiry_status&.id

    # Set the stage based on user edit or default to "Proposal" for email proposals
    job_stage_id = user_edits["job_stage_id"]
    if job_stage_id.nil? && job_status_id == enquiry_status&.id
      # Default to "Proposal" stage for email-created jobs
      proposal_stage = JobStage.find_by(job_status_id: enquiry_status&.id, name: "Proposal")
      job_stage_id = proposal_stage&.id
    end

    # Get property address and geocode it
    property_address = user_edits["property_address"] || job_data["property_address"]
    location_data = {}

    if property_address.present?
      begin
        address_service = JobAddressService.new
        geocode_result = address_service.geocode_address(property_address)

        if geocode_result
          location_data = {
            location: geocode_result[:formatted_address],
            latitude: geocode_result[:latitude],
            longitude: geocode_result[:longitude]
          }
          Rails.logger.info "Geocoded address '#{property_address}': #{location_data[:location]} (#{location_data[:latitude]}, #{location_data[:longitude]})"
        else
          # If geocoding fails, still save the address text
          location_data = { location: property_address }
          Rails.logger.warn "Geocoding failed for '#{property_address}', saving address text only"
        end
      rescue StandardError => e
        Rails.logger.error "Error geocoding address: #{e.message}"
        # Fallback to saving just the address text
        location_data = { location: property_address }
      end
    end

    # Create job
    # SSoT: Supervisor is stored via job_contacts (role: "supervisor"), not legacy columns
    job = Job.create!(
      title: user_edits["job_title"] || job_data["job_title"] || "Job from #{@email.from_email}",
      job_type_id: job_type_id,
      job_status_id: job_status_id,
      job_stage_id: job_stage_id,
      # SSoT: Use contract_price as THE ONE
      contract_price: user_edits["contract_value"] || job_data["contract_value"]&.to_f,
      **location_data
    )

    # SSoT: Create supervisor as job_contact instead of legacy columns
    job.job_contacts.create!(user: @user, role: "supervisor")

    # Link customer to job
    # If they're a sales agent, link as external_sales instead of client
    if customer
      if is_sales_agent
        # This is a sales agent sending on behalf of their client
        job.job_contacts.create!(
          contact: customer,
          role: "external_sales",
          primary: false
        )
        Rails.logger.info "Linked #{customer.display_name} as external_sales (detected as sales agent)"
      else
        # Normal customer - link as client
        job.job_contacts.create!(
          contact: customer,
          role: "client",
          primary: true
        )
      end
    end

    # Link internal sales rep
    # Always link the user who approved the proposal
    link_internal_sales_rep(job, @user)

    # Also link the user who synced the email if different
    if @email.synced_by_user && @email.synced_by_user.id != @user.id
      link_internal_sales_rep(job, @email.synced_by_user)
    end

    # Find and link external sales reps from email chain
    link_external_sales_reps(job, @email)

    # Link external sales from user manual selection
    if user_edits["external_sales_contact_ids"].present?
      user_edits["external_sales_contact_ids"].each do |contact_id|
        link_external_sales_contact(job, contact_id)
      end
    end

    # Link referral contact if detected or manually selected
    if user_edits["referral_contact_id"].present?
      link_referral_contact_by_id(job, user_edits["referral_contact_id"])
    elsif job_data["referral_contact"].present?
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
      .where("created_at > ?", 1.hour.ago)
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
      extracted["_raw_response"] = raw_response

      # Add internal and external sales person detection
      add_sales_people_info(extracted)

      extracted
    rescue JSON::ParserError => e
      # AI returned invalid JSON - create low confidence response
      Rails.logger.error "Claude returned invalid JSON: #{e.message}"

      # Try to extract customer from subject (e.g., "Quote for Bronwyn Jarvis")
      customer_data = extract_customer_from_subject_fallback

      data = {
        "job_title" => @email.subject,
        "customer" => customer_data,
        "confidence_score" => 0.1,
        "error" => "AI returned invalid response",
        "missing_info" => [ "all fields - AI extraction failed" ],
        "_raw_response" => response
      }
      add_sales_people_info(data)
      data
    end
  end

  # When AI fails, try to extract customer name from email subject
  # Don't use internal senders as customers
  def extract_customer_from_subject_fallback
    internal_domains = %w[@tekna.com.au @teeem.au @teeem.com]
    sender_is_internal = internal_domains.any? { |d| @email.from_email&.downcase&.include?(d) }

    # Try to extract name from subject patterns like "Quote for [Name]" or "... for [Name]"
    subject = @email.subject || ""

    # Pattern: "for [Name]" at end of subject
    if subject =~ /\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*(?:\[.*\])?\s*$/i
      return { "name" => $1.strip, "email" => nil }
    end

    # Pattern: "[Name] - Quote" or "[Name] Quote Request"
    if subject =~ /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*[-:]/
      return { "name" => $1.strip, "email" => nil }
    end

    # If sender is internal, don't use them as customer - leave blank
    if sender_is_internal
      return { "name" => nil, "email" => nil }
    end

    # Last resort: use sender (only if external)
    {
      "name" => @email.from_name || extract_name_from_email(@email.from_email),
      "email" => @email.from_email
    }
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
        "job_title": "Descriptive title for this job (infer from context or use subject line). For cabinetry/cabinet quotes, prefix with 'Kitchen - '",
        "property_address": "CRITICAL: Find the COMPLETE PROPERTY/SITE address where construction work will be done, NOT the business/office address. MUST include: street number + street name + suburb + state + postcode. Look for labels like 'Site:', 'Site Address', 'Property Address', 'Work Location', 'Project Address', 'Job Site', 'Property:', or addresses in QLD/NSW/VIC. Common PDF formats show 'Site: [address]' in title blocks. AVOID addresses labeled 'Business Address', 'Office Address', 'Company Address', 'Head Office', or PO Box addresses. DO NOT return partial addresses (suburb only is not enough). Must extract the full street address. Format: '123 Main Street, Suburb, State Postcode' (e.g., '3/9 Reef Point Esplanade, Scarborough, QLD 4020'). Return null if complete address not found.",
        "customer": {
          "name": "The CUSTOMER's name - this is who is contracting Tekna for the work. For kitchen/cabinetry jobs, builders ARE valid customers (they contract Tekna to do kitchens in homes they're building). Extract the person requesting the quote.",
          "email": "Customer email address",
          "phone": "Phone number from email signature or body",
          "company": "Company name from email signature or domain (e.g., 'Imperial Homes QLD' from nick@imperialhomesqld.com.au or signature)",
          "entity_type": "person or company (infer from context)"
        },
        "company_details": {
          "name": "Company name extracted from email signature (look for company name in signature block, or infer from email domain like imperialhomesqld.com.au → Imperial Homes QLD)",
          "abn": "ABN number if present in email signature (11 digit number, may be formatted as XX XXX XXX XXX)",
          "phone": "Company phone number from signature (landline, not mobile)",
          "mobile": "Mobile phone from signature",
          "address": "Street address from signature",
          "city": "City/suburb from signature address",
          "state": "State from signature (QLD, NSW, VIC, etc.)",
          "postcode": "Postcode from signature",
          "website": "Website URL from signature"
        },
        "referral": {
          "name": "Name of person who referred this job (look for phrases like 'referred by', 'recommended by', 'sent by', or similar)",
          "email": "Email of referral person if mentioned",
          "phone": "Phone of referral person if mentioned",
          "company": "Company of referral person if mentioned"
        },
        "description": "Brief 1-2 sentence description of what the customer wants",
        "scope_of_work": "Detailed scope extracted from email - what needs to be built/renovated/fixed. Include relevant details from PDF attachments.",
        "contract_value": null or estimated value if mentioned as a number (no currency symbols),
        "urgency": "urgent, normal, or low based on language used",
        "job_type": "kitchen (for cabinetry/cabinet work), renovation, new_build, extension, repair, or other",
        "attachments_mentioned": ["list of any files mentioned or attached"],
        "job_summary": "A concise 2-3 sentence summary of the job from an estimator's perspective - highlighting key construction challenges, scope, and what needs pricing attention. Extract from PDF attachments and email.",
        "key_points": ["Array of exactly 10 specific, actionable points that an estimator should focus on when pricing this job. Include: materials needed, specific trades required, site challenges, access issues, timeline constraints, regulatory requirements, client specifications, potential risks, scope clarifications needed, and cost drivers. Be concrete and specific based on the email/PDF content."],
        "estimated_scope": {
          "complexity": "low, medium, or high - based on technical requirements, number of trades, site conditions",
          "duration_estimate": "Estimated project duration (e.g., '4-6 weeks', '2-3 months'). Extract from documents or estimate based on scope.",
          "key_trades": ["Array of specific trades needed: e.g., 'Electrician', 'Plumber', 'Carpenter', 'Tiler', 'Painter', 'Concreter', etc."],
          "major_materials": ["Array of major materials mentioned or inferred: e.g., 'Timber framing', 'Roofing tiles', 'Electrical fixtures', 'Plumbing fixtures', 'Bricks', 'Concrete', etc."],
          "potential_challenges": ["Array of specific site or project challenges: e.g., 'Restricted site access', 'Heritage constraints', 'Working around existing structures', 'Tight timeline', 'Complex approvals required', etc."]
        },
        "recommendations": ["Array of 3-5 recommendations for the estimator: e.g., 'Site visit required to assess access', 'Confirm material specifications with client', 'Check council approval requirements', 'Get quotes from 3 electrical contractors', etc."],
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

      Builder/Developer handling:
      - Builders ARE valid customers for Tekna (they contract kitchen work for homes they're building)
      - If someone from a builder company (Imperial Homes, etc.) requests a quote, they are the customer
      - Extract their company name from email domain or signature (e.g., nick@imperialhomesqld.com.au → Imperial Homes QLD)
      - Cabinetry/cabinet quotes are Kitchen jobs
      - The builder's own end client (homeowner) is NOT relevant - the builder is Tekna's customer
    PROMPT
  end

  def call_claude_api(prompt)
    api_key = ENV["ANTHROPIC_API_KEY"]
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
      json_text = json_match[0]

      # FRC: Claude sometimes includes unescaped newlines/control chars inside string values
      # This causes JSON.parse to fail with "invalid ASCII control character in string"
      # Fix by replacing control characters (except \n which we'll handle) with spaces
      # within string values only
      sanitized = sanitize_json_control_chars(json_text)

      JSON.parse(sanitized)
    else
      # No JSON found
      raise JSON::ParserError, "No JSON object found in response"
    end
  end

  # Sanitize control characters in JSON strings that break JSON.parse
  # Replaces unescaped control characters (tabs, newlines inside strings) with proper escapes
  def sanitize_json_control_chars(json_text)
    # Replace literal tabs with escaped tabs
    result = json_text.gsub(/\t/, '\\t')

    # The main issue: newlines inside string values need to be escaped
    # We need to find strings and escape their internal newlines
    # Strategy: Replace actual newlines with escaped \n when inside a JSON string

    # Track if we're inside a string
    in_string = false
    escaped = false
    output = ""

    result.each_char do |char|
      if escaped
        # Previous char was backslash, this char is escaped
        output += char
        escaped = false
      elsif char == '\\'
        output += char
        escaped = true
      elsif char == '"'
        in_string = !in_string
        output += char
      elsif in_string && char == "\n"
        # Unescaped newline inside string - escape it
        output += "\\n"
      elsif in_string && char == "\r"
        # Unescaped carriage return - escape it
        output += "\\r"
      elsif in_string && char.ord < 32 && char != "\n" && char != "\r"
        # Other control characters - replace with space
        output += " "
      else
        output += char
      end
    end

    output
  end

  def find_or_create_customer(customer_data)
    return nil unless customer_data.is_a?(Hash)

    email = customer_data["email"]
    name = customer_data["name"]

    # Priority 1: Find by email (exact match)
    if email.present?
      contact = Contact.find_by_email(email)
      return contact if contact
    end

    # Priority 2: Find by name (fuzzy match) - IMPORTANT for matching existing clients
    if name.present?
      # Try exact name match first
      contact = Contact.find_by("LOWER(display_name) = ?", name.downcase)
      return contact if contact

      # Try partial name match (e.g., "Bronwyn Jarvis" matches "Bronwyn Jarvis - BMD")
      contact = Contact.where("LOWER(display_name) LIKE ?", "%#{name.downcase}%").first
      if contact
        Rails.logger.info "[EmailToJobService] Found existing contact by name match: #{contact.display_name}"
        return contact
      end
    end

    # No existing contact found - create new one if we have email
    return nil unless email.present?

    Contact.create!(
      email: email,
      display_name: name,
      mobile_phone: normalize_phone(customer_data["phone"]),
      company_name_or_trust: customer_data["company"],
      entity_type: customer_data["entity_type"] || "person",
      roles: [ "customer" ]
    )
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error "Failed to create customer: #{e.message}"
    # Try to find by email again in case of race condition
    Contact.find_by_email(email) if email.present?
  end

  def normalize_phone(phone)
    return nil if phone.blank?

    # Remove common formatting characters
    phone.gsub(/[\s\-\(\)]/, "")
  end

  def strip_html(html)
    return nil if html.blank?

    # Basic HTML stripping for AI prompt
    html.gsub(/<[^>]*>/, " ")
        .gsub(/&nbsp;/, " ")
        .gsub(/&[a-z]+;/, " ")
        .gsub(/\s+/, " ")
        .strip
  end

  def extract_name_from_email(email)
    # Extract name from email address like john.smith@example.com -> John Smith
    local_part = email.split("@").first
    local_part.split(/[._]/).map(&:capitalize).join(" ")
  end

  # Map AI-extracted job type text to system JobType ID
  def map_job_type(ai_job_type)
    return nil if ai_job_type.blank?

    # Mapping of AI job type keywords to your system's JobType names
    type_mappings = {
      "renovation" => "House Renovation",
      "extension" => "House Renovation",
      "new_build" => "House",
      "new build" => "House",
      "house" => "House",
      "duplex" => "Duplex",
      "townhouse" => "Townhouse",
      "apartment" => "Micro Apartment",
      "unit" => "Townhouse",
      "kitchen" => "Kitchen",
      "cabinetry" => "Kitchen",
      "cabinet" => "Kitchen",
      "cabinets" => "Kitchen",
      "repair" => "House Renovation",
      "ndis" => "NDIS House"
    }

    # Try exact match first
    matched_name = type_mappings[ai_job_type.downcase]

    # Find the JobType by name
    if matched_name
      JobType.find_by(name: matched_name)&.id
    else
      # Default to House Renovation for general construction work
      JobType.find_by(name: "House Renovation")&.id
    end
  end

  # Link internal sales rep to job
  def link_internal_sales_rep(job, sales_user)
    # Check if user has an associated contact record
    contact = Contact.find_by_email(sales_user.email)
    return unless contact

    # Link as internal sales rep (avoid duplicates)
    unless job.job_contacts.exists?(contact: contact, role: "internal_sales")
      job.job_contacts.create!(
        contact: contact,
        role: "internal_sales",
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
      contact = Contact.find_by_email(participant_email)
      next unless contact

      # Check if this contact is a sales agent
      # (they have 'sales' or 'agent' in their roles)
      is_sales = contact.roles_array.any? { |t| t.match?(/sales|agent/i) }

      if is_sales
        # Link as external sales (avoid duplicates)
        unless job.job_contacts.exists?(contact: contact, role: "external_sales")
          job.job_contacts.create!(
            contact: contact,
            role: "external_sales",
            primary: false
          )
          Rails.logger.info "Linked external sales rep #{contact.display_name} to job #{job.id}"
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
    unless job.job_contacts.exists?(contact: contact, role: "external_sales")
      job.job_contacts.create!(
        contact: contact,
        role: "external_sales",
        primary: false
      )
      Rails.logger.info "Linked external sales #{contact.display_name} to job #{job.id} (user selected)"
    end
  rescue StandardError => e
    Rails.logger.error "Failed to link external sales contact: #{e.message}"
  end

  # Link referral contact to job (from AI detection)
  def link_referral_contact(job, job_data)
    referral_data = job_data["referral_contact"]
    return unless referral_data.is_a?(Hash) && referral_data["contact_id"].present?

    contact = Contact.find_by(id: referral_data["contact_id"])
    return unless contact

    # Link as referral (avoid duplicates)
    unless job.job_contacts.exists?(contact: contact, role: "referral")
      job.job_contacts.create!(
        contact: contact,
        role: "referral",
        primary: false
      )
      Rails.logger.info "Linked referral #{contact.display_name} to job #{job.id}"
    end
  rescue StandardError => e
    Rails.logger.error "Failed to link referral contact: #{e.message}"
  end

  # Link referral contact by ID (from user manual selection)
  def link_referral_contact_by_id(job, contact_id)
    contact = Contact.find_by(id: contact_id)
    return unless contact

    # Link as referral (avoid duplicates)
    unless job.job_contacts.exists?(contact: contact, role: "referral")
      job.job_contacts.create!(
        contact: contact,
        role: "referral",
        primary: false
      )
      Rails.logger.info "Linked referral #{contact.display_name} to job #{job.id} (user selected)"
    end
  rescue StandardError => e
    Rails.logger.error "Failed to link referral contact: #{e.message}"
  end

  # Lookup company contact by email domain
  # Returns the company Contact record if found
  def find_company_by_email_domain(email)
    return nil if email.blank?

    domain = email.split("@").last&.downcase
    return nil if domain.blank?

    # Skip common personal email domains
    personal_domains = %w[gmail.com yahoo.com hotmail.com outlook.com icloud.com live.com]
    return nil if personal_domains.include?(domain)

    # Find a company contact that has an email with this domain
    Contact.where(entity_type: "company")
           .joins(:contact_emails)
           .where("LOWER(contact_emails.email) LIKE ?", "%@#{domain}")
           .first
  end

  # Check if a company is a builder/developer type
  def is_builder_company?(company_contact)
    return false unless company_contact

    # Check roles for builder indicators
    roles = company_contact.roles_array
    builder_roles = roles.any? { |r| r.match?(/builder|developer|construction|home/i) }
    return true if builder_roles

    # Check company name for builder indicators
    name = company_contact.display_name&.downcase || ""
    builder_names = name.match?(/homes|builder|constructions|developments|housing/i)
    return true if builder_names

    false
  end

  # CONTACT ENRICHMENT: Create/link company from email signature data
  # - Creates company contact if doesn't exist
  # - Links person as employee of company
  # - Migrates Xero link from person to company
  def enrich_contact_with_company(person_contact, email, company_details, existing_company)
    result = { actions: [] }

    Rails.logger.info "[ContactEnrichment] Starting for #{person_contact.display_name} (ID: #{person_contact.id})"
    Rails.logger.info "[ContactEnrichment] Email: #{email}"
    Rails.logger.info "[ContactEnrichment] company_details: #{company_details.inspect}"
    Rails.logger.info "[ContactEnrichment] existing_company: #{existing_company&.display_name} (ID: #{existing_company&.id})"
    Rails.logger.info "[ContactEnrichment] person entity_type: #{person_contact.entity_type}"
    Rails.logger.info "[ContactEnrichment] person primary_company_id: #{person_contact.primary_company_id}"

    # Skip if already linked to a company
    if person_contact.primary_company_id.present?
      result[:skipped] = "Already linked to company"
      Rails.logger.info "[ContactEnrichment] SKIP: Already linked to company #{person_contact.primary_company_id}"
      return result
    end

    # Skip if this IS a company (not a person)
    unless person_contact.entity_type == "person"
      result[:skipped] = "Contact is not a person"
      Rails.logger.info "[ContactEnrichment] SKIP: entity_type=#{person_contact.entity_type} is not person"
      return result
    end

    domain = email.split("@").last&.downcase
    if domain.blank?
      Rails.logger.info "[ContactEnrichment] SKIP: domain is blank"
      return result
    end

    # Skip personal email domains
    personal_domains = %w[gmail.com yahoo.com hotmail.com outlook.com icloud.com live.com]
    if personal_domains.include?(domain)
      result[:skipped] = "Personal email domain"
      Rails.logger.info "[ContactEnrichment] SKIP: personal email domain #{domain}"
      return result
    end

    # Try to find existing company by domain
    company = existing_company || find_company_by_email_domain(email)
    Rails.logger.info "[ContactEnrichment] Found company by domain: #{company&.display_name} (ID: #{company&.id})"

    # If no company exists, create one from signature data
    Rails.logger.info "[ContactEnrichment] Checking creation conditions:"
    Rails.logger.info "[ContactEnrichment]   company.nil? = #{company.nil?}"
    Rails.logger.info "[ContactEnrichment]   company_details.is_a?(Hash) = #{company_details.is_a?(Hash)}"
    Rails.logger.info "[ContactEnrichment]   company_details['name'].present? = #{company_details.is_a?(Hash) && company_details['name'].present?}"
    Rails.logger.info "[ContactEnrichment]   company_details['name'] = #{company_details.is_a?(Hash) ? company_details['name'].inspect : 'N/A'}"

    if company.nil? && company_details.is_a?(Hash) && company_details["name"].present?
      Rails.logger.info "[ContactEnrichment] Creating company from signature..."
      company = create_company_from_signature(company_details, domain)
      if company
        result[:actions] << "Created company: #{company.display_name}"
        result[:company_created] = true
        result[:company_id] = company.id
      end
    end

    # Link person as employee of company
    if company && person_contact.id != company.id
      # Migrate Xero link from person to company BEFORE linking
      if person_contact.xero_contact_number.present? && company.xero_contact_number.blank?
        xero_number = person_contact.xero_contact_number
        xero_count = person_contact.xero_invoice_count || 0

        # Move Xero link to company
        company.update!(
          xero_contact_number: xero_number,
          xero_invoice_count: xero_count,
          sync_with_xero: true
        )

        # Clear from person
        person_contact.update!(
          xero_contact_number: nil,
          xero_invoice_count: 0,
          sync_with_xero: false
        )

        result[:actions] << "Migrated Xero link (#{xero_number}) to company"
        result[:xero_migrated] = true
        Rails.logger.info "[ContactEnrichment] Migrated Xero link #{xero_number} from #{person_contact.display_name} to #{company.display_name}"
      end

      # Link person as employee
      person_contact.update!(primary_company_id: company.id)
      result[:actions] << "Linked #{person_contact.display_name} as employee of #{company.display_name}"
      result[:linked_to_company] = company.display_name
      result[:company_id] = company.id

      Rails.logger.info "[ContactEnrichment] Linked #{person_contact.display_name} as employee of #{company.display_name}"
    end

    result
  rescue StandardError => e
    Rails.logger.error "[ContactEnrichment] Error: #{e.message}"
    { error: e.message }
  end

  # Create a new company contact from email signature data
  def create_company_from_signature(company_details, domain)
    return nil unless company_details["name"].present?

    # Clean ABN (remove spaces)
    abn = company_details["abn"]&.gsub(/\s/, "")

    # Build company contact
    company = Contact.new(
      entity_type: "company",
      company_name_or_trust: company_details["name"],
      display_name: company_details["name"],
      abn: abn,
      website: company_details["website"],
      address: company_details["address"],
      city: company_details["city"],
      state: company_details["state"],
      postcode: company_details["postcode"],
      email_domains: [domain],  # Store domain for future auto-linking
      is_active: true,
      roles: ["builder"].to_json  # Mark as builder by default for now
    )

    # Add company email if we can construct it
    # Common patterns: info@, admin@, office@
    # For now, skip auto-creating email - let user add it

    # Add phone if present
    if company_details["phone"].present?
      company.save!
      company.contact_phones.create!(
        phone_number: company_details["phone"],
        phone_type: "work",
        is_primary: true
      )
    else
      company.save!
    end

    # Add mobile if present and different from phone
    if company_details["mobile"].present? && company_details["mobile"] != company_details["phone"]
      company.contact_phones.create!(
        phone_number: company_details["mobile"],
        phone_type: "mobile",
        is_primary: company.contact_phones.empty?
      )
    end

    Rails.logger.info "[ContactEnrichment] Created company: #{company.display_name} (ID: #{company.id}, ABN: #{abn || 'none'})"

    company
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error "[ContactEnrichment] Failed to create company: #{e.message}"
    nil
  end

  # Add sales people detection to extracted data
  def add_sales_people_info(extracted_data)
    # Detect if sender is from a known company (for context/linking)
    sender_company = find_company_by_email_domain(@email.from_email)
    if sender_company
      extracted_data["sender_company"] = {
        "name" => sender_company.display_name,
        "contact_id" => sender_company.id,
        "is_builder" => is_builder_company?(sender_company),
        "domain" => @email.from_email.split("@").last
      }
    end

    # Customer: Check if AI-extracted customer already exists in contacts
    customer_data = extracted_data["customer"]
    if customer_data.is_a?(Hash)
      customer_email = customer_data["email"]
      customer_name = customer_data["name"]
      customer_contact = nil

      # Try to find existing contact by email first
      if customer_email.present?
        customer_contact = Contact.find_by_email(customer_email)
      end

      # If no email match, try searching by name
      if customer_contact.nil? && customer_name.present?
        # Exact match first
        customer_contact = Contact.find_by("LOWER(display_name) = ?", customer_name.downcase)

        # Fuzzy match if no exact match
        if customer_contact.nil?
          customer_contact = Contact.where("LOWER(display_name) LIKE ?", "%#{customer_name.downcase}%").first
        end
      end

      # Add matching info to customer data
      extracted_data["customer"]["contact_exists"] = customer_contact.present?
      extracted_data["customer"]["contact_id"] = customer_contact&.id
      extracted_data["customer"]["needs_contact_creation"] = customer_contact.nil?

      # Check if customer's email domain indicates they work for a company
      # This handles cases where internal staff forward emails and AI extracts the original sender
      customer_company = nil
      if customer_email.present? && customer_contact
        customer_company = find_company_by_email_domain(customer_email)
        if customer_company
          extracted_data["customer"]["detected_company"] = {
            "name" => customer_company.display_name,
            "contact_id" => customer_company.id,
            "is_builder" => is_builder_company?(customer_company)
          }
        end
      end

      # If customer contact exists and is linked to the sender's company, note it
      if customer_contact&.primary_company_id == sender_company&.id
        extracted_data["customer"]["is_employee_of_sender_company"] = true
      end

      # CONTACT ENRICHMENT: Create company and link employee if needed
      # Priority: customer.company > company_details.name (company_details may extract wrong sender)
      company_details = extracted_data["company_details"] || {}
      customer_company_name = customer_data["company"]  # AI extracts this from customer's email domain/signature

      # Override company_details.name with customer.company if available
      if customer_company_name.present? && company_details["name"] != customer_company_name
        company_details = company_details.merge("name" => customer_company_name)
      end

      if customer_contact && customer_email.present? && customer_contact.entity_type == "person"
        # Only pass customer_company - DON'T fall back to sender_company
        # We don't want to link external customers to internal Tekna companies
        enrichment_result = enrich_contact_with_company(
          customer_contact,
          customer_email,
          company_details,
          customer_company  # NOT sender_company - that's internal
        )
        extracted_data["customer"]["enrichment"] = enrichment_result if enrichment_result
      end

      if customer_contact
        Rails.logger.info "[EmailToJobService] Found existing customer: #{customer_contact.display_name} (ID: #{customer_contact.id})"
      end
    end

    # Internal sales: The user who synced/forwarded the email (Jake, Robert, etc.)
    internal_sales_user = @user
    internal_sales_contact = Contact.find_by_email(internal_sales_user.email)

    extracted_data["internal_sales"] = {
      "user_name" => internal_sales_user.name,
      "user_email" => internal_sales_user.email,
      "contact_exists" => internal_sales_contact.present?,
      "contact_id" => internal_sales_contact&.id,
      "needs_contact_creation" => internal_sales_contact.nil?
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
      next if participant_email == extracted_data.dig("customer", "email")

      contact = Contact.find_by_email(participant_email)

      # Check if this person might be a sales agent
      is_sales_agent = contact && contact.roles_array.any? { |t| t.match?(/sales|agent/i) }

      # Also check email domain for common sales/real estate patterns
      is_likely_sales = participant_email.match?(/@(realestate|ljhooker|century21|ray-white|bodable)/i)

      if is_sales_agent || is_likely_sales
        external_sales << {
          "email" => participant_email,
          "name" => contact&.display_name || extract_name_from_email(participant_email),
          "contact_exists" => contact.present?,
          "contact_id" => contact&.id,
          "needs_contact_creation" => contact.nil?,
          "detected_reason" => is_sales_agent ? "existing_contact_marked_as_sales" : "email_domain_pattern"
        }
      end
    end

    extracted_data["external_sales"] = external_sales

    # Referral: Check if AI extracted a referral person
    referral_data = extracted_data["referral"]
    if referral_data.is_a?(Hash) && referral_data["name"].present?
      referral_email = referral_data["email"]
      referral_contact = nil

      # Try to find existing contact by email
      if referral_email.present?
        referral_contact = Contact.find_by_email(referral_email)
      end

      # If no email or no contact found, try searching by name
      if referral_contact.nil? && referral_data["name"].present?
        referral_contact = Contact.where("LOWER(display_name) LIKE ?", "%#{referral_data['name'].downcase}%").first
      end

      extracted_data["referral_contact"] = {
        "name" => referral_data["name"],
        "email" => referral_email,
        "phone" => referral_data["phone"],
        "company" => referral_data["company"],
        "contact_exists" => referral_contact.present?,
        "contact_id" => referral_contact&.id,
        "needs_contact_creation" => referral_contact.nil?
      }
    else
      extracted_data["referral_contact"] = nil
    end

    extracted_data
  end

  def sync_pdf_attachments_if_needed
    # Skip if no attachments or already synced
    return unless @email.has_attachments && !@email.files.attached?

    begin
      # SSoT: Per-user Outlook credentials removed - use org credentials via sync_attachments!
      @email.sync_attachments!
      Rails.logger.info "Synced #{@email.files.count} PDF attachments for email #{@email.id}"
    rescue StandardError => e
      Rails.logger.error "Failed to sync attachments for email #{@email.id}: #{e.message}"
      # Don't fail the whole process if attachment sync fails
    end
  end
end
