class JobType < ApplicationRecord
  # Prevent deletion if jobs exist of this type (data integrity)
  has_many :jobs, dependent: :restrict_with_error
  has_many :job_type_statuses, dependent: :destroy
  has_many :statuses, through: :job_type_statuses, source: :job_status
  has_many :job_status_stages, dependent: :destroy
  has_many :claim_stage_templates, dependent: :destroy

  # Default schedule template for jobs of this type
  belongs_to :sm_schedule_master_template, optional: true

  validates :name, presence: true, uniqueness: true

  default_scope { order(:position) }
  scope :active, -> { where(is_active: true) }

  # Schedule template helpers

  # Check if this job type has a schedule template configured
  def has_schedule_template?
    sm_schedule_master_template_id.present?
  end

  # Summary for API responses
  # Note: SmScheduleMasterTemplate doesn't have versions (unlike old schedule_templates)
  def schedule_template_summary
    return nil unless sm_schedule_master_template.present?

    {
      template_id: sm_schedule_master_template.id,
      template_name: sm_schedule_master_template.name,
      row_count: sm_schedule_master_template.row_count
    }
  end
end
