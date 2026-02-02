# frozen_string_literal: true

module Gl
  # Approval workflow templates
  class ApprovalWorkflow < ApplicationRecord
    self.table_name = "gl_approval_workflows"

    DOCUMENT_TYPES = %w[bill purchase_order invoice journal expense credit_note].freeze

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :created_by, class_name: "User", optional: true

    has_many :steps, class_name: "Gl::ApprovalWorkflowStep", foreign_key: "workflow_id", dependent: :destroy
    has_many :approval_requests, class_name: "Gl::ApprovalRequest", foreign_key: "workflow_id"

    accepts_nested_attributes_for :steps, allow_destroy: true

    validates :name, presence: true
    validates :document_type, presence: true, inclusion: { in: DOCUMENT_TYPES }

    scope :active, -> { where(active: true) }
    scope :for_type, ->(type) { where(document_type: type) }
    scope :by_priority, -> { order(priority: :desc) }

    # Find the matching workflow for a document
    def self.find_matching(company, document_type:, amount: nil, category: nil)
      workflows = active.for_type(document_type)
                        .where(corporate_company_id: company.id)
                        .by_priority

      workflows.find do |workflow|
        workflow.matches?(amount: amount, category: category)
      end
    end

    def matches?(amount: nil, category: nil)
      # Check amount range
      return false if min_amount.present? && amount.present? && amount < min_amount
      return false if max_amount.present? && amount.present? && amount > max_amount

      # Check category
      return false if self.category.present? && category.present? && self.category != category

      true
    end

    def total_steps
      steps.count
    end

    def required_approvers
      steps.flat_map(&:approvers).uniq
    end
  end
end
