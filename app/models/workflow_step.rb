class WorkflowStep < ApplicationRecord
  # Associations
  belongs_to :workflow_instance
  belongs_to :assigned_to, polymorphic: true, optional: true

  # Validations
  validates :step_name, presence: true
  validates :status, presence: true, inclusion: { in: %w[pending in_progress completed rejected skipped] }

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :in_progress, -> { where(status: "in_progress") }
  scope :completed, -> { where(status: "completed") }

  # Callbacks
  after_create :assign_to_user_or_role
  after_update :check_workflow_advancement, if: :saved_change_to_status?

  def approve!(user:, comment: nil)
    transaction do
      update!(
        status: "completed",
        completed_at: Time.current,
        comment: comment
      )

      # Check if we should advance to next step
      workflow_instance.advance! || workflow_instance.complete!
    end
  end

  def reject!(user:, comment: nil)
    transaction do
      update!(
        status: "rejected",
        completed_at: Time.current,
        comment: comment
      )

      workflow_instance.reject!(reason: comment)
    end
  end

  def request_changes!(user:, comment: nil)
    update!(
      status: "in_progress",
      comment: comment
    )
  end

  def can_action?(user)
    return false unless status.in?(%w[pending in_progress])

    # Check if user has the right role or is assigned
    if assigned_to_type == "User"
      assigned_to_id == user.id
    elsif data.present? && data["assignee_type"] == "role"
      user.role == data["assignee_value"]
    else
      true # Allow any user if not specifically assigned
    end
  end

  private

  def assign_to_user_or_role
    return if data.blank? || assigned_to.present?

    # If assignee_type is user, find and assign
    if data["assignee_type"] == "user" && data["assignee_value"].present?
      user = User.find_by(id: data["assignee_value"])
      update_column(:assigned_to_id, user.id) if user
      update_column(:assigned_to_type, "User") if user
    end
  end

  def check_workflow_advancement
    return unless status == "completed"

    # If this was the last step, complete the workflow
    if workflow_instance.next_step_config.nil?
      workflow_instance.complete!
    end
  end
end
