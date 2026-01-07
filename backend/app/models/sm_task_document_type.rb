# Join model linking SmTask to DocumentType for GET task spawning
# When a task completes, spawns "GET - {DocumentType.display_name}" tasks
# Synced from SmScheduleMasterDocumentType when templates are applied to jobs
class SmTaskDocumentType < ApplicationRecord
  belongs_to :sm_task
  belongs_to :document_type

  validates :sm_task_id, uniqueness: { scope: :document_type_id }
  validates :lag_days, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
end
