# frozen_string_literal: true

# ChatGuestSession - Shareable chat link for external users (no Teeem account needed)
#
# Usage:
#   session = ChatGuestSession.create_for_user!(user)
#   session.share_url  # => "https://teeem.vercel.app/guest/chat/abc123def456"
#   session.join!("Rachel", "rachel@example.com")
#
class ChatGuestSession < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :host_user, class_name: "User"
  belongs_to :job, optional: true
  has_many :chat_messages, dependent: :nullify

  validates :token, presence: true, uniqueness: true
  validates :status, inclusion: { in: %w[pending active expired closed] }

  before_validation :generate_token, on: :create

  scope :active_or_pending, -> { where(status: %w[pending active]).where("expires_at IS NULL OR expires_at > ?", Time.current) }

  # Create a guest session for a host user
  # Optional job_id links the session to a job (messages appear in Job > Coms)
  def self.create_for_user!(user, job_id: nil)
    create!(
      host_user: user,
      tenant_id: user.tenant_id,
      job_id: job_id,
      expires_at: 7.days.from_now
    )
  end

  # Find a valid session by token (no auth required - this IS the auth)
  def self.find_by_token!(token)
    session = find_by(token: token)
    raise ActiveRecord::RecordNotFound, "Invalid or expired chat link" unless session
    raise ActiveRecord::RecordNotFound, "Chat link has expired" if session.expired?
    raise ActiveRecord::RecordNotFound, "Chat link has been closed" if session.status == "closed"
    session
  end

  # Guest joins the session
  def join!(name, email = nil)
    update!(
      guest_name: name,
      guest_email: email,
      status: "active",
      guest_joined_at: Time.current
    )
  end

  def expired?
    expires_at.present? && expires_at < Time.current
  end

  def active?
    status.in?(%w[pending active]) && !expired?
  end

  # URL for sharing (frontend route)
  def share_url
    host = InfrastructureUrls.frontend_url
    "#{host}/guest/chat/#{token}"
  end

  private

  def generate_token
    self.token ||= SecureRandom.urlsafe_base64(24)
  end
end
