class JobTypeStatus < ApplicationRecord
  # Multi-tenancy: Scope all queries to current tenant (Tenant model is SSoT)
  acts_as_tenant :tenant
  belongs_to :corporate_group, foreign_key: :company_group_id, optional: true  # Business grouping (not multi-tenancy)

  belongs_to :job_type
  belongs_to :job_status

  validates :job_type_id, uniqueness: { scope: [:job_status_id, :company_group_id] }

  default_scope { order(:position) }
end
