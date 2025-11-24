# frozen_string_literal: true

# SmWorkingDrawingPage - AI-categorized document pages
#
# See GANTT_ARCHITECTURE_PLAN.md Section 2.7
#
class SmWorkingDrawingPage < ApplicationRecord
  belongs_to :task, class_name: 'SmTask'

  validates :page_number, presence: true, uniqueness: { scope: :task_id }
  validates :image_url, presence: true
  validates :category, presence: true, length: { maximum: 100 }
  validates :ai_confidence, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 1 }, allow_nil: true

  scope :for_task, ->(task_id) { where(task_id: task_id) }
  scope :by_category, ->(category) { where(category: category) }
  scope :overridden, -> { where(category_overridden: true) }
  scope :ordered, -> { order(:page_number) }

  def effective_category
    category_overridden? && manual_category.present? ? manual_category : category
  end

  def override_category!(new_category)
    update!(
      category_overridden: true,
      manual_category: new_category
    )
  end
end
