# Join table linking email_warehouse to attachments (many-to-many)
# Part of SSoT architecture - attachments are stored in SharePoint, linked here
# One email can have many attachments, one attachment can link to many emails
class EmailAttachment < ApplicationRecord
  belongs_to :email_warehouse
  belongs_to :attachment, optional: true  # Optional during migration

  validates :email_warehouse_id, presence: true

  # Scopes
  scope :for_email, ->(email) { where(email_warehouse: email) }
  scope :for_attachment, ->(attachment) { where(attachment: attachment) }
  scope :migrated, -> { where.not(attachment_id: nil) }
  scope :pending_migration, -> { where(attachment_id: nil) }
end
