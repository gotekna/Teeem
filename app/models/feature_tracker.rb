class FeatureTracker < ApplicationRecord
  validates :chapter, presence: true
  validates :feature_name, presence: true
  validates :dev_progress, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true

  before_save :auto_complete_system

  scope :ordered, -> { order(:sort_order, :chapter, :feature_name) }
  scope :by_chapter, ->(chapter) { where(chapter: chapter) }
  scope :system_complete, -> { where(system_complete: true) }
  scope :dev_checked, -> { where(dev_checked: true) }
  scope :tester_checked, -> { where(tester_checked: true) }
  scope :ui_checked, -> { where(ui_checked: true) }
  scope :user_checked, -> { where(user_checked: true) }

  def self.chapters
    distinct.pluck(:chapter).sort
  end

  def completion_percentage
    total = 5
    completed = [system_complete, dev_checked, tester_checked, ui_checked, user_checked].count(true)
    (completed.to_f / total * 100).round
  end

  def fully_complete?
    system_complete && dev_checked && tester_checked && ui_checked && user_checked
  end

  private

  def auto_complete_system
    if dev_progress == 100
      self.system_complete = true
    end
  end
end
