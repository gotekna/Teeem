# frozen_string_literal: true

module Gl
  # Individual steps in an approval workflow
  class ApprovalWorkflowStep < ApplicationRecord
    self.table_name = "gl_approval_workflow_steps"

    APPROVAL_TYPES = %w[user role any_of all_of].freeze

    belongs_to :workflow, class_name: "Gl::ApprovalWorkflow"
    belongs_to :approver, class_name: "User", optional: true

    validates :step_order, presence: true
    validates :approval_type, presence: true, inclusion: { in: APPROVAL_TYPES }

    validate :validate_approver_configuration

    default_scope { order(:step_order) }

    # Get all possible approvers for this step
    def approvers
      case approval_type
      when "user"
        [approver].compact
      when "role"
        # SSoT: Use user_roles join table to find users by role
        User.joins(:roles).where(roles: { name: required_role }).distinct
      when "any_of", "all_of"
        User.where(id: approver_ids_array)
      else
        []
      end
    end

    def approver_ids_array
      return [] if approver_ids.blank?

      JSON.parse(approver_ids)
    rescue JSON::ParserError
      []
    end

    def approver_ids_array=(ids)
      self.approver_ids = ids.to_json
    end

    # Check if a user can approve this step
    def can_approve?(user)
      case approval_type
      when "user"
        approver_id == user.id
      when "role"
        # SSoT: Check user_roles join table via has_role? helper
        user.has_role?(required_role)
      when "any_of", "all_of"
        approver_ids_array.include?(user.id)
      else
        false
      end
    end

    def step_description
      case approval_type
      when "user"
        approver&.name || "Specific user"
      when "role"
        "Any #{required_role.titleize}"
      when "any_of"
        "Any of #{approvers.count} users"
      when "all_of"
        "All of #{approvers.count} users"
      end
    end

    private

    def validate_approver_configuration
      case approval_type
      when "user"
        errors.add(:approver, "is required for user type") if approver_id.blank?
      when "role"
        errors.add(:required_role, "is required for role type") if required_role.blank?
      when "any_of", "all_of"
        errors.add(:approver_ids, "is required for #{approval_type} type") if approver_ids_array.empty?
      end
    end
  end
end
