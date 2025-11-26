class JobStage < ApplicationRecord
  has_many :jobs
  has_many :job_status_stages, dependent: :destroy
  has_many :job_statuses, through: :job_status_stages

  validates :name, presence: true, uniqueness: true

  default_scope { order(:position) }
  scope :active, -> { where(is_active: true) }
end
