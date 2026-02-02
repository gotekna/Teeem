class User < ApplicationRecord
  acts_as_tenant :tenant  # Multi-tenancy: Auto-scope all User queries to current tenant
  has_secure_password validations: false  # Disable default validations to make password optional for OAuth

  belongs_to :user_group, optional: true
  # SSoT: Every User MUST have a Contact (User is auth ONLY, Contact is identity)
  # Contact stores all personal info: name, emails, phones, addresses
  # User.email is the login email, synced to Contact.contact_emails with label='login'
  belongs_to :contact  # REQUIRED - User must have a Contact (Jan 2026 consolidation)
  belongs_to :tenant, optional: true  # Multi-tenancy: User's assigned tenant (SSoT)
  belongs_to :corporate_group, optional: true  # DEPRECATED: Use tenant instead for multi-tenancy
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
  has_many :teeem_pdfs, dependent: :destroy

  # SSoT: Links to deduplicated file storage (Jan 2026)
  belongs_to :signature_blob, class_name: "StorageBlob", optional: true
  belongs_to :photo_blob, class_name: "StorageBlob", optional: true

  # ActiveStorage has_one_attached :signature/:photo was REMOVED (Jan 2026) - it violated SSoT.

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
  # FRC (Feb 2026): Changed from .connected to .refreshable_delegated for 24/7 availability
  def microsoft_token
    MicrosoftCredential.for_user(self).refreshable_delegated.first
  end

  # SSoT: Assignable roles come from Role model (see Role.for_select)
  # No hardcoded ASSIGNABLE_ROLES constant - database is the source of truth

  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true
  validates :password, length: { minimum: 8 }, if: :password_required?
  validate :password_complexity, if: :password_required?

  # SSoT: Sync User data to linked Contact when user is updated
  after_save :sync_mobile_to_contact, if: -> { saved_change_to_mobile_phone? && contact.present? }
  after_save :sync_email_to_contact, if: -> { saved_change_to_email? && contact.present? }
  after_save :sync_name_to_contact, if: -> { saved_change_to_name? && contact.present? }
  # Phase 3: Update Contact.is_user_cached flag when User is created/destroyed
  after_save :update_contact_user_flag, if: :contact_id
  after_destroy :clear_contact_user_flag

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

  # =============================================================================
  # Multi-Tenancy Methods
  # =============================================================================

  # Check if user is TEEEM staff (has god-mode access to all tenants)
  # TEEEM staff are identified by:
  # 1. Email ending with @teeem.com.au
  # 2. Having the 'super_admin' role
  def teeem_staff?
    email&.ends_with?("@teeem.com.au") || roles.exists?(name: "super_admin")
  end

  # Check if user can access a specific tenant
  def can_access_tenant?(tenant)
    return false unless tenant

    teeem_staff? || corporate_group_id == tenant.id
  end

  # Get all tenants this user can access
  def available_tenants
    if teeem_staff?
      CorporateGroup.all
    elsif corporate_group_id.present?
      CorporateGroup.where(id: corporate_group_id)
    else
      CorporateGroup.none
    end
  end

  # Get user initials from name (e.g., "Robert Harder" -> "RH")
  def initials
    return "" if name.blank?
    name.split.map { |n| n[0] }.join.upcase[0..2]
  end

  # ========================================
  # StorageBlob Signature/Photo Access (SSoT)
  # ========================================

  def has_signature?
    signature_blob_id.present?
  end

  def signature_url(expires_in: 3600)
    return nil unless signature_blob
    signature_blob.presigned_url(expires_in: expires_in)
  end

  def attach_signature(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    signature_blob&.decrement_reference! if signature_blob_id.present?
    self.signature_blob = blob
    blob.increment_reference!
  end

  # Get signature URL for PDF generation (base64 data URL for embedding)
  def signature_data_url
    return nil unless signature_blob
    content_type = signature_blob.content_type
    blob_data = signature_blob.download
    base64_data = Base64.strict_encode64(blob_data)
    "data:#{content_type};base64,#{base64_data}"
  end

  def has_photo?
    photo_blob_id.present?
  end

  def photo_url(expires_in: 3600)
    return nil unless photo_blob
    photo_blob.presigned_url(expires_in: expires_in)
  end

  def attach_photo(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    photo_blob&.decrement_reference! if photo_blob_id.present?
    self.photo_blob = blob
    blob.increment_reference!
  end

  # Check if user has complete QBCC credentials for certificate signing
  def can_sign_certificates?
    has_signature? && qbcc_licence_number.present? && qbcc_licence_class.present?
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
    # Note: OAuth tokens are NOT stored on User - use MicrosoftCredential instead
    user = create!(
      provider: auth.provider,
      uid: auth.uid,
      email: auth.info.email,
      name: auth.info.name,
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

  # =============================================================================
  # Primary Role & Role Settings Support
  # SSoT: Primary role determines default settings for users with multiple roles
  # =============================================================================

  # Get the user's primary role (the one marked as is_primary in user_roles)
  # Falls back to first role if no primary is set, or legacy role column
  def primary_role
    @primary_role ||= begin
      # First, try to find the role marked as primary
      primary_user_role = user_roles.find_by(is_primary: true)
      if primary_user_role
        primary_user_role.role
      else
        # Fallback to first role
        roles.first
      end
    end
  end

  # Get the name of the primary role
  def primary_role_name
    primary_role&.name || role
  end

  # Get the ID of the primary role
  def primary_role_id
    primary_role&.id
  end

  # Set the primary role by role_id
  def set_primary_role!(role_id)
    user_role = user_roles.find_by(role_id: role_id)
    return false unless user_role

    user_role.set_as_primary!
    @primary_role = nil # Clear memoization
    true
  end

  # Get settings from the primary role
  def role_settings
    primary_role&.settings || {}
  end

  # Get the default task view for this user (from primary role settings)
  # Returns: 'list', 'board', or 'gantt'
  def default_task_view
    role_settings.dig("default_task_view") || primary_role&.default_task_view || "board"
  end

  # Get the default theme for this user (from primary role settings)
  # Returns: 'light', 'dark', or 'system'
  def default_theme_from_role
    role_settings.dig("default_theme") || primary_role&.default_theme || "system"
  end

  # Check if sidebar should be collapsed by default (from primary role settings)
  def sidebar_collapsed_by_default?
    role_settings.dig("sidebar_collapsed") == true
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

  # SSoT: Sync login email to Contact.contact_emails (label='login')
  def sync_email_to_contact
    return unless contact.present?

    # Find or create login email in contact_emails table
    login_email = contact.contact_emails.find_by(label: 'login')

    if login_email
      # Update existing login email
      return if login_email.email == email  # No change needed
      login_email.update(email: email)
      Rails.logger.info "[User#sync_email_to_contact] Updated login email to '#{email}' for Contact##{contact.id}"
    else
      # Create new login email record
      contact.contact_emails.create!(
        email: email,
        label: 'login',
        is_primary: contact.contact_emails.empty?,  # Primary only if no other emails exist
        position: contact.contact_emails.maximum(:position).to_i + 1
      )
      Rails.logger.info "[User#sync_email_to_contact] Created login email '#{email}' for Contact##{contact.id}"
    end
  rescue StandardError => e
    Rails.logger.error "[User#sync_email_to_contact] Failed to sync: #{e.message}"
  end

  # SSoT: Sync name to Contact.display_name and first_name/last_name
  def sync_name_to_contact
    return unless contact.present?
    return if contact.display_name == name && !saved_change_to_name?

    # Parse name into first/last
    parts = name.to_s.strip.split(/\s+/)
    first_name = parts[0]
    last_name = parts.length > 1 ? parts[-1] : nil

    contact.update(
      display_name: name,
      first_name: first_name,
      last_name: last_name
    )
    Rails.logger.info "[User#sync_name_to_contact] Synced name '#{name}' to Contact##{contact.id}"
  rescue StandardError => e
    Rails.logger.error "[User#sync_name_to_contact] Failed to sync: #{e.message}"
  end

  # Phase 3: Update Contact.is_user_cached flag when User is saved
  def update_contact_user_flag
    return unless contact.present?
    return unless contact.respond_to?(:is_user_cached)

    # Set is_user_cached = true since this User is linked to the Contact
    contact.update_column(:is_user_cached, true) unless contact.is_user_cached?
    Rails.logger.info "[User#update_contact_user_flag] Set is_user_cached=true for Contact##{contact.id}"
  rescue StandardError => e
    Rails.logger.error "[User#update_contact_user_flag] Failed: #{e.message}"
  end

  # Phase 3: Clear Contact.is_user_cached flag when User is destroyed
  def clear_contact_user_flag
    return unless contact_id.present?

    contact_record = Contact.find_by(id: contact_id)
    return unless contact_record
    return unless contact_record.respond_to?(:is_user_cached)

    # Clear is_user_cached since no User is linked anymore
    contact_record.update_column(:is_user_cached, false)
    Rails.logger.info "[User#clear_contact_user_flag] Cleared is_user_cached for Contact##{contact_id}"
  rescue StandardError => e
    Rails.logger.error "[User#clear_contact_user_flag] Failed: #{e.message}"
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
