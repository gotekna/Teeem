# frozen_string_literal: true

# ContactQualityActionService - Executes approved quality review actions
#
# Actions:
# - convert_to_company: Change Person to Company entity
# - convert_to_person: Change Company to Person entity
# - link_to_existing_company: Create employee_of relationship
# - create_new_company_and_link: Create new Company, then link
#
class ContactQualityActionService
  class ActionError < StandardError; end

  def initialize(review)
    @review = review
    @contact = review.contact
  end

  def execute!
    case @review.recommended_action
    when "convert_to_company"
      convert_person_to_company!
    when "convert_to_person"
      convert_company_to_person!
    when "link_to_existing_company"
      link_to_existing_company!
    when "create_new_company_and_link"
      create_company_and_link!
    when "no_action"
      # Nothing to do
      Rails.logger.info "Quality review #{@review.id}: No action required"
    else
      raise ActionError, "Unknown action: #{@review.recommended_action}"
    end
  end

  private

  def convert_person_to_company!
    raise ActionError, "Contact is not a person" unless @contact.entity_type == "person"

    ActiveRecord::Base.transaction do
      # Determine company name from ABR or existing data
      company_name = derive_company_name

      # Update entity type and company fields
      @contact.update!(
        entity_type: "company",
        company_name_or_trust: company_name,
        # Keep person fields for reference but they won't be used for display
        # Clear them if we have good company data
        first_name: nil,
        middle_name: nil,
        last_name: nil
      )

      # Add email domain to email_domains if we have a business domain
      add_email_domain_to_company

      # Update ABN validation fields if we have ABR data
      update_abn_fields

      Rails.logger.info "Quality action: Converted contact #{@contact.id} from person to company '#{company_name}'"
    end
  end

  def convert_company_to_person!
    raise ActionError, "Contact is not a company/trust" unless %w[company trust].include?(@contact.entity_type)

    ActiveRecord::Base.transaction do
      # Parse name into first/last
      names = parse_person_name(@contact.company_name_or_trust || @contact.display_name)

      @contact.update!(
        entity_type: "person",
        first_name: names[:first_name],
        middle_name: names[:middle_name],
        last_name: names[:last_name],
        company_name_or_trust: nil
      )

      Rails.logger.info "Quality action: Converted contact #{@contact.id} from company to person '#{names[:first_name]} #{names[:last_name]}'"
    end
  end

  def link_to_existing_company!
    company = @review.suggested_company
    raise ActionError, "No suggested company to link" unless company
    raise ActionError, "Contact is not a person" unless @contact.entity_type == "person"

    ActiveRecord::Base.transaction do
      # Create employee_of relationship (SSoT: ContactRelationship)
      relationship = ContactRelationship.find_or_initialize_by(
        source_contact_id: @contact.id,
        related_contact_id: company.id,
        relationship_type: "employee_of"
      )

      relationship.assign_attributes(
        is_active: true,
        notes: "Auto-created from quality review (domain: #{@review.email_domain})"
      )
      relationship.save!

      # Update primary_company_id (will sync via callback)
      @contact.update!(primary_company_id: company.id)

      Rails.logger.info "Quality action: Linked contact #{@contact.id} as employee of company #{company.id} (#{company.display_name})"
    end
  end

  def create_company_and_link!
    raise ActionError, "Contact is not a person" unless @contact.entity_type == "person"

    ActiveRecord::Base.transaction do
      # Create new company contact
      company_name = @review.derived_company_name.presence ||
                     derive_company_name_from_abr ||
                     derive_company_name_from_domain

      raise ActionError, "Cannot determine company name" if company_name.blank?

      company = Contact.create!(
        entity_type: "company",
        company_name_or_trust: company_name,
        display_name: company_name,
        email_domains: [@review.email_domain].compact,
        tax_number: @review.abr_data&.dig("abn")
      )

      # Create employee_of relationship
      ContactRelationship.create!(
        source_contact_id: @contact.id,
        related_contact_id: company.id,
        relationship_type: "employee_of",
        is_active: true,
        notes: "Auto-created from quality review (domain: #{@review.email_domain})"
      )

      # Update primary_company_id
      @contact.update!(primary_company_id: company.id)

      # Update review with the new company reference
      @review.update!(suggested_company_id: company.id)

      Rails.logger.info "Quality action: Created company #{company.id} (#{company_name}) and linked contact #{@contact.id}"
    end
  end

  # Helper methods

  def derive_company_name
    # Priority 1: ABR entity name
    return @review.abr_data["entity_name"] if @review.abr_data&.dig("entity_name").present?

    # Priority 2: Derived from domain
    return @review.derived_company_name if @review.derived_company_name.present?

    # Priority 3: Existing company_name_or_trust
    return @contact.company_name_or_trust if @contact.company_name_or_trust.present?

    # Priority 4: Display name
    @contact.display_name
  end

  def derive_company_name_from_abr
    @review.abr_data&.dig("entity_name")
  end

  def derive_company_name_from_domain
    return nil if @review.email_domain.blank?

    # Basic domain to name conversion
    base = @review.email_domain.split(".").first
    return nil if base.blank?

    # Make it more readable
    base.gsub(/([a-z])([A-Z])/, '\1 \2')
        .split(/[_\-]/)
        .map(&:capitalize)
        .join(" ")
  end

  def add_email_domain_to_company
    return if @review.email_domain.blank?

    domains = @contact.email_domains || []
    return if domains.include?(@review.email_domain)

    @contact.update!(email_domains: domains + [@review.email_domain])
  end

  def update_abn_fields
    # ABN cache columns not implemented yet - skip for now
    # Future: Add abn_entity_name, abn_entity_type, abn_valid, abn_verified_at columns to contacts
  end

  def parse_person_name(name)
    return { first_name: nil, middle_name: nil, last_name: nil } if name.blank?

    # Remove company suffixes that might still be in the name
    cleaned = name.gsub(/\s*(pty\.?\s*ltd\.?|ltd\.?|limited|inc\.?|incorporated|llc|plc)\s*$/i, "").strip

    parts = cleaned.split(/\s+/)

    case parts.length
    when 0
      { first_name: nil, middle_name: nil, last_name: nil }
    when 1
      { first_name: parts[0], middle_name: nil, last_name: nil }
    when 2
      { first_name: parts[0], middle_name: nil, last_name: parts[1] }
    else
      { first_name: parts[0], middle_name: parts[1..-2].join(" "), last_name: parts[-1] }
    end
  end
end
