class JobContact < ApplicationRecord
  belongs_to :job
  belongs_to :contact

  validates :job_id, presence: true
  validates :contact_id, presence: true
  validates :contact_id, uniqueness: { scope: :job_id, message: "is already associated with this job" }

  # Ensure only one primary contact per job
  validates :primary, uniqueness: { scope: :job_id, message: "contact already exists for this job" }, if: :primary?

  # Scope for primary contact
  scope :primary, -> { where(primary: true) }
end
