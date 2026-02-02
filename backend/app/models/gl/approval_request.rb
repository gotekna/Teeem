# frozen_string_literal: true

module Gl
  # Active approval request for a document
  class ApprovalRequest < ApplicationRecord
    self.table_name = "gl_approval_requests"

    STATUSES = %w[pending approved rejected cancelled].freeze

    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
    belongs_to :workflow, class_name: "Gl::ApprovalWorkflow", optional: true
    belongs_to :requested_by, class_name: "User", optional: true
    belongs_to :approvable, polymorphic: true

    has_many :actions, class_name: "Gl::ApprovalAction", foreign_key: "approval_request_id", dependent: :destroy

    validates :status, presence: true, inclusion: { in: STATUSES }

    scope :pending, -> { where(status: "pending") }
    scope :for_approver, ->(user) { pending.where(id: pending_for_user_ids(user)) }

    before_create :setup_workflow

    # Get pending requests for a user
    def self.pending_for_user_ids(user)
      # Find requests where user can approve the current step
      pending.select do |request|
        request.can_be_approved_by?(user)
      end.map(&:id)
    end

    # Submit document for approval
    def self.submit!(document, user:)
      company = document.corporate_company
      workflow = ApprovalWorkflow.find_matching(
        company,
        document_type: document.class.name.demodulize.underscore,
        amount: document.respond_to?(:total) ? document.total : nil
      )

      create!(
        corporate_company: company,
        workflow: workflow,
        requested_by: user,
        approvable: document,
        amount: document.respond_to?(:total) ? document.total : nil,
        status: "pending",
        submitted_at: Time.current,
        current_step: 1,
        total_steps: workflow&.total_steps || 1
      )
    end

    # Check if user can approve current step
    def can_be_approved_by?(user)
      return false unless status == "pending"

      current_workflow_step&.can_approve?(user)
    end

    # Approve the current step
    def approve!(user:, comments: nil)
      return false unless can_be_approved_by?(user)

      transaction do
        # Record the action
        actions.create!(
          workflow_step: current_workflow_step,
          user: user,
          step_number: current_step,
          action: "approved",
          comments: comments,
          acted_at: Time.current
        )

        # Move to next step or complete
        if current_step >= total_steps
          complete_approval!
        else
          increment!(:current_step)
        end
      end

      true
    end

    # Reject the request
    def reject!(user:, comments: nil)
      return false unless can_be_approved_by?(user)

      transaction do
        actions.create!(
          workflow_step: current_workflow_step,
          user: user,
          step_number: current_step,
          action: "rejected",
          comments: comments,
          acted_at: Time.current
        )

        update!(status: "rejected", completed_at: Time.current)

        # Update the document status
        approvable.update!(status: "rejected") if approvable.respond_to?(:status=)
      end

      true
    end

    # Cancel the approval request
    def cancel!(user: nil, reason: nil)
      transaction do
        actions.create!(
          user: user,
          step_number: current_step,
          action: "cancelled",
          comments: reason,
          acted_at: Time.current
        )

        update!(status: "cancelled", completed_at: Time.current)
      end
    end

    # Delegate to another user
    def delegate!(from_user:, to_user:, comments: nil)
      return false unless can_be_approved_by?(from_user)

      actions.create!(
        workflow_step: current_workflow_step,
        user: from_user,
        step_number: current_step,
        action: "delegated",
        comments: comments,
        delegated_to: to_user,
        acted_at: Time.current
      )
    end

    def current_workflow_step
      return nil unless workflow

      workflow.steps.find_by(step_order: current_step)
    end

    def pending_approvers
      current_workflow_step&.approvers || []
    end

    def approval_history
      actions.order(:acted_at).map do |action|
        {
          step: action.step_number,
          action: action.action,
          user: action.user&.name,
          comments: action.comments,
          acted_at: action.acted_at
        }
      end
    end

    private

    def setup_workflow
      self.total_steps = workflow&.total_steps || 1
      self.current_step = 1
    end

    def complete_approval!
      update!(status: "approved", completed_at: Time.current)

      # Update the document status
      if approvable.respond_to?(:approve!)
        approvable.approve!
      elsif approvable.respond_to?(:status=)
        approvable.update!(status: "approved")
      end
    end
  end
end
