# frozen_string_literal: true

# TrialInvitation - Tracks invitations sent to prospects for trial signup
#
# An invitation is created when a TEEEM staff member invites someone to try TEEEM.
# The invitation contains a secure token that links to the signup page.
#
# Status lifecycle:
# - pending: Invitation sent, awaiting acceptance
# - accepted: Recipient signed up and created a tenant
# - expired: Invitation expired (default 7 days)
# - cancelled: Invitation was manually cancelled
#
class TrialInvitation < ApplicationRecord
  STATUSES = %w[pending accepted expired cancelled].freeze

  # =============================================================================
  # Associations
  # =============================================================================
  belongs_to :invited_by, class_name: 'User', foreign_key: 'invited_by_user_id', optional: true
  belongs_to :sent_from, class_name: 'User', foreign_key: 'sent_from_user_id', optional: true
  belongs_to :tenant, optional: true

  # =============================================================================
  # Validations
  # =============================================================================
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true
  validates :company_name, presence: true
  validates :token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :expires_at, presence: true

  # =============================================================================
  # Callbacks
  # =============================================================================
  before_validation :generate_token, on: :create
  before_validation :set_expiration, on: :create

  # =============================================================================
  # Scopes
  # =============================================================================
  scope :pending, -> { where(status: 'pending') }
  scope :accepted, -> { where(status: 'accepted') }
  scope :expired_status, -> { where(status: 'expired') }
  scope :valid, -> { pending.where('expires_at > ?', Time.current) }
  scope :recently_sent, -> { where('created_at > ?', 30.days.ago) }

  # =============================================================================
  # Instance Methods
  # =============================================================================

  # Mark invitation as accepted when tenant is created
  def accept!(tenant)
    update!(
      status: 'accepted',
      accepted_at: Time.current,
      tenant_id: tenant.id
    )
  end

  # Check if invitation has passed its expiration date
  def expired?
    expires_at < Time.current
  end

  # Check if invitation can still be used
  def valid_for_use?
    status == 'pending' && !expired?
  end

  # Cancel the invitation
  def cancel!
    update!(status: 'cancelled')
  end

  # Extend expiration (e.g., when resending)
  def extend_expiration!(days: 7)
    update!(expires_at: days.days.from_now)
  end

  # Generate signup URL with invitation token
  def signup_url
    frontend_url = ENV['FRONTEND_URL'] || 'http://localhost:3000'
    "#{frontend_url}/get-started?invite=#{token}"
  end

  # Get the effective sender (who the email appears to come from)
  # Falls back to invited_by if sent_from not specified
  def effective_sender
    sent_from || invited_by
  end

  # Get the sender's display name for email FROM field
  def sender_name
    effective_sender&.name || 'TEEEM'
  end

  # Get the sender's email for email FROM field
  def sender_email
    effective_sender&.email || ENV['SMTP_USERNAME'] || 'hello@teeem.com.au'
  end

  private

  def generate_token
    self.token ||= SecureRandom.urlsafe_base64(32)
  end

  def set_expiration
    self.expires_at ||= 7.days.from_now
  end
end
