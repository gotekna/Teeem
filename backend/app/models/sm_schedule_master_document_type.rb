# Join model linking SmScheduleMaster to DocumentType for GET task spawning
# When a task completes, spawns "GET - {DocumentType.display_name}" tasks
class SmScheduleMasterDocumentType < ApplicationRecord
  belongs_to :sm_schedule_master
  belongs_to :document_type

  validates :sm_schedule_master_id, uniqueness: { scope: :document_type_id }
  validates :lag_days, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true

  # Only job-scoped document types are valid for schedule master tasks
  validate :document_type_must_be_job_scoped

  private

  def document_type_must_be_job_scoped
    return if document_type.blank?
    unless %w[job both].include?(document_type.scope)
      errors.add(:document_type, "must have scope 'job' or 'both'")
    end
  end
end
