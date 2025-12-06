class OrganizationOneDriveCredential < ApplicationRecord
  belongs_to :connected_by, class_name: "User", optional: true

  # Encrypt sensitive tokens
  encrypts :access_token
  encrypts :refresh_token

  # Validations
  validates :access_token, presence: true
  validates :refresh_token, presence: true
  # drive_id is optional on create, set when client initializes and gets drive info
  # validates :drive_id, presence: true

  # Scopes
  scope :active, -> { where(is_active: true) }

  # Get the active organization credential (singleton pattern)
  def self.active_credential
    active.first
  end

  # Check if organization has OneDrive connected
  def self.connected?
    active_credential.present? && active_credential.valid_credential?
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
