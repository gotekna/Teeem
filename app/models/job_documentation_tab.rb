class JobDocumentationTab < ApplicationRecord
  belongs_to :job

  validates :name, presence: true, uniqueness: { scope: :job_id }
  validates :sequence_order, presence: true

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:sequence_order) }
end
