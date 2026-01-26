# frozen_string_literal: true

# EmailMigrationInvite - Token-based invite for client self-service migration
#
# Generates a secure token URL that clients can use to:
# 1. Review their migration details
# 2. Set up Stripe subscription
# 3. Confirm and start migration
#
# Pattern follows PaymentLink for consistency.
#
# Usage:
#   invite = EmailMigrationInvite.create!(
#     email_subscription: subscription,
#     contact: contact,
#     created_by: current_user,
#     total_monthly: 30.00,
#     mailboxes_data: [{ email: "user@example.com", type: "user", price: 15.00 }]
#   )
#   invite.portal_url # => "https://app.teeem.com/migrate/abc123..."
#
class EmailMigrationInvite < ApplicationRecord
  belongs_to :email_subscription
  belongs_to :contact
  belongs_to :created_by, class_name: "User", optional: true

  # Constants
  STATUSES = %w[pending payment_pending payment_complete migrating completed expired cancelled].freeze
  DEFAULT_EXPIRY_DAYS = 30

  # Validations
  validates :token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :active, -> { where(status: %w[pending payment_pending]) }
  scope :expired, -> { where("expires_at < ?", Time.current) }
  scope :not_expired, -> { where("expires_at >= ? OR expires_at IS NULL", Time.current) }
  scope :recent, -> { order(created_at: :desc) }

  # Callbacks
  before_validation :generate_token, on: :create
  before_validation :set_defaults, on: :create

  # Generate portal URL
  def portal_url
    base_url = ENV.fetch("FRONTEND_URL", "https://teeem.vercel.app")
    "#{base_url}/migrate/#{token}"
  end

  # Record view
  def record_view!
    update!(
      view_count: view_count + 1,
      viewed_at: Time.current
    )
  end

  # Status transitions
  def mark_payment_pending!
    update!(status: "payment_pending")
  end

  def mark_payment_complete!
    update!(
      status: "payment_complete",
      payment_completed_at: Time.current
    )
  end

  def start_migration!
    update!(
      status: "migrating",
      migration_started_at: Time.current
    )
  end

  def complete!
    update!(
      status: "completed",
      completed_at: Time.current
    )
  end

  def expire!
    update!(status: "expired")
  end

  def cancel!
    update!(status: "cancelled")
  end

  # Status helpers
  def expired?
    return false unless expires_at
    expires_at < Time.current || status == "expired"
  end

  def can_pay?
    status.in?(%w[pending payment_pending]) && !expired?
  end

  def payment_complete?
    status.in?(%w[payment_complete migrating completed])
  end

  def completed?
    status == "completed"
  end

  # Check expiry and update status if needed
  def check_expiry!
    expire! if expires_at && expires_at < Time.current && status.in?(%w[pending payment_pending])
  end

  private

  def generate_token
    self.token ||= SecureRandom.urlsafe_base64(32)
  end

  def set_defaults
    self.status ||= "pending"
    self.expires_at ||= DEFAULT_EXPIRY_DAYS.days.from_now
    self.view_count ||= 0
  end
end
