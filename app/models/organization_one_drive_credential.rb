class OrganizationOneDriveCredential < ApplicationRecord
  # Supports MULTIPLE Microsoft 365 tenants (Tekna, 100xBestLife, Homes of Hope, Love Your World)

  belongs_to :connected_by, class_name: "User", optional: true

  # Encrypt sensitive tokens
  encrypts :access_token
  encrypts :refresh_token

  # Validations
  validates :access_token, presence: true
  validates :refresh_token, presence: true
  validates :name, uniqueness: true, allow_nil: true
  # drive_id is optional on create, set when client initializes and gets drive info
  # validates :drive_id, presence: true

  # Scopes
  scope :active, -> { where(is_active: true) }

  # Multi-org support - returns all active credentials
  def self.active_credentials
    active.order(:name)
  end

  # Legacy singleton pattern - returns first active for backward compatibility
  def self.active_credential
    active.first
  end

  # Find by organization name
  def self.find_by_name(name)
    active.find_by(name: name)
  end

  # Check if any organization has OneDrive connected
  def self.connected?
    active.any? { |cred| cred.valid_credential? }
  end

  # Check if token is expired or about to expire (within 5 minutes)
  def token_expired?
    return true if token_expires_at.nil?
    token_expires_at <= 5.minutes.from_now
  end

  # Check if credential is valid and usable
  def valid_credential?
    access_token.present? && refresh_token.present? && !token_expired?
  end

  # Get the root folder path for all jobs
  def jobs_root_folder_path
    root_folder_path || "TEEEM Jobs"
  end

  # Get folder path for a specific construction/job
  def job_folder_path(construction)
    job_code = construction.id.to_s.rjust(3, "0")
    "#{jobs_root_folder_path}/#{job_code} - #{construction.title}"
  end

  # Deactivate this credential
  def deactivate!
    update!(is_active: false)
  end

  # Update last sync time
  def mark_synced!
    update!(last_synced_at: Time.current)
  end
end
