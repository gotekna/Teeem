class Project < ApplicationRecord
  belongs_to :project_manager, class_name: 'User'
  belongs_to :construction
  has_many :project_tasks, dependent: :destroy
  has_many :chat_messages, dependent: :destroy
  has_many :purchase_orders, through: :construction

  validates :name, presence: true
  validates :project_code, presence: true, uniqueness: true
  validates :status, inclusion: { in: %w[planning active complete on_hold] }

  scope :active, -> { where(status: ['planning', 'active']) }
  scope :completed, -> { where(status: 'complete') }

  def total_tasks
    project_tasks.count
  end

  def completed_tasks
    project_tasks.where(status: 'complete').count
  end

  def progress_percentage
    return 0 if project_tasks.empty?

    Rails.cache.fetch("project:#{id}:progress", expires_in: 5.minutes) do
      (project_tasks.sum(:progress_percentage) / project_tasks.count.to_f).round
    end
  end

  def days_remaining
    return nil unless planned_end_date
    (planned_end_date - CompanySetting.today).to_i
  end

  def on_schedule?
    return true unless planned_end_date
    critical_path_end = project_tasks.where(is_critical_path: true)
                                     .maximum(:planned_end_date)
    critical_path_end.nil? || critical_path_end <= planned_end_date
  end

  def critical_path_tasks
    project_tasks.where(is_critical_path: true).order(:planned_start_date)
  end

  def overdue_tasks
    project_tasks.where('planned_end_date < ? AND status != ?', CompanySetting.today, 'complete')
  end

  def upcoming_tasks
    project_tasks.where('planned_start_date <= ? AND status = ?', 1.week.from_now, 'not_started')
  end
end
