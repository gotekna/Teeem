class JobStatus < ApplicationRecord
  self.table_name = 'job_status'

  belongs_to :job_type, optional: true
  has_many :jobs
  has_many :job_stages
  has_many :job_type_statuses, dependent: :destroy
  has_many :job_types, through: :job_type_statuses
  has_many :job_status_stages, dependent: :destroy
  has_many :stages, through: :job_status_stages, source: :job_stage

  validates :name, presence: true, uniqueness: { scope: :job_type_id }

  default_scope { order(:position) }
  scope :active, -> { where(is_active: true) }
end
