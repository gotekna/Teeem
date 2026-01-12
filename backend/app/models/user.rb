class User < ApplicationRecord
  has_secure_password validations: false  # Disable default validations to make password optional for OAuth

  belongs_to :user_group, optional: true
  belongs_to :contact, optional: true  # Link user to their contact record for data sync
  has_many :grok_plans, dependent: :destroy
  has_many :chat_messages, dependent: :destroy
  has_many :foundation_views, dependent: :destroy
  has_many :imap_credentials, dependent: :destroy
  has_many :email_rules, dependent: :destroy
  has_many :email_labels, dependent: :destroy
  has_many :email_templates, dependent: :destroy
  has_many :email_snoozes, dependent: :destroy
  has_many :email_user_states, dependent: :destroy
  has_many :email_drafts, dependent: :destroy
  has_many :email_mailbox_favorites, dependent: :destroy
  has_many :vip_senders, dependent: :destroy
  has_many :email_warehouses, foreign_key: :synced_by_user_id, dependent: :nullify
  has_one :email_sync_status, dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_many :user_navigation_configs, dependent: :destroy
  has_many :task_followers, dependent: :destroy
  has_many :followed_tasks, through: :task_followers, source: :sm_task
  has_many :teeem_spreadsheets, dependent: :destroy
  has_many :teeem_documents, dependent: :destroy
  has_many :teeem_presentations, dependent: :destroy

  # Digital signature for certificates (Form 43, contracts, etc.)
  has_one_attached :signature

  # Signature usage register - tracks every time signature is used
  has_many :signature_usages, dependent: :destroy

  # Multi-role support (SSoT: user_roles join table)
  has_many :user_roles, dependent: :destroy
  has_many :roles, through: :user_roles

  # SSoT: Scope for finding users by role name (uses user_roles join table)
  scope :with_role, ->(role_name) { joins(:roles).where(roles: { name: role_name }).distinct }

  # Placeholder for company association (not yet implemented)
  # Returns nil - callers should handle this gracefully
  def company
    nil
  end

  # SSoT: Get user's Microsoft credential (replaces has_one :microsoft_token)
  def microsoft_token
    MicrosoftCredential.for_user(self).delegated_credentials.connected.first
  end

  # SSoT: Assignable roles come from Role model (see Role.for_select)
  # No hardcoded ASSIGNABLE_ROLES constant - database is the source of truth

  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true
  validates :password, length: { minimum: 8 }, if: :password_required?
  validate :password_complexity, if: :password_required?

  # SSoT: Sync mobile_phone to linked contact when user is updated
  after_save :sync_mobile_to_contact, if: -> { saved_change_to_mobile_phone? && contact.present? }

  # Role helper methods
  # SSoT: ONLY use user_roles join table - legacy role column is deprecated
  def admin?
    roles.exists?(name: "admin")
  end

  def user?
    roles.exists?(name: "user")
  end

  def product_owner?
    roles.exists?(name: "product_owner")
  end

  def estimator?
    roles.exists?(name: "estimator")
  end

  def supervisor?
    roles.exists?(name: "supervisor")
  end

  def builder?
    roles.exists?(name: "builder")
  end

  # Get user initials from name (e.g., "Robert Harder" -> "RH")
  def initials
    return "" if name.blank?
    name.split.map { |n| n[0] }.join.upcase[0..2]
  end

  # Get signature URL for PDF generation (base64 data URL for embedding)
  def signature_data_url
    return nil unless signature.attached?
    content_type = signature.content_type
    blob_data = signature.download
    base64_data = Base64.strict_encode64(blob_data)
    "data:#{content_type};base64,#{base64_data}"
  end

  # Check if user has complete QBCC credentials for certificate signing
  def can_sign_certificates?
    signature.attached? && qbcc_licence_number.present? && qbcc_licence_class.present?
  end

  # SSoT: God View access (internal staff sees everything)
  # God View users see all entities in all groups they have access to
  # SSoT: Check against Role.god_view_access column (database is SSoT)
  def god_view?
    roles.with_god_view.exists?
  end

  # SSoT: Can this user view confidential fields (TFN, passport, bank details)?
  def can_view_confidential?
    return true if admin?
    can_view_confidential_fields
  end

  # SSoT: Get accessible company groups for this user
  def accessible_company_groups
    if admin?
      CorporateGroup.all
    else
      # TODO: Add UserCompanyGroupAssignment when needed
      # For now, all internal users can see all groups
      CorporateGroup.all
    end
  end

  # Permission checks for schedule features
  def can_create_templates?
    admin? || product_owner?
  end

  def can_edit_schedule?
    admin? || product_owner? || estimator?
  end

  def can_view_supervisor_tasks?
    admin? || supervisor?
  end

  def can_view_builder_tasks?
    admin? || builder?
  end

  # SSoT: Can this user view corporate data (directorships, shareholdings, corporate structure)?
  def can_view_corporate?
    permissions.include?("view_corporate_data")
  end

  # SSoT: Can this user edit corporate data?
  def can_edit_corporate?
    permissions.include?("edit_corporate_data")
  end

  # SSoT: Can this user view case/legal data?
  def can_view_cases?
    permissions.include?("view_case_data")
  end

  # SSoT: Can this user edit case/legal data?
  def can_edit_cases?
    permissions.include?("edit_case_data")
  end

  # Returns array of permission strings for this user
  # SSoT: Aggregates permissions from ALL roles via user_roles join table
  def permissions
    perms = []

    # Base permissions for all users
    perms += [ "view_dashboard", "view_jobs", "view_contacts" ]

    # SSoT: Get permissions from all assigned roles
    role_names.each do |role_name|
      perms += permissions_for_role(role_name)
    end

    perms.uniq
  end

  # Permission definitions for each role
  # SSoT: This is THE ONE place where role->permission mappings are defined
  def permissions_for_role(role_name)
    case role_name
    when "admin"
      [
        "manage_permissions",
        "manage_users",
        "manage_system",
        "create_templates",
        "edit_schedule",
        "view_supervisor_tasks",
        "view_builder_tasks",
        "edit_projects",
        "manage_workflows",
        "view_gantt",
        "manage_company_settings",
        "manage_integrations",
        "god_view",
        "view_confidential_fields",
        "view_all_company_groups",
        "edit_company_group_memberships",
        "run_investigations",
        "view_corporate_data",
        "edit_corporate_data",
        "view_case_data",
        "edit_case_data"
      ]
    when "product_owner"
      [
        "create_templates",
        "edit_schedule",
        "edit_projects",
        "view_gantt",
        "god_view",
        "view_all_company_groups",
        "view_corporate_data",
        "view_case_data"
      ]
    when "estimator"
      [
        "edit_schedule",
        "edit_projects",
        "view_gantt"
      ]
    when "supervisor"
      [
        "view_supervisor_tasks",
        "view_gantt"
      ]
    when "builder"
      [
        "view_builder_tasks"
      ]
    else
      []
    end
  end

  # OAuth helper methods
  def self.from_omniauth(auth)
    existing_user = find_by(provider: auth.provider, uid: auth.uid)
    return existing_user if existing_user

    # Create new OAuth user
    user = create!(
      provider: auth.provider,
      uid: auth.uid,
      email: auth.info.email,
      name: auth.info.name,
      oauth_token: auth.credentials.token,
      oauth_expires_at: auth.credentials.expires_at ? Time.at(auth.credentials.expires_at) : nil,
      role: "user",  # Legacy column (still required by validation)
      password: SecureRandom.hex(32)
    )

    # SSoT: Assign default "user" role via user_roles join table
    default_role = Role.find_by(name: "user")
    user.roles << default_role if default_role && !user.roles.exists?(id: default_role.id)

    user
  end

  def oauth_user?
    provider.present? && uid.present?
  end

  # Multi-role helpers (SSoT: user_roles join table)
  def role_ids
    roles.pluck(:id)
  end

  def role_ids=(ids)
    # Handle multiple formats:
    # - Comma-separated string: "1,2,3" (from frontend inline editing)
    # - Array of IDs: [1, 2, 3]
    # - Array of objects with id property: [{id: 1}, {id: 2}] (from API)
    normalized_ids = if ids.is_a?(String)
                       ids.split(",").map(&:strip)
                     else
                       Array(ids).map do |item|
                         if item.is_a?(Hash)
                           item[:id] || item["id"]
                         else
                           item
                         end
                       end
                     end.compact.reject(&:blank?)

    new_roles = Role.where(id: normalized_ids)
    self.roles = new_roles
  end

  def role_names
    roles.pluck(:name)
  end

  # Check if user has a specific role (from user_roles table)
  def has_role?(role_name)
    roles.exists?(name: role_name.to_s)
  end

  # Primary role for backward compatibility (returns first role or legacy role column)
  def primary_role
    roles.first&.name || role
  end

  private

  # SSoT: Sync mobile_phone to linked contact
  def sync_mobile_to_contact
    return unless contact.present?
    return if contact.mobile_phone == mobile_phone  # No change needed

    # Use setter method (writes to contact_phones table, not removed column)
    contact.mobile_phone = mobile_phone
    contact.save
    Rails.logger.info "[User#sync_mobile_to_contact] Synced mobile_phone '#{mobile_phone}' to Contact##{contact.id}"
  rescue StandardError => e
    Rails.logger.error "[User#sync_mobile_to_contact] Failed to sync: #{e.message}"
  end

  def password_required?
    # Password is required for non-OAuth users or when explicitly setting password
    !oauth_user? && (new_record? || password.present?)
  end

  def password_complexity
    return if password.blank?

    # Check for at least one uppercase letter
    unless password.match?(/[A-Z]/)
      errors.add :password, "must contain at least one uppercase letter"
    end

    # Check for at least one lowercase letter
    unless password.match?(/[a-z]/)
      errors.add :password, "must contain at least one lowercase letter"
    end

    # Check for at least one digit
    unless password.match?(/\d/)
      errors.add :password, "must contain at least one number"
    end

    # Check for at least one special character
    unless password.match?(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
      errors.add :password, "must contain at least one special character"
    end
  end
end
