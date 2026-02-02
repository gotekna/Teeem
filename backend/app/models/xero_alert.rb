# frozen_string_literal: true

class XeroAlert < ApplicationRecord
  belongs_to :xero_credential, optional: true
  belongs_to :corporate, foreign_key: "company_id", optional: true
  belongs_to :dismissed_by, class_name: "User", optional: true

  # Alert types
  ALERT_TYPES = %w[
    token_expired
    disconnected
    sync_stale
    rate_limited
    inactivity_warning
    sync_failed
  ].freeze

  # Severity levels
  SEVERITIES = %w[info warning critical].freeze

  validates :alert_type, presence: true, inclusion: { in: ALERT_TYPES }
  validates :severity, presence: true, inclusion: { in: SEVERITIES }
  validates :title, presence: true

  # Scopes
  scope :active, -> { where(dismissed: false, auto_resolved: false) }
  scope :dismissed, -> { where(dismissed: true) }
  scope :auto_resolved, -> { where(auto_resolved: true) }
  scope :critical, -> { where(severity: "critical") }
  scope :warnings, -> { where(severity: "warning") }
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :for_credential, ->(credential_id) { where(xero_credential_id: credential_id) }
  scope :recent, -> { order(created_at: :desc) }

  # Dismiss this alert
  def dismiss!(user = nil)
    update!(
      dismissed: true,
      dismissed_at: Time.current,
      dismissed_by: user
    )
  end

  # Check if this alert is still active
  def active?
    !dismissed && !auto_resolved
  end

  # Get display color based on severity
  def severity_color
    case severity
    when "critical" then "red"
    when "warning" then "yellow"
    else "blue"
    end
  end

  # Get icon based on alert type
  def icon
    case alert_type
    when "disconnected" then "link-off"
    when "token_expired" then "clock"
    when "sync_stale" then "refresh-cw"
    when "rate_limited" then "alert-triangle"
    when "inactivity_warning" then "alert-circle"
    when "sync_failed" then "x-circle"
    else "info"
    end
  end

  # Create a disconnection alert
  def self.create_disconnected!(credential, message: nil)
    create!(
      xero_credential: credential,
      corporate: find_company_for_credential(credential),
      alert_type: "disconnected",
      severity: "critical",
      title: "Xero connection disconnected",
      message: message || "Your Xero connection to #{credential.tenant_name} has been disconnected. Please reconnect to continue syncing."
    )
  end

  # Create a token expired alert
  def self.create_token_expired!(credential, message: nil)
    create!(
      xero_credential: credential,
      corporate: find_company_for_credential(credential),
      alert_type: "token_expired",
      severity: "warning",
      title: "Xero connection issue",
      message: message || "There was a problem refreshing your Xero connection. We'll keep trying."
    )
  end

  # Create a sync stale alert
  def self.create_sync_stale!(credential, sync_type:, last_synced_at:)
    create!(
      xero_credential: credential,
      corporate: find_company_for_credential(credential),
      alert_type: "sync_stale",
      severity: "warning",
      title: "#{sync_type.humanize} sync is behind",
      message: "#{sync_type.humanize} haven't synced since #{last_synced_at&.strftime('%b %d, %Y %I:%M %p') || 'never'}. This may indicate a problem with the sync process."
    )
  end

  # Get count of active alerts by severity for a company
  def self.summary_for_company(company_id)
    active.for_company(company_id).group(:severity).count
  end

  # Check if there are any critical active alerts for a company
  def self.has_critical_for_company?(company_id)
    active.critical.for_company(company_id).exists?
  end

  private

  def self.find_company_for_credential(credential)
    return nil unless credential
    connection = CorporateXeroConnection.find_by(xero_credential: credential)
    connection&.corporate
  end
end
