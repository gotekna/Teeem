# frozen_string_literal: true

# Audit log of all AI-initiated actions
# Every action the assistant proposes (email draft, task creation, etc.)
# is logged here and requires user approval before execution
#
class AssistantAction < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :user, optional: true
  belongs_to :assistant_conversation, optional: true
  belongs_to :source, polymorphic: true, optional: true

  ACTION_TYPES = %w[
    draft_email send_email
    draft_sms send_sms
    create_task update_task
    search alert
    get_info
  ].freeze

  STATUSES = %w[pending approved rejected executed failed].freeze

  validates :action_type, inclusion: { in: ACTION_TYPES }
  validates :status, inclusion: { in: STATUSES }

  scope :pending, -> { where(status: "pending") }
  scope :for_user, ->(user) { where(user: user) }

  def approve!
    update!(status: "approved", approved_at: Time.current)
  end

  def reject!
    update!(status: "rejected")
  end

  def execute!(result = {})
    update!(status: "executed", executed_at: Time.current, result_data: result)
  end

  def fail!(error_message)
    update!(status: "failed", result_data: { error: error_message })
  end
end
