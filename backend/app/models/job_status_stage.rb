class JobStatusStage < ApplicationRecord
  belongs_to :job_type
  belongs_to :job_status
  belongs_to :job_stage

  validates :job_stage_id, uniqueness: { scope: [ :job_type_id, :job_status_id ] }

  default_scope { order(:position) }

  # Get next stage in sequence
  def next_stage
    JobStatusStage.where(
      job_type_id: job_type_id,
      job_status_id: job_status_id
    ).where("position > ?", position).first
  end

  # Get previous stage in sequence
  def previous_stage
    JobStatusStage.where(
      job_type_id: job_type_id,
      job_status_id: job_status_id
    ).where("position < ?", position).order(position: :desc).first
  end
end
