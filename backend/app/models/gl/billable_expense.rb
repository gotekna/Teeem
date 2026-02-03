# frozen_string_literal: true

module Gl
  # Expense that can be billed to a client with markup
  class BillableExpense < ApplicationRecord
    self.table_name = "gl_billable_expenses"

    EXPENSE_TYPES = %w[travel materials equipment subcontractor meals accommodation other].freeze
    STATUSES = %w[pending approved billed paid written_off].freeze

    belongs_to :corporate, foreign_key: "company_id"
    belongs_to :job
    belongs_to :contact, optional: true
    belongs_to :user, optional: true
    belongs_to :source_invoice, class_name: "Gl::Invoice", optional: true
    belongs_to :billed_invoice, class_name: "Gl::Invoice", optional: true

    validates :expense_date, presence: true
    validates :expense_type, presence: true, inclusion: { in: EXPENSE_TYPES }
    validates :description, presence: true
    validates :cost_amount, presence: true, numericality: { greater_than: 0 }
    validates :status, inclusion: { in: STATUSES }

    before_save :calculate_billable_amount

    scope :pending, -> { where(status: "pending") }
    scope :approved, -> { where(status: "approved") }
    scope :unbilled, -> { where(status: %w[pending approved], billable: true) }
    scope :for_job, ->(job) { where(job_id: job.id) }

    # Approve expense for billing
    def approve!
      return false unless status == "pending"

      update!(status: "approved")
    end

    # Add to invoice
    def add_to_invoice!(invoice)
      return false unless status == "approved"

      invoice.lines.create!(
        description: "#{expense_type.titleize}: #{description}",
        quantity: 1,
        unit_price: billable_amount,
        amount: billable_amount,
        line_type: "expense"
      )

      update!(status: "billed", billed_invoice: invoice)
    end

    # Write off (make non-billable)
    def write_off!(reason = nil)
      update!(
        status: "written_off",
        billable: false,
        notes: [notes, "Written off: #{reason}"].compact.join("\n")
      )
    end

    # Profit on this expense
    def profit
      billable_amount - cost_amount
    end

    private

    def calculate_billable_amount
      return unless cost_amount.present?

      if markup_percent.to_d.positive?
        self.markup_amount = (cost_amount * markup_percent / 100).round(2)
      end

      self.billable_amount = cost_amount + (markup_amount || 0)
    end
  end
end
