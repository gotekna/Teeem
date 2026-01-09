class XeroContactValidator
  attr_reader :contact, :errors

  def initialize(contact)
    @contact = contact
    @errors = []
  end

  # Main validation method - returns true if valid, false otherwise
  def valid?
    @errors = []

    validate_name_presence
    validate_email_format
    validate_entity_type
    validate_tax_number_format
    validate_phone_format
    validate_required_fields_for_entity_type

    @errors.empty?
  end

  # Get validation errors as a formatted string
  def error_messages
    @errors.join(", ")
  end

  # Get validation errors grouped by field
  def errors_by_field
    @errors.group_by { |err| err[:field] }
  end

  # Check if contact can be synced (combination of validation + sync rules)
  def can_sync?(sync_config = nil)
    # First check if contact passes business rules (employees, price_only, etc.)
    if sync_config && !sync_config.should_sync_contact?(contact)
      @errors << { field: :sync_rules, message: "Contact skipped by sync rule: #{sync_config.skip_reason(contact)}" }
      return false
    end

    # Then check if contact has valid data for Xero
    valid?
  end

  private

  def validate_name_presence
    # Xero requires either Name OR (FirstName + LastName)
    # We use display_name as Name field, so check that it's present
    name = contact.display_name.presence ||
           "#{contact.first_name} #{contact.last_name}".strip.presence

    if name.blank?
      @errors << {
        field: :name,
        message: "Contact must have a name (display_name or first_name + last_name)"
      }
    end

    # Xero has a 500 character limit on Name field
    if name.present? && name.length > 500
      @errors << {
        field: :name,
        message: "Name is too long (maximum 500 characters, currently #{name.length})"
      }
    end
  end

  def validate_email_format
    return if contact.email.blank?

    # Use Rails built-in email validation
    unless contact.email.match?(URI::MailTo::EMAIL_REGEXP)
      @errors << {
        field: :email,
        message: "Email format is invalid: #{contact.email}"
      }
    end

    # Xero has a 255 character limit on email
    if contact.email.length > 255
      @errors << {
        field: :email,
        message: "Email is too long (maximum 255 characters)"
      }
    end
  end

  def validate_entity_type
    # price_only entity type cannot be synced to Xero
    # These are contacts used only for pricebook data (web scraping, legacy suppliers)
    if contact.entity_type == "price_only"
      @errors << {
        field: :entity_type,
        message: "Cannot sync price_only contacts to Xero"
      }
    end

    # Entity type must be present
    if contact.entity_type.blank?
      @errors << {
        field: :entity_type,
        message: "Entity type is required"
      }
    end

    # Entity type must be valid
    unless Contact::ENTITY_TYPES.include?(contact.entity_type)
      @errors << {
        field: :entity_type,
        message: "Invalid entity type: #{contact.entity_type}"
      }
    end
  end

  def validate_tax_number_format
    return if contact.abn.blank?

    # ABN/ACN validation using existing AbrApiService
    unless AbrApiService.valid_format?(contact.abn)
      @errors << {
        field: :abn,
        message: "Tax number (ABN/ACN) format is invalid: #{contact.abn}"
      }
    end
  end

  def validate_phone_format
    # Validate mobile phone
    if contact.mobile_phone.present? && contact.mobile_phone.length > 50
      @errors << {
        field: :mobile_phone,
        message: "Mobile phone is too long (maximum 50 characters)"
      }
    end

    # Validate office phone
    if contact.office_phone.present? && contact.office_phone.length > 50
      @errors << {
        field: :office_phone,
        message: "Office phone is too long (maximum 50 characters)"
      }
    end

    # Validate fax phone
    if contact.fax_phone.present? && contact.fax_phone.length > 50
      @errors << {
        field: :fax_phone,
        message: "Fax phone is too long (maximum 50 characters)"
      }
    end
  end

  def validate_required_fields_for_entity_type
    case contact.entity_type
    when "person"
      # Person contacts need at least first_name
      if contact.first_name.blank?
        @errors << {
          field: :first_name,
          message: "First name is required for person contacts"
        }
      end
    when "company", "trust"
      # Company/Trust contacts need company_name_or_trust OR display_name
      if contact.company_name_or_trust.blank? && contact.display_name.blank?
        @errors << {
          field: :company_name_or_trust,
          message: "Company/trust name is required for #{contact.entity_type} contacts"
        }
      end
    when "sole_trader"
      # Sole trader needs at least first_name (business name is optional)
      if contact.first_name.blank?
        @errors << {
          field: :first_name,
          message: "First name is required for sole trader contacts"
        }
      end
    end
  end
end
