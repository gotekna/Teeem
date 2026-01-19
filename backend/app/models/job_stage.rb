class JobStage < ApplicationRecord
  # Multi-tenancy: Scope all queries to current tenant (Tenant model is SSoT)
  acts_as_tenant :tenant
  belongs_to :corporate_group, foreign_key: :company_group_id, optional: true  # Business grouping (not multi-tenancy)

  belongs_to :job_status, optional: true
  # Prevent deletion if jobs exist in this stage (data integrity)
  has_many :jobs, dependent: :restrict_with_error
  has_many :job_status_stages, dependent: :destroy
  has_many :job_statuses, through: :job_status_stages

  validates :name, presence: true, uniqueness: { scope: :company_group_id }

  default_scope { order(:position) }
  scope :active, -> { where(is_active: true) }
end
