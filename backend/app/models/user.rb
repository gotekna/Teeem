class User < ApplicationRecord
  has_secure_password validations: false  # Disable default validations to make password optional for OAuth

  has_many :grok_plans, dependent: :destroy
  has_many :chat_messages, dependent: :destroy
  has_many :schedule_template_row_audits, dependent: :nullify
  has_many :table_views, dependent: :destroy

  # Role constants
  ROLES = %w[user admin product_owner estimator supervisor builder].freeze

  # Group/team assignment options (matches ScheduleTemplateRow::ASSIGNABLE_ROLES)
  ASSIGNABLE_ROLES = %w[admin sales site supervisor builder estimator].freeze

  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true
  validates :password, length: { minimum: 8 }, if: :password_required?
  validate :password_complexity, if: :password_required?
  validates :role, inclusion: { in: ROLES }
  validates :assigned_role, inclusion: { in: ASSIGNABLE_ROLES }, allow_nil: true

  # Role helper methods
  def admin?
    role == 'admin'
  end

  def user?
    role == 'user'
  end

  def product_owner?
    role == 'product_owner'
  end

  def estimator?
    role == 'estimator'
  end

  def supervisor?
    role == 'supervisor'
  end

  def builder?
    role == 'builder'
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

  # Returns array of permission strings for this user
  def permissions
    perms = []

    # Base permissions for all users
    perms += ['view_dashboard', 'view_jobs', 'view_contacts']

    # Role-specific permissions
    case role
    when 'admin'
      # Admins get all permissions
      perms += [
        'manage_permissions',
        'manage_users',
        'manage_system',
        'create_templates',
        'edit_schedule',
        'view_supervisor_tasks',
        'view_builder_tasks',
        'edit_projects',
        'manage_workflows',
        'view_gantt',
        'manage_company_settings',
        'manage_integrations'
      ]
    when 'product_owner'
      perms += [
        'create_templates',
        'edit_schedule',
        'edit_projects',
        'view_gantt'
      ]
    when 'estimator'
      perms += [
        'edit_schedule',
        'edit_projects',
        'view_gantt'
      ]
    when 'supervisor'
      perms += [
        'view_supervisor_tasks',
        'view_gantt'
      ]
    when 'builder'
      perms += [
        'view_builder_tasks'
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
      user.role = 'user'  # Default role for new OAuth users
      user.password = SecureRandom.hex(32)  # Set random password for OAuth users
    end
  end

  def oauth_user?
    provider.present? && uid.present?
  end

  private

  def password_required?
    # Password is required for non-OAuth users or when explicitly setting password
    !oauth_user? && (new_record? || password.present?)
  end

  def password_complexity
    return if password.blank?

    # Check for at least one uppercase letter
    unless password.match?(/[A-Z]/)
      errors.add :password, 'must contain at least one uppercase letter'
    end

    # Check for at least one lowercase letter
    unless password.match?(/[a-z]/)
      errors.add :password, 'must contain at least one lowercase letter'
    end

    # Check for at least one digit
    unless password.match?(/\d/)
      errors.add :password, 'must contain at least one number'
    end

    # Check for at least one special character
    unless password.match?(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
      errors.add :password, 'must contain at least one special character'
    end
  end
end
