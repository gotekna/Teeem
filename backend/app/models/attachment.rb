# Links attachments stored in SharePoint to their source files
# Part of SSoT architecture - attachments are stored in SharePoint, tracked here
# Supports deduplication via content_hash - one file stored once, linked to multiple emails
class Attachment < ApplicationRecord
  belongs_to :organization_microsoft_app_credential
  has_many :email_attachments, dependent: :destroy
  has_many :email_warehouses, through: :email_attachments

  validates :sharepoint_file_id, presence: true
  validates :sharepoint_path, presence: true
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
    # Would need to construct from sharepoint_path and site URL
    # Can be added later if needed
    nil
  end

  # Provider-agnostic storage reference (SSoT: storage_item_id)
  # Falls back to sharepoint_file_id for backwards compatibility
  def storage_reference
    storage_item_id.presence || sharepoint_file_id
  end

  def set_storage_reference(item_id, provider: "sharepoint", path: nil)
    self.storage_item_id = item_id
  end
end
