# frozen_string_literal: true

module Gl
  # Batch of time entries for invoicing
  class TimeBillingBatch < ApplicationRecord
    self.table_name = "gl_time_billing_batches"

    STATUSES = %w[draft approved invoiced].freeze

    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
    belongs_to :contact
    belongs_to :job, optional: true
    belongs_to :invoice, class_name: "Gl::Invoice", optional: true
    belongs_to :created_by, class_name: "User", optional: true

    has_many :time_entries, class_name: "Gl::BillableTimeEntry",
                            foreign_key: "time_billing_batch_id", dependent: :nullify

    validates :reference, presence: true, uniqueness: { scope: :corporate_company_id }
    validates :period_start, presence: true
    validates :period_end, presence: true
    validates :status, inclusion: { in: STATUSES }

    before_create :generate_reference

    scope :draft, -> { where(status: "draft") }
    scope :approved, -> { where(status: "approved") }
    scope :invoiced, -> { where(status: "invoiced") }
    scope :for_client, ->(contact) { where(contact_id: contact.id) }

    # Create a batch from approved time entries
    def self.create_batch!(company, contact:, period_start:, period_end:, job: nil, user: nil)
      entries = company.gl_billable_time_entries
                       .ready_to_bill
                       .for_period(period_start, period_end)

      entries = entries.where(job_id: job.id) if job
      entries = entries.joins(:job).where(jobs: { contact_id: contact.id }) unless job

      return nil if entries.empty?

      batch = create!(
        corporate_company: company,
        contact: contact,
        job: job,
        period_start: period_start,
        period_end: period_end,
        total_hours: entries.sum(:billable_hours),
        total_amount: entries.sum(:amount),
        created_by: user
      )

      # Associate entries with batch
      entries.update_all(time_billing_batch_id: batch.id)

      batch
    end

    # Approve the batch
    def approve!
      return false unless status == "draft"

      update!(status: "approved")
    end

    # Generate invoice from batch
    def generate_invoice!
      return nil unless status == "approved"
      return invoice if invoice.present?

      # Create invoice
      new_invoice = Gl::Invoice.create!(
        corporate_company: corporate_company,
        contact: contact,
        invoice_type: "sales",
        date: Date.current,
        due_date: Date.current + 30.days,
        reference: "Time: #{reference}",
        subtotal: total_amount,
        total: total_amount, # TODO: Add tax
        status: "draft"
      )

      # Create invoice line
      new_invoice.lines.create!(
        description: "Professional services #{period_start.strftime('%d/%m/%Y')} - #{period_end.strftime('%d/%m/%Y')}",
        quantity: total_hours,
        unit_price: (total_amount / total_hours).round(2),
        amount: total_amount,
        line_type: "service"
      )

      # Mark entries as billed
      time_entries.find_each do |entry|
        entry.mark_billed!(new_invoice)
      end

      update!(status: "invoiced", invoice: new_invoice)
      new_invoice
    end

    # Summary by task type
    def summary_by_task_type
      time_entries.group(:task_type).pluck(
        :task_type,
        Arel.sql("SUM(billable_hours)"),
        Arel.sql("SUM(amount)")
      ).map do |task_type, hours, amount|
        { task_type: task_type, hours: hours, amount: amount }
      end
    end

    # Summary by user
    def summary_by_user
      time_entries.includes(:user).group(:user_id).pluck(
        :user_id,
        Arel.sql("SUM(billable_hours)"),
        Arel.sql("SUM(amount)")
      ).map do |user_id, hours, amount|
        user = User.find(user_id)
        { user_id: user_id, user_name: user.name, hours: hours, amount: amount }
      end
    end

    private

    def generate_reference
      return if reference.present?

      year = Date.current.year.to_s[-2..]
      month = Date.current.strftime("%m")
      sequence = self.class.where(corporate_company_id: corporate_company_id)
                           .where("reference LIKE ?", "TB#{year}#{month}%")
                           .count + 1

      self.reference = "TB#{year}#{month}#{sequence.to_s.rjust(3, '0')}"
    end
  end
end
