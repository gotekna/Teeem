class DocumentDuplicateReview < ApplicationRecord
  # Associations
  belongs_to :case, class_name: "CaseRecord"
  belongs_to :existing_document, class_name: "CorporateCompanyDocument"
  belongs_to :new_document, class_name: "CorporateCompanyDocument", optional: true
  belongs_to :resolved_by, class_name: "User", optional: true

  # Validations
  validates :new_file_hash, presence: true
  validates :status, inclusion: { in: %w[pending resolved] }
  validates :resolution, inclusion: { in: %w[keep_existing replace keep_both] }, allow_blank: true

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :resolved, -> { where(status: "resolved") }
  scope :for_case, ->(case_id) { where(case_id: case_id) }

  # Instance methods

  # Resolve the duplicate by keeping the existing document
  def keep_existing!(user)
    transaction do
      # Just link the case to the existing document
      CaseDocument.find_or_create_by!(
        case_id: case_id,
        company_document_id: existing_document_id
      ) do |cd|
        cd.source_type = source_type
        cd.original_location = new_file_path
        cd.action_taken = "linked"
      end

      update!(
        status: "resolved",
        resolution: "keep_existing",
        resolved_by: user,
        resolved_at: Time.current
      )
    end
  end

  # Resolve the duplicate by replacing with the new document
  def replace!(user)
    transaction do
      # Move the new file to the existing document's location
      # Update the existing document with new file info
      existing_document.update!(
        content_hash: new_file_hash,
        file_size: new_file_size,
        last_modified_at: Time.current
      )

      # Link the case to the existing document
      CaseDocument.find_or_create_by!(
        case_id: case_id,
        company_document_id: existing_document_id
      ) do |cd|
        cd.source_type = source_type
        cd.original_location = new_file_path
        cd.action_taken = "replaced"
      end

      update!(
        status: "resolved",
        resolution: "replace",
        resolved_by: user,
        resolved_at: Time.current
      )
    end
  end

  # Resolve by keeping both documents
  def keep_both!(user, new_company_document)
    transaction do
      update!(
        status: "resolved",
        resolution: "keep_both",
        new_document: new_company_document,
        resolved_by: user,
        resolved_at: Time.current
      )

      # Link both to the case
      CaseDocument.find_or_create_by!(
        case_id: case_id,
        company_document_id: existing_document_id
      ) do |cd|
        cd.action_taken = "linked"
      end

      CaseDocument.find_or_create_by!(
        case_id: case_id,
        company_document_id: new_company_document.id
      ) do |cd|
        cd.source_type = source_type
        cd.original_location = new_file_path
        cd.action_taken = "copy"
      end
    end
  end
end
