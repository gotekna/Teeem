class JobTypeStatus < ApplicationRecord
  belongs_to :job_type
  belongs_to :job_status

  validates :job_type_id, uniqueness: { scope: :job_status_id }

  default_scope { order(:position) }
end
