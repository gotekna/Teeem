class ImapCredential < ApplicationRecord
  belongs_to :user
  has_many :email_warehouse, dependent: :nullify
  has_many :email_rules, dependent: :destroy

  # Encrypt password at rest
  encrypts :encrypted_password

  validates :email_address, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :imap_host, presence: true
  validates :smtp_host, presence: true
  validates :username, presence: true
  validates :encrypted_password, presence: true
  validates :email_address, uniqueness: { scope: :user_id, message: "is already connected" }

  # Provider presets for common email providers
  PROVIDER_PRESETS = {
    "gmail" => {
      imap_host: "imap.gmail.com",
      imap_port: 993,
      imap_ssl: true,
      smtp_host: "smtp.gmail.com",
      smtp_port: 587,
      smtp_auth: "plain"
    },
    "outlook" => {
      imap_host: "outlook.office365.com",
      imap_port: 993,
      imap_ssl: true,
      smtp_host: "smtp.office365.com",
      smtp_port: 587,
      smtp_auth: "login"
    },
    "webcentral" => {
      imap_host: "mail.webcentral.com.au",
      imap_port: 993,
      imap_ssl: true,
      smtp_host: "mail.webcentral.com.au",
      smtp_port: 587,
      smtp_auth: "plain"
    }
  }.freeze

  # Alias for password getter/setter
  def password
    encrypted_password
  end

  def password=(value)
    self.encrypted_password = value
  end

  # Apply provider preset settings
  def apply_provider_preset!
    return unless provider.present? && PROVIDER_PRESETS.key?(provider)

    preset = PROVIDER_PRESETS[provider]
    self.imap_host = preset[:imap_host]
    self.imap_port = preset[:imap_port]
    self.imap_ssl = preset[:imap_ssl]
    self.smtp_host = preset[:smtp_host]
    self.smtp_port = preset[:smtp_port]
    self.smtp_auth = preset[:smtp_auth]
  end

  # Test IMAP connection
  def test_imap_connection
    require "net/imap"

    imap = Net::IMAP.new(imap_host, port: imap_port, ssl: imap_ssl)
    imap.login(username, password)
    imap.select("INBOX")
    message_count = imap.responses["EXISTS"].last || 0
    imap.logout
    imap.disconnect

    { success: true, message_count: message_count }
  rescue Net::IMAP::NoResponseError => e
    { success: false, error: "Authentication failed: #{e.message}" }
  rescue => e
    { success: false, error: e.message }
  end

  # Test SMTP connection
  def test_smtp_connection
    require "net/smtp"

    smtp = Net::SMTP.new(smtp_host, smtp_port)
    smtp.enable_starttls_auto if smtp_port == 587

    smtp.start("localhost", username, password, smtp_auth.to_sym) do |s|
      # Just test authentication, don't send anything
    end

    { success: true }
  rescue Net::SMTPAuthenticationError => e
    { success: false, error: "Authentication failed: #{e.message}" }
  rescue => e
    { success: false, error: e.message }
  end

  # Test both connections
  def test_connection
    imap_result = test_imap_connection
    return imap_result unless imap_result[:success]

    smtp_result = test_smtp_connection
    return smtp_result unless smtp_result[:success]

    {
      success: true,
      imap: imap_result,
      smtp: smtp_result
    }
  end

  # Mark sync as successful
  def mark_sync_success!
    update!(
      last_synced_at: Time.current,
      last_sync_status: "success",
      last_sync_error: nil
    )
  end

  # Mark sync as failed
  def mark_sync_error!(error_message)
    update!(
      last_synced_at: Time.current,
      last_sync_status: "error",
      last_sync_error: error_message
    )
  end

  # Check if sync is due
  def sync_due?
    return true if last_synced_at.nil?
    last_synced_at < sync_interval_minutes.minutes.ago
  end

  # Display name for UI
  def display_name
    name.presence || email_address
  end
end
