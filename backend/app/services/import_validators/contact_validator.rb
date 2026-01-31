# frozen_string_literal: true

module ImportValidators
  # ContactValidator - Validates contact import data
  #
  # Validates contacts for import, checking:
  # - Required fields based on entity_type
  # - Email/phone format validation
  # - ABN validation
  # - Contact type lookup
  # - Duplicate detection
  #
  class ContactValidator < BaseValidator
    # Required for all contacts
    REQUIRED_COLUMNS = %w[entity_type].freeze

    # Optional columns
    OPTIONAL_COLUMNS = %w[
      first_name last_name company_name_or_trust
      email mobile_phone office_phone
      street_address city state postcode
      abn contact_type primary_company_name
    ].freeze

    VALID_ENTITY_TYPES = %w[person company trust sole_trader].freeze

    def initialize(rows, options = {})
      super
      @existing_emails = Contact.joins(:contact_emails).pluck('contact_emails.email').map(&:downcase)
      @existing_abns = Contact.where.not(abn: nil).pluck(:abn)
      @contact_types = ContactType.pluck(:name)
      @existing_companies = Contact.where(entity_type: 'company').pluck(:company_name_or_trust)
    end

    protected

    def validate_row(row, row_number)
      entity_type = row['entity_type']&.to_s&.downcase&.strip

      # Validate entity type
      unless VALID_ENTITY_TYPES.include?(entity_type)
        add_error(row_number, "Invalid entity_type: #{entity_type}. Must be one of: #{VALID_ENTITY_TYPES.join(', ')}", column: 'entity_type', value: entity_type)
        return
      end

      # Entity-specific required fields
      case entity_type
      when 'person', 'sole_trader'
        validate_required(row, row_number, 'first_name', row['first_name'])
      when 'company', 'trust'
        validate_required(row, row_number, 'company_name_or_trust', row['company_name_or_trust'])
      end

      # Validate email
      email = row['email']&.strip
      if email.present?
        validate_email(row, row_number, 'email', email)
        check_duplicate_email(row_number, email)
      end

      # Validate phones
      validate_phone(row, row_number, 'mobile_phone', row['mobile_phone'])
      validate_phone(row, row_number, 'office_phone', row['office_phone'])

      # Validate address
      validate_postcode(row, row_number, 'postcode', row['postcode'])
      validate_state(row, row_number, 'state', row['state'])

      # Validate ABN
      abn = row['abn']
      if abn.present?
        validate_abn(row, row_number, 'abn', abn)
        check_duplicate_abn(row_number, abn)
      end

      # Validate contact type lookup
      contact_type = row['contact_type']
      if contact_type.present?
        validate_lookup(row, row_number, 'contact_type', contact_type, @contact_types, auto_create: options[:auto_create_lookups])
      end

      # Validate primary company reference
      primary_company = row['primary_company_name']
      if primary_company.present? && entity_type == 'person'
        unless @existing_companies.include?(primary_company)
          add_warning(row_number, "Primary company not found: #{primary_company}", column: 'primary_company_name', value: primary_company)
        end
      end
    end

    def preview_row(row, row_number)
      entity_type = row['entity_type']&.to_s&.downcase&.strip

      display_name = case entity_type
                     when 'person', 'sole_trader'
                       [row['first_name'], row['last_name']].compact.join(' ')
                     when 'company', 'trust'
                       row['company_name_or_trust']
                     else
                       'Unknown'
                     end

      {
        row: row_number,
        display_name: display_name,
        entity_type: entity_type,
        email: row['email'],
        phone: row['mobile_phone'] || row['office_phone'],
        location: [row['city'], row['state']].compact.join(', '),
        status: row_status(row, row_number),
        errors: row_errors(row_number),
        warnings: row_warnings(row_number),
        action: determine_action(row)
      }
    end

    private

    def check_duplicate_email(row_number, email)
      normalized = email.downcase.strip
      if @existing_emails.include?(normalized)
        add_warning(row_number, "Email already exists: #{email}", column: 'email', value: email)
      end
    end

    def check_duplicate_abn(row_number, abn)
      cleaned = abn.to_s.gsub(/\D/, '')
      if @existing_abns.include?(cleaned)
        add_warning(row_number, "ABN already exists: #{abn}", column: 'abn', value: abn)
      end
    end

    def determine_action(row)
      email = row['email']&.downcase&.strip
      abn = row['abn']&.gsub(/\D/, '')

      if email.present? && @existing_emails.include?(email)
        options[:update_existing] ? 'update' : 'skip'
      elsif abn.present? && @existing_abns.include?(abn)
        options[:update_existing] ? 'update' : 'skip'
      else
        'create'
      end
    end
  end
end
