module SsotAuthorization
  extend ActiveSupport::Concern

  # CONFIDENTIAL_FIELDS - Fields that require can_view_confidential permission
  CONFIDENTIAL_FIELDS = %w[
    tfn
    passport_number
    passport_expiry
    drivers_licence_number
    drivers_licence_expiry
    bank_bsb
    bank_account_number
    bank_account_name
    date_of_birth
    residential_address
  ].freeze

  included do
    helper_method :god_view?, :can_view_confidential?, :can_view_corporate?, :can_edit_corporate?, :can_view_cases?, :can_edit_cases?, :accessible_company_groups if respond_to?(:helper_method)
  end

  # Check if current user has God View access (sees everything in their groups)
  def god_view?
    current_user&.god_view?
  end

  # Check if current user can view confidential fields
  def can_view_confidential?
    current_user&.can_view_confidential?
  end

  # SSoT: Check if current user can view corporate data (directorships, shareholdings, corporate structure)
  def can_view_corporate?
    current_user&.can_view_corporate?
  end

  # SSoT: Check if current user can edit corporate data
  def can_edit_corporate?
    current_user&.can_edit_corporate?
  end

  # SSoT: Check if current user can view case/legal data
  def can_view_cases?
    current_user&.can_view_cases?
  end

  # SSoT: Check if current user can edit case/legal data
  def can_edit_cases?
    current_user&.can_edit_cases?
  end

  # Get company groups accessible to current user
  def accessible_company_groups
    current_user&.accessible_company_groups || CorporateGroup.none
  end

  # Filter contact attributes based on user permissions
  def filter_confidential_fields(contact_attributes)
    return contact_attributes if can_view_confidential?

    filtered = contact_attributes.dup
    CONFIDENTIAL_FIELDS.each do |field|
      if filtered.key?(field) && filtered[field].present?
        filtered[field] = "[RESTRICTED]"
      end
    end
    filtered
  end

  # Check if a specific field should be hidden
  def confidential_field?(field_name)
    CONFIDENTIAL_FIELDS.include?(field_name.to_s)
  end

  # SSoT: Check if user can access a specific company group
  def can_access_company_group?(company_group)
    return false unless current_user
    return true if current_user.admin?

    accessible_company_groups.exists?(id: company_group.id)
  end

  # SSoT: Check if user can access a specific contact within a group
  def can_access_contact?(contact, company_group = nil)
    return false unless current_user
    return true if god_view?

    # For relationship view, check if user has a relationship with this contact
    # This would be used for portal users
    # TODO: Implement when portal SSoT is built
    false
  end
end
