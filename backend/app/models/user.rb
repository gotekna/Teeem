class User < ApplicationRecord
  has_secure_password validations: false  # Disable default validations to make password optional for OAuth

  belongs_to :user_group, optional: true
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
  has_many :vip_senders, dependent: :destroy
  has_many :email_warehouse, foreign_key: :synced_by_user_id, dependent: :nullify
  has_one :email_sync_status, dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_many :user_navigation_configs, dependent: :destroy
  has_many :task_followers, dependent: :destroy
  has_many :followed_tasks, through: :task_followers, source: :sm_task

  # Multi-role support (SSoT: user_roles join table)
  has_many :user_roles, dependent: :destroy
  has_many :roles, through: :user_roles

  # Placeholder for company association (not yet implemented)
  # Returns nil - callers should handle this gracefully
  def company
    nil
  end

  # SSoT: Get user's Microsoft credential (replaces has_one :microsoft_token)
  def microsoft_token
    MicrosoftCredential.for_user(self).delegated_credentials.connected.first
  end

  # Role constants
  ROLES = %w[user admin product_owner estimator supervisor builder].freeze

  # SSoT: Assignable roles for task/schedule assignment
  # Used by: SmScheduleMaster, SmTask, GanttCanvasView (via /api/v1/sm_settings/assignable_roles)
  ASSIGNABLE_ROLES = %w[admin sales site supervisor builder estimator].freeze

  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true
  validates :password, length: { minimum: 8 }, if: :password_required?
  validate :password_complexity, if: :password_required?
  validates :role, inclusion: { in: ROLES }
  validate :validate_assigned_roles

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

  # SSoT: God View access (internal staff sees everything)
  # God View users see all entities in all groups they have access to
  # SSoT: Check against user_roles join table, not legacy role column
  def god_view?
    (role_names & %w[admin product_owner user estimator supervisor builder]).any?
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

  # Helper method to check if user has a specific assigned role (for Schedule Master)
  def has_assigned_role?(role_name)
    assigned_roles&.include?(role_name.to_s)
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

    assigned_roles = Role.where(id: normalized_ids)
    self.roles = assigned_roles

    # Sync legacy 'role' column with primary role for backwards compatibility
    # This ensures the old single-role column stays in sync with the new multi-role system
    self.role = assigned_roles.first&.name
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

  def validate_assigned_roles
    return if assigned_roles.blank?

    unless assigned_roles.is_a?(Array)
      errors.add(:assigned_roles, "must be an array")
      return
    end

    invalid_roles = assigned_roles - ASSIGNABLE_ROLES
    if invalid_roles.any?
      errors.add(:assigned_roles, "contains invalid roles: #{invalid_roles.join(', ')}")
    end
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
