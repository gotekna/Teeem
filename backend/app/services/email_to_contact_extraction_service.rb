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
  # @param email_data [Array<Hash>] Array of email records with from_email, to_emails, cc_emails
  # @param scope [String] 'current_view' or 'all_history' (for future use)
  # @return [Hash] Analysis results with email candidates and suggestions
  def extract_and_analyze(email_data, scope: 'current_view')
    # Extract all unique email addresses
    all_emails = extract_emails_from_data(email_data)

    # Normalize and deduplicate
    normalized_emails = all_emails.map { |e| normalize_email_entry(e) }.compact.uniq { |e| e[:email] }

    # Batch check existing contacts
    existing_contacts_map = find_existing_contacts(normalized_emails.map { |e| e[:email] })

    # Generate suggestions for each email
    results = normalized_emails.map do |entry|
      email = entry[:email]
      is_existing = existing_contacts_map.key?(email)

      {
        email: email,
        display_name: entry[:display_name],
        is_existing_contact: is_existing,
        existing_contact_id: existing_contacts_map[email]&.id,
        existing_contact_name: existing_contacts_map[email]&.full_name,
        domain: extract_domain(email),
        is_generic_domain: generic_domain?(email),
        suggested_company: is_existing ? nil : generate_company_suggestion(email)
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
  # @param selections [Array<Hash>] Array of { email:, display_name:, entity_type:, company_action:, company_id:, company_name: }
  # @return [Hash] Results with created contacts, companies, and errors
  def bulk_create(selections)
    created_contacts = []
    created_companies = []
    linked_to_companies = []
    errors = []

    ActiveRecord::Base.transaction do
      selections.each do |selection|
        begin
          # Skip if contact already exists
          if Contact.exists?(email: normalize_email(selection[:email]))
            errors << { email: selection[:email], error: 'Contact already exists' }
            next
          end

          # Handle company action
          company_id = handle_company_action(
            selection[:company_action],
            selection[:company_id],
            selection[:company_name],
            created_companies
          )

          # Parse name from display_name or email
          parsed_name = parse_name_from_display_or_email(selection[:display_name], selection[:email])

          # Create contact
          contact = Contact.create!(
            email: normalize_email(selection[:email]),
            first_name: parsed_name[:first_name],
            last_name: parsed_name[:last_name],
            entity_type: selection[:entity_type] || 'person',
            primary_company_id: company_id,
            is_active: true,
            created_by: @user.id
          )

          created_contacts << {
            id: contact.id,
            full_name: contact.full_name,
            email: contact.email,
            entity_type: contact.entity_type
          }

          if company_id.present?
            company = Company.find(company_id)
            linked_to_companies << {
              contact_id: contact.id,
              company_id: company_id,
              company_name: company.contact&.full_name || company.name
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
      errors: errors
    }
  rescue ActiveRecord::Rollback
    {
      success: false,
      created_contacts: [],
      created_companies: [],
      linked_to_companies: [],
      errors: [{ error: 'Transaction failed' }]
    }
  end

  private

  # Extract all email addresses from email data
  def extract_emails_from_data(email_data)
    emails = []

    email_data.each do |record|
      # Extract from from_email
      if record['from_email'].present?
        emails << record['from_email']
      end

      # Extract from to_emails array
      if record['to_emails'].is_a?(Array)
        emails.concat(record['to_emails'].compact)
      elsif record['to_emails'].present?
        emails << record['to_emails']
      end

      # Extract from cc_emails array
      if record['cc_emails'].is_a?(Array)
        emails.concat(record['cc_emails'].compact)
      elsif record['cc_emails'].present?
        emails << record['cc_emails']
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
    email.include?('@') && email.match?(/\A[^@\s]+@[^@\s]+\.[^@\s]+\z/)
  end

  # Extract domain from email
  def extract_domain(email)
    email.split('@').last.to_s.downcase
  end

  # Check if domain is a generic consumer email domain
  def generic_domain?(email)
    domain = extract_domain(email)
    GENERIC_DOMAINS.include?(domain)
  end

  # Batch find existing contacts
  def find_existing_contacts(emails)
    return {} if emails.empty?

    contacts = Contact.where(email: emails).index_by(&:email)
    contacts
  end

  # Generate company suggestion from email domain
  def generate_company_suggestion(email)
    return nil if generic_domain?(email)

    domain = extract_domain(email)
    suggested_name = format_company_name(domain)

    # Check if company already exists
    existing_company = find_existing_company(domain, suggested_name)

    if existing_company
      {
        name: existing_company.contact&.full_name || existing_company.name || suggested_name,
        exists: true,
        existing_company_id: existing_company.id,
        action: 'link'
      }
    else
      {
        name: suggested_name,
        exists: false,
        existing_company_id: nil,
        action: 'create'
      }
    end
  end

  # Format company name from domain
  # "tekna.com.au" => "Tekna"
  # "abc-construction.com" => "ABC Construction"
  def format_company_name(domain)
    # Remove common TLDs
    name = domain.gsub(/\.(com|net|org|au|uk|co|io|dev|app|tech|biz|info)(\..*)?$/, '')

    # Replace hyphens and underscores with spaces
    name = name.tr('-_', ' ')

    # Capitalize each word
    name.split.map(&:capitalize).join(' ')
  end

  # Find existing company by domain or name
  def find_existing_company(domain, suggested_name)
    # Try to find by name first (through contact)
    company_by_name = Company.joins(:contact)
                             .where('LOWER(contacts.full_name) = ?', suggested_name.downcase)
                             .first

    return company_by_name if company_by_name

    # Could add domain-based lookup if we store domains in companies
    # For now, just return nil if not found by name
    nil
  end

  # Handle company action (link, create, or none)
  def handle_company_action(action, company_id, company_name, created_companies)
    case action
    when 'link'
      company_id.to_i if company_id.present?
    when 'create'
      # Create company contact first
      company_contact = Contact.create!(
        full_name: company_name,
        entity_type: 'company',
        is_active: true,
        created_by: @user.id
      )

      # Create company record
      company = Company.create!(
        name: company_name,
        contact_id: company_contact.id,
        status: 'active'
      )

      created_companies << {
        id: company.id,
        name: company_name,
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
        { first_name: parts[0], last_name: parts[1..-1].join(' ') }
      end
    else
      # Try to extract from email (e.g., john.doe@example.com => John Doe)
      local_part = email.split('@').first
      name_parts = local_part.split(/[._-]/).map(&:capitalize)

      if name_parts.length == 1
        { first_name: name_parts[0], last_name: nil }
      else
        { first_name: name_parts[0], last_name: name_parts[1..-1].join(' ') }
      end
    end
  end
end
