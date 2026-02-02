# frozen_string_literal: true

module Gl
  # Milestone-based billing for projects
  class BillingMilestone < ApplicationRecord
    self.table_name = "gl_billing_milestones"

    STATUSES = %w[pending in_progress completed invoiced paid cancelled].freeze

    belongs_to :corporate, foreign_key: "company_id"
    belongs_to :job
    belongs_to :contact
    belongs_to :invoice, class_name: "Gl::Invoice", optional: true
    belongs_to :completed_by, class_name: "User", optional: true

    validates :name, presence: true
    validates :amount, presence: true, numericality: { greater_than: 0 }
    validates :status, presence: true, inclusion: { in: STATUSES }

    validate :percentage_totals_not_exceed_100, if: :is_percentage?

    before_save :calculate_amount_from_percentage, if: :is_percentage?
    after_save :auto_generate_invoice, if: :should_auto_invoice?

    scope :pending, -> { where(status: "pending") }
    scope :in_progress, -> { where(status: "in_progress") }
    scope :completed, -> { where(status: "completed") }
    scope :invoiced, -> { where(status: %w[invoiced paid]) }
    scope :billable, -> { where(status: "completed") }
    scope :for_job, ->(job_id) { where(job_id: job_id) }
    scope :overdue, -> { pending.where("target_date < ?", Date.current) }

    default_scope { order(:sort_order) }

    # Get all milestones for a job with summary
    def self.job_summary(job)
      milestones = for_job(job.id).unscope(:order)

      {
        total_milestones: milestones.count,
        completed: milestones.completed.count,
        invoiced: milestones.invoiced.count,
        pending: milestones.pending.count,
        total_value: milestones.sum(:amount),
        invoiced_value: milestones.invoiced.sum(:amount),
        pending_value: milestones.where(status: %w[pending in_progress completed]).sum(:amount),
        completion_pct: milestones.any? ? (milestones.completed.count.to_f / milestones.count * 100).round(1) : 0
      }
    end

    # Mark milestone as started
    def start!
      return false unless status == "pending"

      update!(status: "in_progress")
    end

    # Complete the milestone
    def complete!(user: nil, notes: nil)
      return false unless %w[pending in_progress].include?(status)

      update!(
        status: "completed",
        completed_date: Date.current,
        completed_by: user,
        completion_notes: notes
      )
    end

    # Generate invoice for this milestone
    def generate_invoice!
      return invoice if invoice.present?
      return nil unless status == "completed"

      gst_amount = (amount * 0.1).round(2)

      inv = Gl::Invoice.create!(
        corporate: corporate,
        contact: contact,
        invoice_type: "sales",
        status: "draft",
        date: Date.current,
        due_date: Date.current + 30.days,
        reference: "Milestone: #{name}",
        subtotal: amount,
        tax: gst_amount,
        total: amount + gst_amount,
        line_items_attributes: [{
          description: "#{job.name} - #{name}",
          quantity: 1,
          unit_price: amount,
          tax_type: "GST",
          account_code: "200"
        }]
      )

      update!(invoice: inv, status: "invoiced", invoiced_at: Time.current)
      inv
    end

    # Cancel milestone
    def cancel!
      return false if status == "invoiced" || status == "paid"

      update!(status: "cancelled")
    end

    # Deliverables as array
    def deliverables_array
      return [] if deliverables.blank?

      JSON.parse(deliverables)
    rescue JSON::ParserError
      deliverables.to_s.split("\n").map(&:strip).reject(&:blank?)
    end

    def deliverables_array=(items)
      self.deliverables = items.to_json
    end

    # Progress info
    def progress_status
      case status
      when "pending" then target_date && target_date < Date.current ? "overdue" : "upcoming"
      when "in_progress" then "active"
      when "completed" then "ready_to_invoice"
      when "invoiced" then "awaiting_payment"
      when "paid" then "complete"
      when "cancelled" then "cancelled"
      end
    end

    def days_until_target
      return nil unless target_date

      (target_date - Date.current).to_i
    end

    private

    def calculate_amount_from_percentage
      return unless is_percentage? && percentage_of_contract.present?

      contract_value = job.value || job.estimate_total || 0
      self.amount = (contract_value * percentage_of_contract / 100).round(2)
    end

    def percentage_totals_not_exceed_100
      return unless job_id && is_percentage?

      existing_pct = self.class.where(job_id: job_id, is_percentage: true)
                               .where.not(id: id)
                               .where.not(status: "cancelled")
                               .sum(:percentage_of_contract)

      total = existing_pct + (percentage_of_contract || 0)
      errors.add(:percentage_of_contract, "cannot exceed 100% (#{100 - existing_pct}% remaining)") if total > 100
    end

    def should_auto_invoice?
      auto_invoice? && saved_change_to_status? && status == "completed"
    end

    def auto_generate_invoice
      generate_invoice!
    end
  end
end
