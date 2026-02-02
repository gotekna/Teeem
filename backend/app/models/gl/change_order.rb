# frozen_string_literal: true

module Gl
  # Change order for construction projects
  class ChangeOrder < ApplicationRecord
    self.table_name = "gl_change_orders"

    STATUSES = %w[draft submitted approved rejected void].freeze
    REASONS = %w[client_request design_change unforeseen_conditions code_compliance value_engineering other].freeze

    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
    belongs_to :job
    belongs_to :contact, optional: true
    belongs_to :requested_by, class_name: "User", optional: true
    belongs_to :approved_by, class_name: "User", optional: true

    has_many :lines, class_name: "Gl::ChangeOrderLine", foreign_key: "change_order_id", dependent: :destroy

    accepts_nested_attributes_for :lines, allow_destroy: true

    validates :change_order_number, presence: true, uniqueness: { scope: [:corporate_company_id, :job_id] }
    validates :title, presence: true
    validates :status, inclusion: { in: STATUSES }

    before_create :generate_number
    before_create :capture_original_values
    after_save :update_job_contract, if: :saved_change_to_status?

    scope :draft, -> { where(status: "draft") }
    scope :pending, -> { where(status: "submitted") }
    scope :approved, -> { where(status: "approved") }
    scope :for_job, ->(job) { where(job_id: job.id) }

    # Calculate totals from lines
    def calculate_totals!
      self.contract_amount_change = lines.sum(:amount)
      self.revised_contract_value = original_contract_value + contract_amount_change
      save!
    end

    # Submit for approval
    def submit!
      return false unless status == "draft"

      calculate_totals!
      update!(status: "submitted", submitted_at: Time.current)
    end

    # Approve the change order
    def approve!(approver)
      return false unless status == "submitted"

      update!(
        status: "approved",
        approved_by: approver,
        approved_at: Time.current
      )
    end

    # Client signature
    def sign!(signature)
      update!(
        client_signature: signature,
        client_signed_at: Time.current
      )
    end

    # Reject the change order
    def reject!(reason = nil)
      return false unless status == "submitted"

      update!(
        status: "rejected",
        rejected_at: Time.current,
        rejection_reason: reason
      )
    end

    # Void the change order
    def void!
      update!(status: "void")
    end

    # Net impact
    def profit_impact
      contract_amount_change - cost_change
    end

    private

    def generate_number
      return if change_order_number.present?

      max = self.class.where(corporate_company_id: corporate_company_id, job_id: job_id)
                .maximum(:change_order_number)
      num = max.to_s.scan(/\d+/).last.to_i + 1

      self.change_order_number = "CO-#{num.to_s.rjust(3, '0')}"
    end

    def capture_original_values
      self.original_contract_value = job.value || job.estimate_total || 0
      self.revised_contract_value = original_contract_value
    end

    def update_job_contract
      return unless status == "approved"

      # Update job contract value with approved change orders
      total_changes = job.gl_change_orders.approved.sum(:contract_amount_change)
      job.update!(approved_variations: total_changes)
    end
  end
end
