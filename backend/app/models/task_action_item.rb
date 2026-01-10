# frozen_string_literal: true

class TaskActionItem < ApplicationRecord
  # Item types - includes 'header' for grouping questions
  ITEM_TYPES = %w[action question header].freeze

  belongs_to :sm_task
  belongs_to :checked_by, class_name: 'User', optional: true
  belongs_to :responded_by, class_name: 'User', optional: true
  # Link to delegated sub-task (when question is sent to another user)
  belongs_to :delegated_task, class_name: 'SmTask', optional: true
  # Parent-child relationship for headers and sub-questions
  belongs_to :parent_item, class_name: 'TaskActionItem', optional: true
  has_many :child_items, class_name: 'TaskActionItem',
           foreign_key: :parent_item_id, dependent: :nullify

  validates :text, presence: true
  validates :item_type, inclusion: { in: ITEM_TYPES }

  default_scope { order(:position) }

  # Scopes
  scope :actions, -> { where(item_type: 'action') }
  scope :questions, -> { where(item_type: 'question') }
  scope :headers, -> { where(item_type: 'header') }
  scope :root_items, -> { where(parent_item_id: nil) }
  scope :children_of, ->(parent_id) { where(parent_item_id: parent_id) }
  scope :answered, -> { where.not(response: [nil, '']) }
  scope :unanswered, -> { where(response: [nil, '']) }
  scope :delegated, -> { where.not(delegated_task_id: nil) }
  scope :not_delegated, -> { where(delegated_task_id: nil) }
  scope :for_response, -> { questions.where(include_in_response: true) }

  # Predicates
  def action?
    item_type == 'action'
  end

  def question?
    item_type == 'question'
  end

  def header?
    item_type == 'header'
  end

  def has_children?
    child_items.exists?
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

    # Build rich description with context
    description_parts = []
    description_parts << "Please answer this question and attach any required documents."
    description_parts << ""
    description_parts << "**Question:** #{text}"
    description_parts << ""
    description_parts << "---"
    description_parts << "**Context:**"
    description_parts << "- From task: #{parent_task.name}"
    description_parts << "- Sent by: #{created_by.name}"

    if parent_task.job.present?
      description_parts << "- Job: #{parent_task.job.name}"
    end

    # Include link to original task if not private
    unless parent_task.is_private?
      description_parts << ""
      description_parts << "**Original Task ID:** ##{parent_task.id} (view for more context)"
    end

    # Create a sub-task for the delegated question
    sub_task = SmTask.create!(
      name: "Question: #{text.truncate(100)}",
      description: description_parts.join("\n"),
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

    # Notify the assignee about the delegated question
    notify_delegation_assignee(sub_task, user, created_by)

    { success: true, task: sub_task }
  rescue => e
    { success: false, error: e.message }
  end

  private

  def notify_delegation_assignee(sub_task, assignee, sender)
    job_context = sub_task.job.present? ? " for #{sub_task.job.name}" : ""

    Notification.create!(
      user: assignee,
      notifiable: sub_task,
      notification_type: "question_delegated",
      title: "Question from #{sender.name}",
      message: "#{sender.name} sent you a question#{job_context}: \"#{text.truncate(80)}\""
    )
  rescue StandardError => e
    Rails.logger.error("[TaskActionItem] Failed to create delegation notification: #{e.message}")
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

    # Notify the original sender that their question was answered
    notify_delegation_completed(responded_by)
  end

  def notify_delegation_completed(answered_by)
    # The original sender is the created_by of the delegated task
    original_sender = delegated_task.created_by
    return unless original_sender.present?
    # Don't notify if the same person answered their own question
    return if original_sender.id == answered_by&.id

    parent_task = sm_task
    job_context = parent_task.job.present? ? " (#{parent_task.job.name})" : ""

    Notification.create!(
      user: original_sender,
      notifiable: parent_task,
      notification_type: "question_answered",
      title: "Question answered by #{answered_by&.name || 'Unknown'}",
      message: "Your question \"#{text.truncate(60)}\" was answered#{job_context}"
    )
  rescue StandardError => e
    Rails.logger.error("[TaskActionItem] Failed to create completion notification: #{e.message}")
  end
end
