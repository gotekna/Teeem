require "anthropic"

class EmailToCaseService
  CLAUDE_MODEL = "claude-sonnet-4-5-20250929"
  MAX_TOKENS = 3000
  RATE_LIMIT_PER_HOUR = 20

  class RateLimitError < StandardError; end
  class AIExtractionError < StandardError; end
  class CaseCreationError < StandardError; end

  def initialize(email_warehouse, user:)
    @email = email_warehouse
    @user = user
  end

  # Main entry point - analyzes email and creates proposal
  def create_case_proposal
    # Check rate limit
    check_rate_limit!

    # Download PDF attachments if not already synced
    sync_pdf_attachments_if_needed

    # Get the full email thread for context
    thread_context = build_email_thread_context

    # Extract data using Claude AI
    start_time = Time.current
    extracted_data = extract_case_data_with_ai(thread_context)
    processing_time = ((Time.current - start_time) * 1000).to_i

    # Get AI prompt and response for logging
    prompt = build_extraction_prompt(thread_context)
    ai_response = extracted_data.delete("_raw_response")

    # Create proposal record
    proposal = EmailCaseProposal.create!(
      email_warehouse: @email,
      created_by: @user,
      extracted_data: extracted_data,
      ai_prompt: prompt,
      ai_response_raw: ai_response,
      processing_time_ms: processing_time,
      ai_model_used: CLAUDE_MODEL,
      confidence_score: extracted_data["confidence_score"],
      status: "pending"
    )

    Rails.logger.info "Created case proposal #{proposal.id} from email #{@email.id} with confidence #{extracted_data['confidence_score']}"

    proposal
  rescue RateLimitError => e
    Rails.logger.error "Rate limit hit for user #{@user.id}: #{e.message}"
    raise
  rescue StandardError => e
    Rails.logger.error "Case proposal creation failed: #{e.class} - #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")

    # Create error proposal
    EmailCaseProposal.create!(
      email_warehouse: @email,
      created_by: @user,
      extracted_data: { error: e.message },
      status: "error",
      error_message: e.message
    )
  end

  # Public method for re-extracting data
  def extract_case_data
    sync_pdf_attachments_if_needed
    thread_context = build_email_thread_context
    extract_case_data_with_ai(thread_context)
  end

  # Approve proposal and create actual case
  def approve_proposal(proposal, user_edits: {})
    # Merge user edits with AI-extracted data
    case_data = proposal.extracted_data.deep_merge(user_edits)

    # Create the case
    case_record = CaseRecord.create!(
      title: user_edits["case_title"] || case_data["case_title"] || "Case from #{@email.from_email}",
      case_type: user_edits["case_type"] || case_data["case_type"] || "other",
      description: user_edits["description"] || case_data["description"],
      priority: user_edits["priority"] || case_data["priority"] || "normal",
      deadline: user_edits["deadline"],
      created_by: @user,
      assigned_to_id: user_edits["assigned_to_id"] || @user.id,
      investigation_start_date: parse_date(case_data.dig("key_dates", 0, "date")),
      metadata: {
        source: "email_proposal",
        email_warehouse_id: @email.id,
        proposal_id: proposal.id
      }
    )

    # Add involved parties as contacts
    add_involved_parties(case_record, case_data["involved_parties"], user_edits)

    # Link related jobs
    link_related_jobs(case_record, case_data["related_jobs"], user_edits)

    # Link related companies
    link_related_companies(case_record, case_data["related_companies"], user_edits)

    # Link the source email to the case
    case_record.add_email(@email, relevance: "key_evidence", notes: "Initial case email", added_by: @user)

    # Link all emails in the thread
    link_email_thread(case_record)

    # Mark proposal as approved
    proposal.mark_approved!(by_user: @user, case_record: case_record)

    Rails.logger.info "Case #{case_record.id} created from proposal #{proposal.id}"

    case_record
  rescue StandardError => e
    Rails.logger.error "Case creation from proposal failed: #{e.message}"
    proposal.mark_error!(error_msg: e.message)
    raise CaseCreationError, e.message
  end

  private

  def check_rate_limit!
    recent_count = EmailCaseProposal
      .where(created_by: @user)
      .where("created_at > ?", 1.hour.ago)
      .count

    if recent_count >= RATE_LIMIT_PER_HOUR
      raise RateLimitError, "Too many proposals created recently. Limit: #{RATE_LIMIT_PER_HOUR} per hour."
    end
  end

  def build_email_thread_context
    # Get all emails in the same conversation thread
    thread_emails = if @email.conversation_id.present?
      EmailWarehouse
        .where(conversation_id: @email.conversation_id)
        .order(received_at: :asc)
    else
      [ @email ]
    end

    thread_emails.map do |email|
      {
        from: "#{email.from_name} <#{email.from_email}>",
        to: email.to_emails&.join(", "),
        cc: email.cc_emails&.join(", "),
        subject: email.subject,
        date: email.received_at&.strftime("%Y-%m-%d %H:%M"),
        body: email.body_text.presence || strip_html(email.body_html)
      }
    end
  end

  def extract_case_data_with_ai(thread_context)
    prompt = build_extraction_prompt(thread_context)

    begin
      response = call_claude_api(prompt)
      raw_response = response

      # Parse JSON response
      extracted = parse_json_response(response)

      # Add raw response for logging
      extracted["_raw_response"] = raw_response

      # Enrich with existing contact/job detection
      enrich_with_existing_data(extracted)

      extracted
    rescue JSON::ParserError => e
      Rails.logger.error "Claude returned invalid JSON: #{e.message}"
      {
        "case_title" => @email.subject,
        "case_type" => "other",
        "description" => "AI extraction failed - please review manually",
        "confidence_score" => 0.1,
        "error" => "AI returned invalid response",
        "missing_info" => [ "all fields - AI extraction failed" ],
        "_raw_response" => response
      }
    end
  end

  def build_extraction_prompt(thread_context)
    # Build thread summary
    thread_text = thread_context.map do |email|
      <<~EMAIL
        --- Email ---
        From: #{email[:from]}
        To: #{email[:to]}
        CC: #{email[:cc]}
        Date: #{email[:date]}
        Subject: #{email[:subject]}

        #{email[:body]}
      EMAIL
    end.join("\n\n")

    # Extract text from PDF attachments
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
      You are analyzing an email thread to extract information for creating an investigation case in Australia.
      This could be an ATO audit, legal dispute, compliance review, or other investigation matter.

      Email Thread (#{thread_context.length} emails, oldest first):
      #{thread_text}

      #{pdf_content.present? ? "\nPDF Attachments:\n#{pdf_content}" : ""}

      Extract the following information and return ONLY valid JSON (no markdown, no code blocks):

      {
        "case_title": "Start with the email subject line (remove RE:/FW: prefixes), then add context in parentheses if helpful. Example: 'Request for review of income contribution assessment - QLD 1570/22/5 (ATO Audit - Smith Family Trust)'",
        "case_type": "One of: ato_audit, legal_dispute, director_investigation, compliance_review, due_diligence, fraud_investigation, insolvency, bankruptcy, other",
        "description": "Detailed description of what the case is about, the issue or dispute",
        "priority": "One of: low, normal, high, urgent",
        "urgency": "One of: low, normal, urgent - based on deadlines or language",

        "involved_parties": [
          {
            "name": "Full name of person",
            "email": "ACTUAL email address from the email thread (look in From, To, CC, signatures, and body). NEVER use placeholder like email@example.com - leave blank if not found",
            "phone": "Phone number if mentioned in email signature or body",
            "company": "Company they work for/represent",
            "relationship_type": "One of: client, accountant, lawyer, previous_accountant, advisor, opposing_party, witness, related_party, ato_officer, afsa_officer, inspector_general, trustee, director, shareholder, bank_manager, insurer, broker, creditor, debtor",
            "alignment": "One of: friendly (on client's side), neutral (neither side), opposing (against client)",
            "is_primary": true/false (is this the main subject/client),
            "notes": "Any relevant notes about their role"
          }
        ],

        "related_jobs": [
          {
            "job_id": "If a job ID is mentioned (e.g., 'Job 123', 'J123', '#123')",
            "address_match": "Property address if mentioned that might match a job",
            "relevance": "One of: direct, indirect, reference",
            "confidence": 0.0 to 1.0
          }
        ],

        "related_companies": [
          {
            "name": "Company name",
            "acn": "ACN if mentioned",
            "abn": "ABN if mentioned",
            "role": "One of: subject, related_entity, counterparty"
          }
        ],

        "key_dates": [
          {
            "date": "YYYY-MM-DD format",
            "description": "What happened or is due on this date",
            "is_deadline": true/false
          }
        ],

        "document_requests": ["List of documents that need to be gathered"],
        "investigation_period": {
          "start_date": "YYYY-MM-DD or null",
          "end_date": "YYYY-MM-DD or null",
          "description": "e.g., 'FY21-23' or 'January 2020 to June 2023'"
        },

        "key_issues": ["List of main issues or questions to investigate"],
        "risk_factors": ["Potential risks or concerns identified"],
        "recommended_actions": ["Suggested next steps"],

        "confidence_score": 0.0 to 1.0,
        "missing_info": ["List of critical missing information"]
      }

      Confidence scoring guidelines:
      - 0.9-1.0: Clear case type, parties identified, specific issue, dates/deadlines
      - 0.7-0.89: Case type clear, main parties identified, general issue described
      - 0.5-0.69: Some info present but key details missing
      - 0.3-0.49: Minimal information, unclear what the case is about
      - 0.0-0.29: Almost no usable information

      Important notes:
      - For ATO matters, look for: audit notices, BAS reviews, tax assessments, objections
      - For legal disputes, look for: demand letters, court notices, litigation references
      - Identify ALL people mentioned and their roles
      - Pay attention to deadlines and response due dates
      - Extract company structures if discussed (trusts, corporate groups)
      - Return ONLY the JSON object, no additional text

      CRITICAL - Email extraction:
      - Extract REAL email addresses from: From/To/CC headers, email signatures, and email body text
      - NEVER use placeholder emails like "email@example.com" - leave email field blank/null if not found
      - Look for patterns like "name@domain.com", "Contact: email@...", signatures with email addresses
      - Government emails often end in .gov.au (ATO, ASIC, AFSA etc)

      CRITICAL - Alignment:
      - "friendly" = people helping your client (their accountant, lawyer, family)
      - "neutral" = people with no stake either way (witnesses, banks providing info)
      - "opposing" = people against your client (ATO officers, opposing lawyers, trustees in bankruptcy)
    PROMPT
  end

  def call_claude_api(prompt)
    api_key = ENV["ANTHROPIC_API_KEY"]
    raise AIExtractionError, "ANTHROPIC_API_KEY not configured" unless api_key

    client = Anthropic::Client.new(
      access_token: api_key,
      anthropic_version: "2023-06-01"
    )

    response = client.messages(
      parameters: {
        model: "claude-3-haiku-20240307",
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      }
    )

    response.dig("content", 0, "text") || response.dig(:content, 0, :text) || ""
  rescue Anthropic::Error => e
    Rails.logger.error "Anthropic API error: #{e.message}"
    raise AIExtractionError, "Claude API error: #{e.message}"
  end

  def parse_json_response(response_text)
    json_match = response_text.match(/\{.*\}/m)

    if json_match
      JSON.parse(json_match[0])
    else
      raise JSON::ParserError, "No JSON object found in response"
    end
  end

  def enrich_with_existing_data(extracted)
    # Match involved parties to existing contacts and known_parties
    (extracted["involved_parties"] || []).each do |party|
      # First check if we know this party from previous cases
      known = KnownParty.find_match(
        name: party["name"],
        email: party["email"],
        organisation: party["company"]
      )

      if known
        # Pre-fill from known party data
        party["relationship_type"] ||= known.relationship_type if known.relationship_type.present?
        party["alignment"] ||= known.default_alignment if known.default_alignment.present?
        party["phone"] ||= known.phone if known.phone.present?
        party["company"] ||= known.organisation if known.organisation.present?
        party["email"] ||= known.email if known.email.present?
        party["known_party_id"] = known.id
        party["seen_before"] = true
        party["seen_count"] = known.seen_count
      end

      # Then check for existing contact (SSoT: find_by_email uses contact_emails table)
      contact = nil
      if party["email"].present?
        contact = Contact.find_by_email(party["email"])
      end
      contact ||= Contact.find_by(display_name: party["name"]) if party["name"].present?

      if contact
        party["contact_id"] = contact.id
        party["contact_exists"] = true
        party["display_name"] = contact.display_name if party["name"].blank?
        # Update party with contact details if missing
        party["email"] ||= contact.email
        party["phone"] ||= contact.mobile_phone
        party["company"] ||= contact.company_name_or_trust
      else
        party["contact_exists"] = false
      end
    end

    # Match related jobs
    (extracted["related_jobs"] || []).each do |job_ref|
      if job_ref["job_id"].present?
        job = Job.find_by(id: job_ref["job_id"].to_s.gsub(/[^\d]/, ""))
        if job
          job_ref["job_found"] = true
          job_ref["job_title"] = job.title
        end
      elsif job_ref["address_match"].present?
        # Try to find job by address
        job = Job.where("LOWER(title) LIKE ?", "%#{job_ref['address_match'].downcase}%").first
        if job
          job_ref["job_id"] = job.id
          job_ref["job_found"] = true
          job_ref["job_title"] = job.title
        end
      end
    end

    # Match related companies
    (extracted["related_companies"] || []).each do |company_ref|
      company = nil
      if company_ref["acn"].present?
        company = CorporateCompany.find_by(acn: company_ref["acn"].gsub(/\s/, ""))
      elsif company_ref["abn"].present?
        company = CorporateCompany.find_by(abn: company_ref["abn"].gsub(/\s/, ""))
      elsif company_ref["name"].present?
        company = CorporateCompany.where("LOWER(name) LIKE ?", "%#{company_ref['name'].downcase}%").first
      end

      if company
        company_ref["company_id"] = company.id
        company_ref["company_found"] = true
      end
    end

    extracted
  end

  def add_involved_parties(case_record, parties, user_edits)
    return unless parties.is_a?(Array)

    # Include any manually added contacts from user edits
    manual_contacts = user_edits["additional_contacts"] || []

    all_parties = parties + manual_contacts

    all_parties.each do |party|
      contact = nil

      # Skip placeholder emails
      email = party["email"]
      email = nil if email.blank? || email == "email@example.com" || email&.include?("example.com")

      if party["contact_id"].present?
        contact = Contact.find_by(id: party["contact_id"])
      elsif email.present?
        # SSoT: find_by_email uses contact_emails table
        contact = Contact.find_by_email(email)
      elsif party["name"].present?
        # Try to find by exact name match
        contact = Contact.find_by(display_name: party["name"])
      end

      # Update existing contact with new details if provided
      if contact
        updates = {}
        updates[:email] = email if email.present? && contact.email.blank?
        updates[:mobile_phone] = party["phone"] if party["phone"].present? && contact.mobile_phone.blank?
        updates[:company_name_or_trust] = party["company"] if party["company"].present? && contact.company_name_or_trust.blank?
        contact.update(updates) if updates.present?
      end

      # Create contact if doesn't exist and has enough info (name is required, email optional)
      if contact.nil? && party["name"].present?
        # Find or create company if specified
        company_contact = nil
        if party["company"].present?
          company_contact = find_or_create_company(party["company"])
        end

        contact = Contact.create(
          email: email,
          display_name: party["name"],
          mobile_phone: party["phone"],
          company_name_or_trust: party["company"],
          primary_company_id: company_contact&.id,
          entity_type: "person"
        )
      end

      # Upsert to known_parties for future reference
      if party["name"].present?
        known_party = KnownParty.upsert_from_party(party)
        known_party&.update(contact_id: contact.id) if contact && known_party && known_party.contact_id.nil?
      end

      next unless contact

      # Link to case
      case_record.add_contact(
        contact,
        role: map_relationship_to_role(party["relationship_type"]),
        notes: party["notes"],
        is_primary: party["is_primary"] || false
      )

      # Update the case_contact with relationship_type and alignment
      case_contact = CaseContact.find_by(case_id: case_record.id, contact_id: contact.id)
      if case_contact
        case_contact.update(
          relationship_type: party["relationship_type"],
          alignment: party["alignment"] || "neutral",
          relationship_description: party["notes"]
        )
      end
    end
  end

  def find_or_create_company(company_name)
    return nil if company_name.blank?

    # Try to find existing company by name (case-insensitive)
    company = Contact.where(entity_type: "company", is_active: true)
                     .where("LOWER(display_name) = LOWER(?)", company_name.strip)
                     .first

    # Also check trading_name and company_name_or_trust
    company ||= Contact.where(entity_type: "company", is_active: true)
                       .where("LOWER(trading_name) = LOWER(?) OR LOWER(company_name_or_trust) = LOWER(?)",
                              company_name.strip, company_name.strip)
                       .first

    return company if company

    # SSoT: Use find_or_create_by! with RecordNotUnique rescue for race condition protection
    company = Contact.find_or_create_by!(
      display_name: company_name.strip,
      entity_type: "company"
    )
    Rails.logger.info "[EmailToCase] Created new company contact: #{company.display_name} (ID: #{company.id})"
    company
  rescue ActiveRecord::RecordNotUnique
    # DB constraint caught concurrent creation - find and return existing
    Contact.find_by(entity_type: "company", display_name: company_name.strip, is_active: true)
  end

  def map_relationship_to_role(relationship_type)
    # Map granular relationship types to the broader case roles
    mapping = {
      "client" => "subject",
      "accountant" => "advisor",
      "lawyer" => "advisor",
      "previous_accountant" => "advisor",
      "advisor" => "advisor",
      "opposing_party" => "opposing_party",
      "witness" => "witness",
      "related_party" => "related_party",
      "ato_officer" => "opposing_party",
      "afsa_officer" => "opposing_party",
      "inspector_general" => "opposing_party",
      "trustee" => "opposing_party",
      "director" => "subject",
      "shareholder" => "related_party",
      "bank_manager" => "related_party",
      "insurer" => "related_party",
      "broker" => "related_party",
      "creditor" => "opposing_party",
      "debtor" => "subject"
    }
    mapping[relationship_type] || "related_party"
  end

  def link_related_jobs(case_record, jobs, user_edits)
    job_ids = []

    # From AI extraction
    (jobs || []).each do |job_ref|
      job_ids << job_ref["job_id"] if job_ref["job_id"].present? && job_ref["job_found"]
    end

    # From user edits
    job_ids += (user_edits["job_ids"] || [])

    job_ids.uniq.each do |job_id|
      job = Job.find_by(id: job_id)
      next unless job

      case_record.add_job(job, relevance: "direct")
    end
  end

  def link_related_companies(case_record, companies, user_edits)
    company_ids = []

    # From AI extraction
    (companies || []).each do |company_ref|
      company_ids << { id: company_ref["company_id"], role: company_ref["role"] } if company_ref["company_found"]
    end

    # From user edits
    (user_edits["company_ids"] || []).each do |company_id|
      company_ids << { id: company_id, role: "subject" }
    end

    company_ids.uniq { |c| c[:id] }.each do |company_ref|
      company = CorporateCompany.find_by(id: company_ref[:id])
      next unless company

      case_record.add_company(company, role: company_ref[:role] || "subject")
    end
  end

  def link_email_thread(case_record)
    return unless @email.conversation_id.present?

    thread_emails = EmailWarehouse
      .where(conversation_id: @email.conversation_id)
      .where.not(id: @email.id)

    thread_emails.each_with_index do |email, index|
      # Skip marketing/spam emails (new filtering logic)
      next if email.classified_as_irrelevant?

      # Calculate relevance based on content
      relevance = calculate_thread_email_relevance(email, case_record)

      # Only link if minimally relevant
      next if relevance == "irrelevant"

      case_record.add_email(
        email,
        relevance: relevance,
        notes: "Email #{index + 1} in thread",
        added_by: @user
      )
    end
  end

  # Calculate relevance of thread email based on content
  def calculate_thread_email_relevance(email, case_record)
    # Check if email mentions case title/details
    return "key_evidence" if case_record.title.present? && email.subject&.downcase&.include?(case_record.title.downcase)

    # Default to supporting if it's a business email
    return "supporting" if email.is_business_email?

    # Otherwise irrelevant
    "irrelevant"
  end

  def sync_pdf_attachments_if_needed
    return unless @email.has_attachments && !@email.files.attached?

    begin
      # SSoT: Per-user Outlook credentials removed - use org credentials via sync_attachments!
      @email.sync_attachments!
      Rails.logger.info "Synced #{@email.files.count} PDF attachments for email #{@email.id}"
    rescue StandardError => e
      Rails.logger.error "Failed to sync attachments for email #{@email.id}: #{e.message}"
    end
  end

  def strip_html(html)
    return nil if html.blank?

    html.gsub(/<[^>]*>/, " ")
        .gsub(/&nbsp;/, " ")
        .gsub(/&[a-z]+;/, " ")
        .gsub(/\s+/, " ")
        .strip
  end

  def parse_date(date_string)
    return nil if date_string.blank?
    Date.parse(date_string)
  rescue ArgumentError
    nil
  end
end
