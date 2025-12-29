class JobStatus < ApplicationRecord
  # Table renamed from job_status to job_statuses (Rails convention)

  # Many-to-many relationship with JobType through job_type_statuses
  # Prevent deletion if jobs exist in this status (data integrity)
  has_many :jobs, dependent: :restrict_with_error
  has_many :job_stages, dependent: :restrict_with_error
  has_many :job_type_statuses, dependent: :destroy
  has_many :job_types, through: :job_type_statuses
  has_many :job_status_stages, dependent: :destroy
  has_many :stages, through: :job_status_stages, source: :job_stage

  validates :name, presence: true, uniqueness: true

  default_scope { order(:position) }
  scope :active, -> { where(is_active: true) }
end
