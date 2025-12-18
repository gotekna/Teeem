# RENAMED: OneDriveCredential → SharePointCredential
# Alias kept for backwards compatibility
class SharePointCredential < ApplicationRecord
  self.table_name = "one_drive_credentials"  # Keep existing table

  belongs_to :job

  # Encrypt sensitive tokens
  encrypts :access_token
  encrypts :refresh_token

  validates :job_id, uniqueness: true

  # Check if token is expired or about to expire (within 5 minutes)
  def token_expired?
    return true if token_expires_at.nil?
    token_expires_at <= 5.minutes.from_now
  end

  # Check if credential is valid and usable
  def valid_credential?
    access_token.present? && refresh_token.present? && !token_expired?
  end

  # Get the folder path for this job
  def job_folder_path
    folder_path || construction&.title
  end
end
