# frozen_string_literal: true

class TaskActionItem < ApplicationRecord
  # Item types
  ITEM_TYPES = %w[action question].freeze

  belongs_to :sm_task
  belongs_to :checked_by, class_name: 'User', optional: true
  belongs_to :responded_by, class_name: 'User', optional: true
  # Link to delegated sub-task (when question is sent to another user)
  belongs_to :delegated_task, class_name: 'SmTask', optional: true

  validates :text, presence: true
  validates :item_type, inclusion: { in: ITEM_TYPES }

  default_scope { order(:position) }

  # Scopes
  scope :actions, -> { where(item_type: 'action') }
  scope :questions, -> { where(item_type: 'question') }
  scope :answered, -> { where.not(response: [nil, '']) }
  scope :unanswered, -> { where(response: [nil, '']) }
  scope :delegated, -> { where.not(delegated_task_id: nil) }
  scope :not_delegated, -> { where(delegated_task_id: nil) }

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

  def delegated?
    delegated_task_id.present?
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

  # Delegate the question to another user by creating a sub-task
  # The sub-task will be assigned to the user, and when completed,
  # the answer and attachments will be copied back to this item
  def delegate_to!(user, created_by:)
    return { success: false, error: 'Only questions can be delegated' } unless question?
    return { success: false, error: 'Already delegated' } if delegated?

    parent_task = sm_task

    # Create a sub-task for the delegated question
    sub_task = SmTask.create!(
      name: "Question: #{text.truncate(100)}",
      description: "Please answer this question and attach any required documents.\n\nQuestion: #{text}",
      parent_task_id: parent_task.id,
      assigned_user_id: user.id,
      created_by: created_by,
      job_id: parent_task.job_id,
      # Minimal task fields
      task_number: 0, # Will be auto-set
      sequence_order: 9999,
      start_date: Date.current,
      end_date: Date.current,
      duration_days: 0,
      status: 'not_started',
      source_type: 'manual',
      is_delegated_question: true  # Flag to identify delegation sub-tasks
    )

    # Link the action item to the sub-task
    update!(delegated_task_id: sub_task.id)

    { success: true, task: sub_task }
  rescue => e
    { success: false, error: e.message }
  end

  # Called when the delegated sub-task is completed
  # Copies the answer and attachments back to the parent task
  def complete_delegation!(response_text, responded_by)
    return unless delegated?
    return unless delegated_task.present?

    # Copy response to this action item
    update!(
      response: response_text,
      responded_by: responded_by,
      responded_at: Time.current
    )

    # Copy attachments from sub-task to parent task
    if delegated_task.files.attached?
      delegated_task.files.each do |file|
        sm_task.files.attach(file.blob)
      end
    end
  end
end
