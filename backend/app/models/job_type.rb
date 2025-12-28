class JobType < ApplicationRecord
  # Prevent deletion if jobs exist of this type (data integrity)
  has_many :jobs, dependent: :restrict_with_error
  has_many :job_type_statuses, dependent: :destroy
  has_many :statuses, through: :job_type_statuses, source: :job_status
  has_many :job_status_stages, dependent: :destroy
  has_many :claim_stage_templates, dependent: :destroy

  validates :name, presence: true, uniqueness: true

  default_scope { order(:position) }
  scope :active, -> { where(is_active: true) }
end
