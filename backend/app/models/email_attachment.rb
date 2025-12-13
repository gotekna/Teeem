# Links email_warehouse records to their attachments
# Part of SSoT architecture - attachments are stored in SharePoint, linked here
# Can link to existing company_documents for deduplication
class EmailAttachment < ApplicationRecord
  belongs_to :email_warehouse
  belongs_to :attachment, optional: true  # Link to Attachment model (SharePoint-stored attachments)
  # NOTE: company_document association removed - column doesn't exist in database
  # If needed, add migration: add_reference :email_attachments, :company_document

  # Note: filename is optional when linking to an Attachment record (which has the filename)

  # Scopes
  scope :linked_to_document, -> { where(is_existing_doc: true) }
  scope :standalone, -> { where(is_existing_doc: false) }
  scope :synced_to_sharepoint, -> { where.not(sharepoint_file_id: nil) }
  scope :pending_sync, -> { where(sharepoint_file_id: nil) }

  # Check if this attachment matches an existing company document by content hash
  def find_matching_document
    return nil if content_hash.blank?

    CorporateCompanyDocument.find_by(content_hash: content_hash)
  end

  # Link this attachment to an existing company document (avoid storing twice)
  # NOTE: Disabled - company_document_id column doesn't exist in database
  # def link_to_document!(document)
  #   update!(
  #     company_document: document,
  #     is_existing_doc: true,
  #     sharepoint_file_id: document.sharepoint_file_id,
  #     sharepoint_path: document.sharepoint_path
  #   )
  # end

  # Calculate content hash from binary data
  def self.compute_hash(content)
    Digest::SHA256.hexdigest(content)
  end
end
