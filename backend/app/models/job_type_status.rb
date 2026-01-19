class JobTypeStatus < ApplicationRecord
  include ActsAsTenant::ModelExtensions
  acts_as_tenant :company_group, class_name: "CorporateGroup"

  belongs_to :job_type
  belongs_to :job_status

  validates :job_type_id, uniqueness: { scope: [:job_status_id, :company_group_id] }

  default_scope { order(:position) }
end
