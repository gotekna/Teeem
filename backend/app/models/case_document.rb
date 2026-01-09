# CaseDocument - links documents to cases
# This is a join table between cases and company_documents (SSoT)
class CaseDocument < ApplicationRecord
  belongs_to :case_record, foreign_key: :case_id, class_name: "CaseRecord"
  # Note: class_name needed because table was renamed from company_documents to corporate_company_documents
  belongs_to :company_document, class_name: "CorporateCompanyDocument"
  belongs_to :added_by, class_name: "User", optional: true

  validates :case_id, uniqueness: { scope: :company_document_id }
  validates :relevance, inclusion: {
    in: %w[key_evidence supporting background reference],
    allow_blank: true
  }
  validates :source_type, inclusion: {
    in: %w[source_folder email_attachment manual],
    allow_blank: true
  }
  validates :action_taken, inclusion: {
    in: %w[copy move linked replaced downloaded],
    allow_blank: true
  }

  scope :key_evidence, -> { where(relevance: "key_evidence") }
  scope :by_relevance, -> { order(Arel.sql("CASE relevance WHEN 'key_evidence' THEN 1 WHEN 'supporting' THEN 2 WHEN 'background' THEN 3 ELSE 4 END")) }
  scope :by_sequence, -> { order(:sequence) }
  scope :with_high_relevance, -> { where("relevance_score >= ?", 70) }
  scope :from_source_folder, -> { where(source_type: "source_folder") }
  scope :from_email, -> { where(source_type: "email_attachment") }
  scope :manual, -> { where(source_type: "manual") }

  RELEVANCE_TYPES = {
    "key_evidence" => "Key Evidence",
    "supporting" => "Supporting",
    "background" => "Background",
    "reference" => "Reference"
  }.freeze

  SOURCE_TYPES = {
    "source_folder" => "From Source Folder",
    "email_attachment" => "Email Attachment",
    "manual" => "Manually Added"
  }.freeze

  ACTION_TYPES = {
    "copy" => "Copied",
    "move" => "Moved",
    "linked" => "Linked (existing)",
    "replaced" => "Replaced",
    "downloaded" => "Downloaded"
  }.freeze

  # Callbacks
  before_create :generate_short_code, if: -> { short_code.blank? }

  def formatted_relevance
    RELEVANCE_TYPES[relevance] || relevance&.titleize
  end

  def formatted_source_type
    SOURCE_TYPES[source_type] || source_type&.titleize
  end

  def formatted_action_taken
    ACTION_TYPES[action_taken] || action_taken&.titleize
  end

  private

  def generate_short_code
    max_sequence = case_record.case_documents.where.not(short_code: nil)
                              .pluck(:short_code)
                              .map { |code| code.to_s.split("-").last.to_i }
                              .max || 0
    self.short_code = "DOC-#{(max_sequence + 1).to_s.rjust(3, '0')}"
  end
end
