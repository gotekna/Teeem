class PortalUser < ApplicationRecord
  has_secure_password

  # Associations
  belongs_to :contact
  has_many :portal_access_logs, dependent: :destroy
  has_one :subcontractor_account, dependent: :destroy
  has_many :quote_responses, foreign_key: :responded_by_portal_user_id, dependent: :nullify

  # Constants
  PORTAL_TYPES = %w[supplier customer].freeze
  MAX_FAILED_ATTEMPTS = 5
  LOCKOUT_DURATION = 30.minutes

  # Validations
  validates :email, presence: true,
                    uniqueness: true,
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :portal_type, presence: true, inclusion: { in: PORTAL_TYPES }
  validates :password, length: { minimum: 12 },
                       format: {
                         with: /\A(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+\z/,
                         message: "must include at least one lowercase letter, one uppercase letter, one digit, and one special character"
                       },
                       if: :password_digest_changed?
  validates :contact_id, uniqueness: { scope: :portal_type, message: "already has a portal account of this type" }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :inactive, -> { where(active: false) }
  scope :locked, -> { where('locked_until > ?', Time.current) }
  scope :suppliers, -> { where(portal_type: 'supplier') }
  scope :customers, -> { where(portal_type: 'customer') }
  scope :recent_login, -> { order(last_login_at: :desc) }

  # Instance methods
  def supplier?
    portal_type == 'supplier'
  end

  def customer?
    portal_type == 'customer'
  end

  def locked?
    locked_until.present? && locked_until > Time.current
  end

  def lock_account!
    update(
      locked_until: Time.current + LOCKOUT_DURATION,
      failed_login_attempts: MAX_FAILED_ATTEMPTS
    )
  end

  def unlock_account!
    update(
      locked_until: nil,
      failed_login_attempts: 0
    )
  end

  def record_failed_login!
    increment!(:failed_login_attempts)
    lock_account! if failed_login_attempts >= MAX_FAILED_ATTEMPTS
  end

  def record_successful_login!
    update(
      last_login_at: Time.current,
      failed_login_attempts: 0,
      locked_until: nil
    )
  end

  def generate_reset_token!
    self.reset_password_token = SecureRandom.urlsafe_base64
    self.reset_password_sent_at = Time.current
    save!
    reset_password_token
  end

  def reset_token_valid?
    reset_password_sent_at.present? &&
      reset_password_sent_at > 2.hours.ago
  end

  def clear_reset_token!
    update(
      reset_password_token: nil,
      reset_password_sent_at: nil
    )
  end

  def deactivate!
    update(active: false)
  end

  def activate!
    update(active: true)
  end

  # Subcontractor methods
  def subcontractor?
    supplier? && subcontractor_account.present?
  end

  def can_submit_quotes?
    subcontractor? && subcontractor_account.active?
  end

  def create_subcontractor_account!(invited_by: nil)
    return subcontractor_account if subcontractor_account.present?

    SubcontractorAccount.create!(
      portal_user: self,
      invited_by_contact: invited_by,
      account_tier: 'free'
    )
  end

  # Display name for logs/admin
  def display_name
    "#{contact.display_name} (#{portal_type.capitalize})"
  end
end
