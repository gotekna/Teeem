class JobTypeStatus < ApplicationRecord
  # Multi-tenancy: Scope all queries to current tenant (Tenant model is SSoT)
  acts_as_tenant :tenant

  belongs_to :job_type
  belongs_to :job_status

  # Uniqueness scoped by tenant_id (acts_as_tenant handles the scoping automatically)
  include ConfigSyncable
  self.sync_key_source = [:job_type_id, :job_status_id]
  validates :job_type_id, uniqueness: { scope: [:job_status_id, :tenant_id] }

  default_scope { order(:position) }
end
