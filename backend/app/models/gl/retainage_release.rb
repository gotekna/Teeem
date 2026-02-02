# frozen_string_literal: true

module Gl
  # Track retainage releases for construction projects
  class RetainageRelease < ApplicationRecord
    self.table_name = "gl_retainage_releases"

    RELEASE_TYPES = %w[partial final milestone].freeze
    STATUSES = %w[pending approved invoiced paid].freeze

    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
    belongs_to :job
    belongs_to :progress_claim, class_name: "Gl::ProgressClaim", optional: true
    belongs_to :invoice, class_name: "Gl::Invoice", optional: true
    belongs_to :approved_by, class_name: "User", optional: true

    validates :release_type, presence: true, inclusion: { in: RELEASE_TYPES }
    validates :release_date, presence: true
    validates :amount, presence: true, numericality: { greater_than: 0 }
    validates :status, inclusion: { in: STATUSES }

    before_create :calculate_remaining

    scope :pending, -> { where(status: "pending") }
    scope :approved, -> { where(status: "approved") }
    scope :for_job, ->(job) { where(job_id: job.id) }

    # Request release
    def self.request!(job:, amount:, release_type: "partial", conditions: nil)
      create!(
        corporate_company: job.corporate_company,
        job: job,
        release_type: release_type,
        release_date: Date.current,
        amount: amount,
        conditions: conditions
      )
    end

    # Approve release
    def approve!(approver)
      return false unless status == "pending"

      update!(
        status: "approved",
        approved_by: approver
      )
    end

    # Generate invoice for release
    def generate_invoice!
      return nil unless status == "approved"
      return invoice if invoice.present?

      new_invoice = Gl::Invoice.create!(
        corporate_company: corporate_company,
        contact: job.contact,
        job: job,
        invoice_type: "sales",
        date: Date.current,
        due_date: Date.current + 30.days,
        reference: "Retainage Release - #{job.name}",
        subtotal: amount,
        total: amount,
        status: "draft"
      )

      new_invoice.lines.create!(
        description: "Retainage release - #{release_type}",
        quantity: 1,
        unit_price: amount,
        amount: amount,
        line_type: "retainage"
      )

      update!(status: "invoiced", invoice: new_invoice)
      new_invoice
    end

    # Total retainage for job
    def self.total_released(job)
      for_job(job).where(status: %w[approved invoiced paid]).sum(:amount)
    end

    private

    def calculate_remaining
      total_held = job.gl_progress_claims.sum(:retainage_held)
      total_released = self.class.total_released(job)
      self.remaining_retainage = total_held - total_released - amount
    end
  end
end
