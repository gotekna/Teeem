class User < ApplicationRecord
  has_secure_password validations: false  # Disable default validations to make password optional for OAuth

  belongs_to :user_group, optional: true
  has_many :grok_plans, dependent: :destroy
  has_many :chat_messages, dependent: :destroy
  has_many :foundation_views, dependent: :destroy
  has_one :outlook_credential, class_name: "UserOutlookCredential", dependent: :destroy
  has_many :imap_credentials, dependent: :destroy
  has_many :email_rules, dependent: :destroy
  has_many :email_labels, dependent: :destroy
  has_many :email_templates, dependent: :destroy
  has_many :email_snoozes, dependent: :destroy
  has_many :email_user_states, dependent: :destroy
  has_many :vip_senders, dependent: :destroy
  has_many :email_warehouse, foreign_key: :synced_by_user_id, dependent: :nullify
  has_one :email_sync_status, dependent: :destroy
  has_one :microsoft_token, class_name: "UserMicrosoftToken", dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_many :user_navigation_configs, dependent: :destroy

  # Placeholder for company association (not yet implemented)
  # Returns nil - callers should handle this gracefully
  def company
    nil
  end

  # Role constants
  ROLES = %w[user admin product_owner estimator supervisor builder].freeze

  # Group/team assignment options (matches SmScheduleMaster::ASSIGNABLE_ROLES)
  ASSIGNABLE_ROLES = %w[admin sales site supervisor builder estimator].freeze

  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true
  validates :password, length: { minimum: 8 }, if: :password_required?
  validate :password_complexity, if: :password_required?
  validates :role, inclusion: { in: ROLES }
  validate :validate_assigned_roles

  # Role helper methods
  def admin?
    role == "admin"
  end

  def user?
    role == "user"
  end

  def product_owner?
    role == "product_owner"
  end

  def estimator?
    role == "estimator"
  end

  def supervisor?
    role == "supervisor"
  end

  def builder?
    role == "builder"
  end

  # SSoT: God View access (internal staff sees everything)
  # God View users see all entities in all groups they have access to
  def god_view?
    role.in?(%w[admin product_owner user estimator supervisor builder])
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
  def permissions
    perms = []

    # Base permissions for all users
    perms += [ "view_dashboard", "view_jobs", "view_contacts" ]

    # Role-specific permissions
    case role
    when "admin"
      # Admins get all permissions
      perms += [
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
        # SSoT Corporate permissions
        "god_view",
        "view_confidential_fields",
        "view_all_company_groups",
        "edit_company_group_memberships",
        "run_investigations",
        # Corporate & Case data permissions
        "view_corporate_data",
        "edit_corporate_data",
        "view_case_data",
        "edit_case_data"
      ]
    when "product_owner"
      perms += [
        "create_templates",
        "edit_schedule",
        "edit_projects",
        "view_gantt",
        # SSoT Corporate permissions
        "god_view",
        "view_all_company_groups",
        # Corporate & Case data permissions (view only)
        "view_corporate_data",
        "view_case_data"
      ]
    when "estimator"
      perms += [
        "edit_schedule",
        "edit_projects",
        "view_gantt"
      ]
    when "supervisor"
      perms += [
        "view_supervisor_tasks",
        "view_gantt"
      ]
    when "builder"
      perms += [
        "view_builder_tasks"
      ]
    end

    perms.uniq
  end

  # OAuth helper methods
  def self.from_omniauth(auth)
    where(provider: auth.provider, uid: auth.uid).first_or_create do |user|
      user.email = auth.info.email
      user.name = auth.info.name
      user.oauth_token = auth.credentials.token
      user.oauth_expires_at = Time.at(auth.credentials.expires_at) if auth.credentials.expires_at
      user.role = "user"  # Default role for new OAuth users
      user.password = SecureRandom.hex(32)  # Set random password for OAuth users
    end
  end

  def oauth_user?
    provider.present? && uid.present?
  end

  # Helper method to check if user has a specific assigned role
  def has_assigned_role?(role_name)
    assigned_roles&.include?(role_name.to_s)
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
