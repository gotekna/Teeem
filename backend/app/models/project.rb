class Project < ApplicationRecord
  belongs_to :project_manager, class_name: "User"
  belongs_to :job
  has_many :chat_messages, dependent: :destroy
  has_many :purchase_orders, through: :construction

  validates :name, presence: true
  validates :project_code, presence: true, uniqueness: true
  validates :status, inclusion: { in: %w[planning active complete on_hold] }

  scope :active, -> { where(status: [ "planning", "active" ]) }
  scope :completed, -> { where(status: "complete") }

  # SSoT: All task methods now use SmTask via job
  def total_tasks
    job.sm_tasks.count
  end

  def completed_tasks
    job.sm_tasks.where(status: "completed").count
  end

  def progress_percentage
    return 0 if job.sm_tasks.empty?

    Rails.cache.fetch("project:#{id}:progress", expires_in: 5.minutes) do
      total = job.sm_tasks.count
      completed = job.sm_tasks.where(status: "completed").count
      ((completed.to_f / total) * 100).round
    end
  end

  def days_remaining
    return nil unless planned_end_date
    (planned_end_date - TenantSetting.today).to_i
  end

  def on_schedule?
    return true unless planned_end_date
    critical_path_end = job.sm_tasks.where(is_critical_path: true)
                                    .maximum(:end_date)
    critical_path_end.nil? || critical_path_end <= planned_end_date
  end

  def critical_path_tasks
    job.sm_tasks.where(is_critical_path: true).order(:start_date)
  end

  def overdue_tasks
    job.sm_tasks.where("end_date < ? AND status != ?", TenantSetting.today, "completed")
  end

  def upcoming_tasks
    job.sm_tasks.where("start_date <= ? AND status = ?", 1.week.from_now, "not_started")
  end
end
