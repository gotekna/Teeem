# frozen_string_literal: true

class TaskActionItem < ApplicationRecord
  # Item types
  ITEM_TYPES = %w[action question].freeze

  belongs_to :sm_task
  belongs_to :checked_by, class_name: 'User', optional: true
  belongs_to :responded_by, class_name: 'User', optional: true

  validates :text, presence: true
  validates :item_type, inclusion: { in: ITEM_TYPES }

  default_scope { order(:position) }

  # Scopes
  scope :actions, -> { where(item_type: 'action') }
  scope :questions, -> { where(item_type: 'question') }
  scope :answered, -> { where.not(response: [nil, '']) }
  scope :unanswered, -> { where(response: [nil, '']) }

  # Predicates
  def action?
    item_type == 'action'
  end

  def question?
    item_type == 'question'
  end

  def answered?
    question? && response.present?
  end

  # Toggle the checked state (for action items)
  def toggle!(user)
    return unless action?

    if checked
      update!(checked: false, checked_by: nil, checked_at: nil)
    else
      update!(checked: true, checked_by: user, checked_at: Time.current)
    end
  end

  # Answer the question (for question items)
  def answer!(response_text, user)
    return unless question?

    update!(
      response: response_text,
      responded_by: user,
      responded_at: Time.current
    )
  end
end
