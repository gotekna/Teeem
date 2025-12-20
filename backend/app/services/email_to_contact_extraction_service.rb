# frozen_string_literal: true

# Service to extract email addresses from email data and create contacts
# Provides intelligent company suggestions based on email domains
class EmailToContactExtractionService
  # Generic consumer email domains that should not suggest company creation
  GENERIC_DOMAINS = %w[
    gmail.com googlemail.com
    outlook.com hotmail.com live.com msn.com
    yahoo.com ymail.com
    icloud.com me.com mac.com
    protonmail.com proton.me
    aol.com mail.com zoho.com
    fastmail.com fastmail.fm
    gmx.com gmx.net
    yandex.com yandex.ru
    qq.com 163.com
  ].freeze

  def initialize(user:)
    @user = user
  end

  # Main extraction and analysis method
  # @param email_data [Array<Hash>] Array of email records with from_email, to_emails, cc_emails, body, etc.
  # @param scope [String] 'current_view' or 'all_history' (for future use)
  # @return [Hash] Analysis results with email candidates and suggestions
  def extract_and_analyze(email_data, scope: "current_view")
    # Extract all unique email addresses
    all_emails = extract_emails_from_data(email_data)

    # Normalize and deduplicate
    normalized_emails = all_emails.map { |e| normalize_email_entry(e) }.compact.uniq { |e| e[:email] }

    # Batch check existing contacts
    existing_contacts_map = find_existing_contacts(normalized_emails.map { |e| e[:email] })

    # Store email_data for signature analysis
    @email_data = email_data

    # Generate suggestions for each email
    results = normalized_emails.map do |entry|
      email = entry[:email]
      is_existing = existing_contacts_map.key?(email)
      existing_contact = existing_contacts_map[email]

      # For new contacts, check if there's a possible duplicate at the same company
      possible_duplicate = nil
      suggested_company = nil

      if !is_existing
        suggested_company = generate_company_suggestion(email)

        # If no company suggested from domain and not generic, try signature analysis
        if !suggested_company && !generic_domain?(email)
          suggested_company = analyze_signature_for_company(email)
        end

        # If we're suggesting to link to a company, check for possible duplicates
        if suggested_company && suggested_company[:exists] && suggested_company[:action] == "link"
          possible_duplicate = find_possible_duplicate(email, suggested_company[:existing_company_id])
        end
      end

      # For existing contacts without company, suggest one
      suggested_company_for_existing = nil
      if is_existing && !existing_contact&.primary_company_id
        suggested_company_for_existing = generate_company_suggestion(email)
      end

      # Extract phone numbers from signature
      phones = {}
      if @email_data
        sender_emails = @email_data.select { |r| r["from_email"]&.downcase&.include?(email.downcase) }
        sender_emails.each do |record|
          text = record["body"] || record["signature"] || ""
          next if text.blank?

          signature = extract_signature_from_text(text)
          extracted_phones = extract_phone_numbers_from_signature(signature)

          if extracted_phones.any?
            phones = extracted_phones
            break
          end
        end
      end

      {
        email: email,
        display_name: entry[:display_name],
        is_existing_contact: is_existing,
        existing_contact_id: existing_contact&.id,
        existing_contact_name: existing_contact&.display_name,
        existing_contact_company_name: existing_contact&.primary_company&.display_name,
        existing_contact_company_id: existing_contact&.primary_company_id,
        domain: extract_domain(email),
        is_generic_domain: generic_domain?(email),
        suggested_company: suggested_company || suggested_company_for_existing,
        possible_duplicate: possible_duplicate,
        phones: phones
      }
    end

    # Calculate stats
    stats = {
      total_emails: results.count,
      existing_contacts: results.count { |r| r[:is_existing_contact] },
      new_candidates: results.count { |r| !r[:is_existing_contact] },
      with_company_suggestions: results.count { |r| r[:suggested_company].present? }
    }

    {
      success: true,
      emails: results,
      stats: stats
    }
  end

  # Bulk create contacts and companies from selections
  # @param selections [Array<Hash>] Array of { email:, display_name:, entity_type:, company_action:, company_id:, company_name:, add_to_existing_contact_id:, set_as_primary:, relationship_type:, reason: }
  # @param case_id [Integer] Optional case ID to link contacts to
  # @param default_relationship_type [String] Default relationship type if not specified per selection
  # @param default_reason [String] Default reason if not specified per selection
  # @return [Hash] Results with created contacts, companies, and errors
  def bulk_create(selections, case_id: nil, default_relationship_type: nil, default_reason: nil)
    created_contacts = []
    created_companies = []
    linked_to_companies = []
    added_emails = []
    linked_to_cases = []
    errors = []

    ActiveRecord::Base.transaction do
      selections.each do |selection|
        begin
          # Check if we should add email to existing contact
          if selection[:add_to_existing_contact_id].present?
            contact = Contact.find(selection[:add_to_existing_contact_id])
            new_email = normalize_email(selection[:email])

            # Check if email already exists on this contact (prevents duplicates)
            if email_exists_for_contact?(contact, new_email)
              errors << { email: selection[:email], error: "Email already exists on this contact" }
              next
            end

            # Check if email already exists on any OTHER contact
            if Contact.where.not(id: contact.id).exists?(email: new_email) ||
               ContactEmail.where.not(contact_id: contact.id).exists?(email: new_email)
              errors << { email: selection[:email], error: "Email already exists on another contact" }
              next
            end

            # Add email to contact_emails association
            contact.contact_emails.create!(
              email: new_email,
              is_primary: selection[:set_as_primary] || false,
              position: contact.contact_emails.count
            )

            # If setting as primary, update main email field and unset other primaries
            if selection[:set_as_primary]
              contact.contact_emails.where.not(email: new_email).update_all(is_primary: false)
              contact.update!(email: new_email)
            end

            # Add phone numbers if provided
            phones = selection[:phones] || {}
            if phones[:mobile].present? && !phone_exists_for_contact?(contact, phones[:mobile])
              contact.contact_phones.create!(
                phone_number: phones[:mobile],
                phone_type: "mobile",
                is_primary: false,
                position: contact.contact_phones.count
              )
            end

            if phones[:office].present? && !phone_exists_for_contact?(contact, phones[:office])
              contact.contact_phones.create!(
                phone_number: phones[:office],
                phone_type: "office",
                is_primary: false,
                position: contact.contact_phones.count
              )
            end

            if phones[:direct].present? && !phone_exists_for_contact?(contact, phones[:direct])
              contact.contact_phones.create!(
                phone_number: phones[:direct],
                phone_type: "office",
                is_primary: false,
                position: contact.contact_phones.count
              )
            end

            added_emails << {
              contact_id: contact.id,
              contact_name: contact.display_name,
              email: new_email,
              is_primary: selection[:set_as_primary] || false
            }

            # Handle company action for existing contact
            if selection[:company_action].present? && selection[:company_action] != "none"
              company_id = handle_company_action(
                selection[:company_action],
                selection[:company_id],
                selection[:company_name],
                created_companies,
                selection[:website_details] || {}
              )

              if company_id.present? && contact.primary_company_id != company_id
                contact.update!(primary_company_id: company_id)
                linked_to_companies << {
                  contact_id: contact.id,
                  company_id: company_id,
                  company_name: CorporateCompany.find(company_id).contact&.display_name || CorporateCompany.find(company_id).name
                }
              end
            end

            next
          end

          # Skip if contact already exists
          if Contact.exists?(email: normalize_email(selection[:email]))
            errors << { email: selection[:email], error: "Contact already exists" }
            next
          end

          # Handle company action
          company_id = handle_company_action(
            selection[:company_action],
            selection[:company_id],
            selection[:company_name],
            created_companies,
            selection[:website_details] || {}
          )

          # Parse name from display_name or email
          parsed_name = parse_name_from_display_or_email(selection[:display_name], selection[:email])

          # Extract phones from selection
          phones = selection[:phones] || {}

          # Create contact
          contact = Contact.create!(
            email: normalize_email(selection[:email]),
            first_name: parsed_name[:first_name],
            last_name: parsed_name[:last_name],
            entity_type: selection[:entity_type] || "person",
            primary_company_id: company_id,
            mobile_phone: phones[:mobile],
            office_phone: phones[:office] || phones[:direct],
            is_active: true
          )

          created_contacts << {
            id: contact.id,
            display_name: contact.display_name,
            email: contact.email,
            entity_type: contact.entity_type
          }

          # Link to case if case_id provided
          if case_id.present?
            relationship_type = selection[:relationship_type] || default_relationship_type
            reason = selection[:reason] || default_reason || "Contact extracted from case emails"

            case_contact = CaseContact.create!(
              case_id: case_id,
              contact_id: contact.id,
              relationship_type: relationship_type,
              reason: reason,
              added_by_id: @user.id
            )

            linked_to_cases << {
              contact_id: contact.id,
              contact_name: contact.display_name,
              case_id: case_id,
              relationship_type: relationship_type,
              reason: reason
            }
          end

          if company_id.present?
            company = CorporateCompany.find(company_id)
            linked_to_companies << {
              contact_id: contact.id,
              company_id: company_id,
              company_name: company.contact&.display_name || company.name
            }
          end
        rescue ActiveRecord::RecordInvalid => e
          errors << { email: selection[:email], error: e.message }
        rescue StandardError => e
          errors << { email: selection[:email], error: e.message }
        end
      end
    end

    {
      success: errors.empty?,
      created_contacts: created_contacts,
      created_companies: created_companies,
      linked_to_companies: linked_to_companies,
      linked_to_cases: linked_to_cases,
      added_emails: added_emails,
      errors: errors
    }
  rescue ActiveRecord::Rollback
    {
      success: false,
      created_contacts: [],
      created_companies: [],
      linked_to_companies: [],
      linked_to_cases: [],
      added_emails: [],
      errors: [ { error: "Transaction failed" } ]
    }
  end

  private

  # Extract all email addresses from email data
  def extract_emails_from_data(email_data)
    emails = []

    email_data.each do |record|
      # Extract from from_email
      if record["from_email"].present?
        emails << record["from_email"]
      end

      # Extract from to_emails array
      if record["to_emails"].is_a?(Array)
        emails.concat(record["to_emails"].compact)
      elsif record["to_emails"].present?
        emails << record["to_emails"]
      end

      # Extract from cc_emails array
      if record["cc_emails"].is_a?(Array)
        emails.concat(record["cc_emails"].compact)
      elsif record["cc_emails"].present?
        emails << record["cc_emails"]
      end
    end

    emails.compact.uniq
  end

  # Normalize and parse email entry
  def normalize_email_entry(email_string)
    parsed = parse_email_with_name(email_string)
    return nil if parsed[:email].blank? || !valid_email?(parsed[:email])

    {
      email: normalize_email(parsed[:email]),
      display_name: parsed[:name]
    }
  end

  # Parse email with optional display name
  # "John Doe <john@example.com>" => { name: "John Doe", email: "john@example.com" }
  # "john@example.com" => { name: nil, email: "john@example.com" }
  def parse_email_with_name(email_string)
    email_string = email_string.to_s.strip

    # Check for "Name <email>" format
    if email_string.match(/^(.+?)\s*<(.+?)>$/)
      {
        name: $1.strip,
        email: $2.strip
      }
    else
      {
        name: nil,
        email: email_string
      }
    end
  end

  # Normalize email address
  def normalize_email(email)
    email.to_s.strip.downcase
  end

  # Basic email validation
  def valid_email?(email)
    email.include?("@") && email.match?(/\A[^@\s]+@[^@\s]+\.[^@\s]+\z/)
  end

  # Extract domain from email
  def extract_domain(email)
    email.split("@").last.to_s.downcase
  end

  # Check if domain is a generic consumer email domain
  def generic_domain?(email)
    domain = extract_domain(email)
    GENERIC_DOMAINS.include?(domain)
  end

  # Batch find existing contacts
  def find_existing_contacts(emails)
    return {} if emails.empty?

    # Eager load primary_company (which is another Contact)
    contacts = Contact.includes(:primary_company)
                      .where(email: emails)
                      .index_by(&:email)
    contacts
  end

  # Generate company suggestion from email domain
  def generate_company_suggestion(email)
    return nil if generic_domain?(email)

    domain = extract_domain(email)
    suggested_name = format_company_name(domain)

    # First, check if any existing contacts with this domain have a company
    existing_company_from_domain = find_company_from_existing_contacts(domain)

    if existing_company_from_domain
      {
        name: existing_company_from_domain[:name],
        exists: true,
        existing_company_id: existing_company_from_domain[:id],
        action: "link"
      }
    else
      # Check if companies already exist by name
      existing_companies = find_existing_companies(domain, suggested_name)

      if existing_companies.any?
        # Return multiple options if more than one match
        if existing_companies.length > 1
          {
            name: suggested_name,
            exists: true,
            multiple_matches: true,
            matches: existing_companies.map { |company| {
              id: company.contact_id,
              name: company.contact&.display_name || company.name
            }},
            action: "link"
          }
        else
          # Single match
          existing_company = existing_companies.first
          {
            name: existing_company.contact&.display_name || existing_company.name || suggested_name,
            exists: true,
            existing_company_id: existing_company.contact_id,
            action: "link"
          }
        end
      else
        # Fetch website details for new company
        website_details = fetch_company_details_from_website(domain)
        {
          name: suggested_name,
          exists: false,
          existing_company_id: nil,
          action: "create",
          website_details: website_details
        }
      end
    end
  end

  # Format company name from domain
  # "tekna.com.au" => "Tekna"
  # "abc-construction.com" => "ABC Construction"
  # "svp.com.au" => "SVP" (abbreviation handling)
  def format_company_name(domain)
    # Remove common TLDs
    name = domain.gsub(/\.(com|net|org|au|uk|co|io|dev|app|tech|biz|info)(\..*)?$/, "")

    # Replace hyphens and underscores with spaces
    name = name.tr("-_", " ")

    # Check if this looks like an abbreviation (short, all letters, no spaces)
    # Examples: "svp", "abc", "ibm"
    if name.length <= 5 && name.match?(/^[a-z]+$/i) && !name.include?(" ")
      # Format as uppercase abbreviation
      name.upcase
    else
      # Capitalize each word
      name.split.map(&:capitalize).join(" ")
    end
  end

  # Fetch company details from website
  def fetch_company_details_from_website(domain)
    return {} unless domain.present?

    begin
      require "net/http"
      require "uri"
      require "timeout"

      # Construct website URL
      website_url = "https://#{domain}"
      uri = URI.parse(website_url)

      # Set up HTTP request with timeout
      response = Timeout.timeout(10) do
        Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 5, read_timeout: 5) do |http|
          request = Net::HTTP::Get.new(uri)
          request["User-Agent"] = "Mozilla/5.0 (compatible; TEEEMBot/1.0)"
          http.request(request)
        end
      end

      unless response.is_a?(Net::HTTPSuccess)
        Rails.logger.info("Website fetch returned #{response.code} for #{domain}")
        return { website: website_url }
      end

      html = response.body
      details = { website: website_url }

      # Extract company name (prioritize <title>, <h1>, or meta tags)
      if html =~ /<title[^>]*>(.*?)<\/title>/im
        title = Regexp.last_match(1).strip
        # Clean up title (remove common suffixes)
        details[:display_name] = title.gsub(/\s*[-|]\s*(Home|Welcome|About).*$/i, "").strip
      end

      # Extract ABN (Australian Business Number - 11 digits)
      # Matches: "ABN 12 345 678 901", "ABN: 12345678901", "A.B.N. 12 345 678 901"
      if html =~ /(?:ABN|A\.B\.N\.?)[:\s]*(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})/i
        details[:abn] = Regexp.last_match(1).gsub(/\s/, "")
      end

      # Extract ACN (Australian Company Number - 9 digits)
      # Matches: "ACN 123 456 789", "ACN: 123456789", "A.C.N. 123 456 789"
      if html =~ /(?:ACN|A\.C\.N\.?)[:\s]*(\d{3}\s?\d{3}\s?\d{3})/i
        details[:acn] = Regexp.last_match(1).gsub(/\s/, "")
      end

      # Extract phone numbers (Australian format)
      if html =~ /(\+61\s?\d{1,2}\s?\d{4}\s?\d{4})|(\(0\d\)\s?\d{4}\s?\d{4})|(0\d\s?\d{4}\s?\d{4})/
        details[:phone] = Regexp.last_match(0).gsub(/\s+/, " ").strip
      end

      # Extract email addresses (prioritize info@, contact@, or admin@)
      email_matches = html.scan(/([a-zA-Z0-9._%+-]+@#{Regexp.escape(domain)})/i)
      if email_matches.any?
        # Prioritize common contact emails
        priority_email = email_matches.flatten.find { |e| e =~ /^(info|contact|admin|hello|enquiries)@/i }
        details[:email] = priority_email || email_matches.flatten.first
      end

      # Extract address (look for common patterns)
      # Pattern 1: "Level X, Building, Street, Suburb STATE POSTCODE"
      if html =~ /(Level\s+\d+,?\s+[^,]+,\s+\d+\s+[^,]+,\s+[A-Z][a-z]+\s+(?:QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+\d{4})/i
        details[:address] = Regexp.last_match(1).strip
      # Pattern 2: "Suite/Unit, Street Address, Suburb STATE POSTCODE"
      elsif html =~ /((?:Suite|Unit)\s+\d+,?\s+\d+\s+[^,]+,\s+[A-Z][a-z]+\s+(?:QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+\d{4})/i
        details[:address] = Regexp.last_match(1).strip
      # Pattern 3: "Street Address, Suburb STATE POSTCODE"
      elsif html =~ /(\d+\s+[^,]+,\s+[A-Z][a-z]+\s+(?:QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+\d{4})/i
        details[:address] = Regexp.last_match(1).strip
      end

      # Extract description from meta description tag
      if html =~ /<meta\s+name=["']description["']\s+content=["'](.*?)["']/im
        details[:description] = Regexp.last_match(1).strip
      end

      # If we didn't get a company name from title, try to find it in the content
      if details[:display_name].blank?
        # Look for company name in common heading patterns
        if html =~ /<h1[^>]*>(.*?)<\/h1>/im
          h1_text = Regexp.last_match(1).gsub(/<[^>]+>/, "").strip
          details[:display_name] = h1_text unless h1_text.blank?
        end
      end

      Rails.logger.info("Fetched company details from #{domain}: #{details.keys.join(', ')}")
      details

    rescue Timeout::Error
      Rails.logger.warn("Timeout fetching website #{domain}")
      { website: "https://#{domain}" }
    rescue StandardError => e
      Rails.logger.error("Failed to fetch website #{domain}: #{e.message}")
      { website: "https://#{domain}" }
    end
  end

  # Analyze email signature to extract company information
  def analyze_signature_for_company(email)
    return nil unless @email_data

    # Find emails from this sender
    sender_emails = @email_data.select do |record|
      record["from_email"]&.downcase&.include?(email.downcase)
    end

    return nil if sender_emails.empty?

    # Extract signatures and look for company patterns
    company_name = nil

    sender_emails.each do |record|
      # Try to extract from body or signature field
      text = record["body"] || record["signature"] || ""
      next if text.blank?

      # Extract signature (text after common signature delimiters)
      signature = extract_signature_from_text(text)

      # Look for company patterns
      company_name = extract_company_from_signature(signature)
      break if company_name
    end

    return nil unless company_name

    # Fetch additional details from website
    domain = extract_domain(email)
    website_details = fetch_company_details_from_website(domain)

    # Check if this company already exists
    existing_companies = find_existing_companies("", company_name)

    if existing_companies.any?
      # Company exists
      if existing_companies.length > 1
        {
          name: company_name,
          exists: true,
          multiple_matches: true,
          matches: existing_companies.map { |company| {
            id: company.contact_id,
            name: company.contact&.display_name || company.name
          }},
          action: "link",
          source: "signature"
        }
      else
        {
          name: existing_companies.first.contact&.display_name || company_name,
          exists: true,
          existing_company_id: existing_companies.first.contact_id,
          action: "link",
          source: "signature"
        }
      end
    else
      # Suggest creating new company with website details
      {
        name: company_name,
        exists: false,
        existing_company_id: nil,
        action: "create",
        source: "signature",
        website_details: website_details
      }
    end
  end

  # Extract signature portion from email text
  def extract_signature_from_text(text)
    # Common signature delimiters
    delimiters = [
      /\n--\s*\n/,           # Standard "-- " delimiter
      /\nRegards,?\n/i,      # "Regards,"
      /\nBest regards,?\n/i, # "Best regards,"
      /\nThanks,?\n/i,       # "Thanks,"
      /\nCheers,?\n/i,       # "Cheers,"
      /\nKind regards,?\n/i  # "Kind regards,"
    ]

    delimiters.each do |delimiter|
      if text.match(delimiter)
        # Return everything after the delimiter
        parts = text.split(delimiter, 2)
        return parts[1] if parts.length > 1
      end
    end

    # If no delimiter found, try to get last 10 lines
    lines = text.split("\n")
    lines.last(10).join("\n")
  end

  # Extract company name from signature using patterns
  def extract_company_from_signature(signature)
    return nil if signature.blank?

    # Common company name patterns
    patterns = [
      # Australian companies
      /([A-Z][A-Za-z\s&]+(?:Pty\.?\s*Ltd\.?|PTY LTD|Pty Ltd))/,
      # US companies
      /([A-Z][A-Za-z\s&]+(?:Inc\.?|LLC|Corporation|Corp\.?))/,
      # UK companies
      /([A-Z][A-Za-z\s&]+(?:Ltd\.?|Limited|PLC))/,
      # Generic company indicators
      /([A-Z][A-Za-z\s&]+(?:Group|Partners|Associates|Consulting|Solutions|Services))/,
      # Lines with common business patterns
      /^([A-Z][A-Za-z\s&]{3,30})$/m  # Capitalized line of reasonable length
    ]

    patterns.each do |pattern|
      match = signature.match(pattern)
      if match && match[1]
        company_name = match[1].strip
        # Clean up the name
        company_name = company_name.gsub(/\s+/, " ")  # Normalize spaces
        return company_name if company_name.length > 2 && company_name.length < 100
      end
    end

    nil
  end

  # Extract phone numbers from signature
  # Returns { mobile:, office:, direct: } hash
  def extract_phone_numbers_from_signature(signature)
    return {} if signature.blank?

    phones = { mobile: nil, office: nil, direct: nil }

    # Australian mobile pattern: 04XX XXX XXX or +61 4XX XXX XXX
    mobile_patterns = [
      /(?:Mobile|Mob|M)[:\s]*(\+61\s?4\d{2}\s?\d{3}\s?\d{3})/i,
      /(?:Mobile|Mob|M)[:\s]*(04\d{2}\s?\d{3}\s?\d{3})/i,
      /(?:Mobile|Mob|M)[:\s]*(\+61\s?4\d{8})/i,
      /(?:Mobile|Mob|M)[:\s]*(04\d{8})/i,
      # Standalone mobile (less specific)
      /(\+61\s?4\d{2}\s?\d{3}\s?\d{3})/,
      /(04\d{2}\s?\d{3}\s?\d{3})/
    ]

    # Office/landline pattern: (0X) XXXX XXXX or +61 X XXXX XXXX
    office_patterns = [
      /(?:Office|Off|Tel|Phone|Ph|P)[:\s]*(\+61\s?\d{1}\s?\d{4}\s?\d{4})/i,
      /(?:Office|Off|Tel|Phone|Ph|P)[:\s]*(\(0\d\)\s?\d{4}\s?\d{4})/i,
      /(?:Office|Off|Tel|Phone|Ph|P)[:\s]*(0\d\s?\d{4}\s?\d{4})/i,
      # Standalone office (less specific)
      /(\+61\s?\d{1}\s?\d{4}\s?\d{4})/,
      /(\(0\d\)\s?\d{4}\s?\d{4})/,
      /(0\d\s?\d{4}\s?\d{4})/
    ]

    # Direct line pattern (including 1800 numbers)
    direct_patterns = [
      /(?:Direct|Dir|D)[:\s]*(\+61\s?\d{1}\s?\d{4}\s?\d{4})/i,
      /(?:Direct|Dir|D)[:\s]*(\(0\d\)\s?\d{4}\s?\d{4})/i,
      /(?:Direct|Dir|D)[:\s]*(0\d\s?\d{4}\s?\d{4})/i,
      /(?:Direct|Dir|D)[:\s]*(1800\s?\d{3}\s?\d{3})/i,
      /(?:Direct|Dir|D)[:\s]*(1300\s?\d{3}\s?\d{3})/i
    ]

    # Try to extract mobile first
    mobile_patterns.each do |pattern|
      match = signature.match(pattern)
      if match && match[1]
        phones[:mobile] = normalize_phone(match[1])
        break
      end
    end

    # Try to extract direct BEFORE office (so "D:" lines aren't matched by office patterns)
    direct_patterns.each do |pattern|
      match = signature.match(pattern)
      if match && match[1]
        candidate = normalize_phone(match[1])
        # Don't use if it's already mobile
        unless candidate == phones[:mobile]
          phones[:direct] = candidate
          break
        end
      end
    end

    # Try to extract office last
    office_patterns.each do |pattern|
      match = signature.match(pattern)
      if match && match[1]
        # Don't use this if it's already the mobile or direct
        candidate = normalize_phone(match[1])
        unless candidate == phones[:mobile] || candidate == phones[:direct]
          phones[:office] = candidate
          break
        end
      end
    end

    phones.compact
  end

  # Normalize phone number to consistent format
  def normalize_phone(phone)
    return nil if phone.blank?

    # Remove all non-digit characters except +
    clean = phone.gsub(/[^\d+]/, "")

    # Convert +61 to 0 for Australian numbers
    if clean.start_with?("+61")
      clean = "0" + clean[3..]
    end

    clean
  end

  # Find possible duplicate contact at the same company
  # Matches by name similarity (extracted from email)
  def find_possible_duplicate(email, company_contact_id)
    return nil if company_contact_id.blank?

    # Extract name from email local part
    local_part = email.split("@").first
    name_parts = local_part.split(/[._-]/).map(&:downcase)

    # Find contacts at this company
    contacts_at_company = Contact.where(primary_company_id: company_contact_id)
                                 .where.not(email: email)

    # Look for name matches
    contacts_at_company.each do |contact|
      contact_name_parts = contact.display_name.downcase.split(/\s+/)

      # Check if any part of the email matches the contact's name
      matching_parts = name_parts & contact_name_parts

      if matching_parts.any?
        return {
          id: contact.id,
          name: contact.display_name,
          email: contact.email,
          match_confidence: (matching_parts.length.to_f / [ name_parts.length, contact_name_parts.length ].min * 100).round
        }
      end
    end

    nil
  end

  # Find company from existing contacts with the same email domain
  def find_company_from_existing_contacts(domain)
    # Find contacts with emails in this domain that have a primary_company
    contact_with_company = Contact.joins(:primary_company)
                                  .where("contacts.email LIKE ?", "%@#{domain}")
                                  .where.not(primary_company_id: nil)
                                  .includes(:primary_company)
                                  .first

    if contact_with_company&.primary_company
      {
        id: contact_with_company.primary_company_id,
        name: contact_with_company.primary_company.display_name
      }
    else
      nil
    end
  end

  # Find existing companies by domain or name (returns array of all matches)
  def find_existing_companies(domain, suggested_name)
    matches = []

    # Try exact match first (through contact)
    exact_matches = CorporateCompany.joins(:contact)
                           .where("LOWER(contacts.display_name) = ?", suggested_name.downcase)
                           .limit(10)

    matches.concat(exact_matches) if exact_matches.any?

    # Try partial match - find companies where the name starts with the suggested name
    # This will match "Tekna" to "Tekna Homes", "Tekna Admin", etc.
    partial_matches = CorporateCompany.joins(:contact)
                             .where("LOWER(contacts.display_name) LIKE ?", "#{suggested_name.downcase}%")
                             .where.not(id: matches.map(&:id))  # Exclude already found
                             .order("LENGTH(contacts.display_name)")
                             .limit(10)

    matches.concat(partial_matches) if partial_matches.any?

    # Try abbreviation match - if suggested name looks like an abbreviation (all caps, short)
    # Match it as a word in company names
    # Example: "SVP" matches "SV Partners", "ABC" matches "ABC Construction" or "Australian Building Co"
    if matches.empty? && suggested_name.length <= 5 && suggested_name.match?(/^[A-Z]+$/)
      # Try matching as a word boundary (e.g., "SVP" matches "SV Partners", "SVP Group")
      # Use PostgreSQL regex with ~* (case-insensitive) and \y for word boundaries
      abbreviation_matches = CorporateCompany.joins(:contact)
                                    .where("contacts.display_name ~* ?", "\\y#{suggested_name}\\y")
                                    .order("LENGTH(contacts.display_name)")
                                    .limit(10)

      # Also try matching first letters of words (e.g., "SVP" matches "SV Partners", "St Vincent Partners")
      if abbreviation_matches.empty?
        # Build regex pattern: "SVP" -> match names where words start with S, V, P
        # This is complex, so let's try a simpler approach: match names containing the abbreviation
        word_match = CorporateCompany.joins(:contact)
                           .where("contacts.display_name ILIKE ?", "%#{suggested_name}%")
                           .order("LENGTH(contacts.display_name)")
                           .limit(10)

        matches.concat(word_match) if word_match.any?
      else
        matches.concat(abbreviation_matches)
      end
    end

    # Also try reverse - if suggested name contains an existing company name
    if matches.empty?
      contained_matches = CorporateCompany.joins(:contact)
                                 .where("LOWER(?) LIKE CONCAT('%', LOWER(contacts.display_name), '%')", suggested_name)
                                 .order("LENGTH(contacts.display_name) DESC")
                                 .limit(10)

      matches.concat(contained_matches) if contained_matches.any?
    end

    matches
  end

  # Handle company action (link, create, or none)
  def handle_company_action(action, company_id, company_name, created_companies, website_details = {})
    case action
    when "link"
      company_id.to_i if company_id.present?
    when "create"
      # Use display_name from website details if available, otherwise use company_name
      full_company_name = website_details[:display_name].presence || company_name

      # Create company contact first with website details
      company_contact = Contact.create!(
        display_name: full_company_name,
        entity_type: "company",
        is_active: true,
        website: website_details[:website],
        office_phone: website_details[:phone],
        email: website_details[:email]
      )

      # Create company record with website details
      company = CorporateCompany.create!(
        name: full_company_name,
        contact_id: company_contact.id,
        status: "active",
        abn: website_details[:abn],
        acn: website_details[:acn],
        registered_office_address: website_details[:address],
        purpose: website_details[:description]
      )

      created_companies << {
        id: company.id,
        name: full_company_name,
        contact_id: company_contact.id
      }

      company.id
    else
      nil
    end
  end

  # Parse name from display_name or email
  def parse_name_from_display_or_email(display_name, email)
    if display_name.present?
      # Split display name into first and last
      parts = display_name.strip.split(/\s+/)
      if parts.length == 1
        { first_name: parts[0], last_name: nil }
      else
        { first_name: parts[0], last_name: parts[1..-1].join(" ") }
      end
    else
      # Try to extract from email (e.g., john.doe@example.com => John Doe)
      local_part = email.split("@").first
      name_parts = local_part.split(/[._-]/).map(&:capitalize)

      if name_parts.length == 1
        { first_name: name_parts[0], last_name: nil }
      else
        { first_name: name_parts[0], last_name: name_parts[1..-1].join(" ") }
      end
    end
  end

  # Check if a phone number already exists for a contact
  def phone_exists_for_contact?(contact, phone_number)
    return false if phone_number.blank?
    normalized_phone = normalize_phone(phone_number)
    contact.contact_phones.exists?(phone_number: normalized_phone)
  end

  def email_exists_for_contact?(contact, email)
    return false if email.blank?
    normalized_email = normalize_email(email)
    # Check both legacy email field and contact_emails table
    contact.email == normalized_email || contact.contact_emails.exists?(email: normalized_email)
  end
end
