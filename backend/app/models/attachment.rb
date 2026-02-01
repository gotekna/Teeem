# Links attachments stored in cloud storage to their source files
# Part of SSoT architecture - attachments are stored in storage provider, tracked here
# Supports deduplication via content_hash - one file stored once, linked to multiple emails
class Attachment < ApplicationRecord
  belongs_to :organization_microsoft_app_credential
  # Note: email_attachments table DROPPED (Jan 2026) - all attachments now in WarehouseDocument (Ultra Design)
  # Use WarehouseDocument.where(source_type: 'email_attachment') to query email attachments

  validates :storage_file_id, presence: true
  validates :storage_path, presence: true
  validates :filename, presence: true
  validates :content_hash, presence: true, uniqueness: true

  # Scopes
  scope :for_org, ->(org) { where(organization_microsoft_app_credential: org) }
  scope :by_hash, ->(hash) { find_by(content_hash: hash) }

  # Calculate SHA256 hash from binary content
  def self.compute_hash(content)
    Digest::SHA256.hexdigest(content)
  end

  # Get web URL if available
  def web_url
    # Would need to construct from storage_path and site URL
    # Can be added later if needed
    nil
  end

  # Provider-agnostic storage reference (SSoT: storage_item_id)
  # Falls back to storage_file_id for backwards compatibility
  def storage_reference
    storage_item_id.presence || storage_file_id
  end

end
