# frozen_string_literal: true

module Gl
  # Records individual approval/rejection actions
  class ApprovalAction < ApplicationRecord
    self.table_name = "gl_approval_actions"

    ACTIONS = %w[approved rejected delegated skipped cancelled].freeze

    belongs_to :approval_request, class_name: "Gl::ApprovalRequest"
    belongs_to :workflow_step, class_name: "Gl::ApprovalWorkflowStep", optional: true
    belongs_to :user, optional: true
    belongs_to :delegated_to, class_name: "User", optional: true

    validates :step_number, presence: true
    validates :action, presence: true, inclusion: { in: ACTIONS }
    validates :acted_at, presence: true

    scope :approvals, -> { where(action: "approved") }
    scope :rejections, -> { where(action: "rejected") }

    def action_label
      case action
      when "approved" then "Approved"
      when "rejected" then "Rejected"
      when "delegated" then "Delegated to #{delegated_to&.name}"
      when "skipped" then "Skipped"
      when "cancelled" then "Cancelled"
      end
    end
  end
end
