class JobStage < ApplicationRecord
  belongs_to :job_status, optional: true
  # Prevent deletion if jobs exist in this stage (data integrity)
  has_many :jobs, dependent: :restrict_with_error
  has_many :job_status_stages, dependent: :destroy
  has_many :job_statuses, through: :job_status_stages

  validates :name, presence: true, uniqueness: true

  default_scope { order(:position) }
  scope :active, -> { where(is_active: true) }
end
