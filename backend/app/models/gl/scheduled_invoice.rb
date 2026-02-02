# frozen_string_literal: true

module Gl
  # Schedules invoices to be sent at a future date
  class ScheduledInvoice < ApplicationRecord
    self.table_name = "gl_scheduled_invoices"

    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
    belongs_to :invoice, class_name: "Gl::Invoice"
    belongs_to :created_by, class_name: "User", optional: true

    validates :scheduled_for, presence: true
    validates :invoice_id, presence: true
    validates :status, presence: true, inclusion: { in: %w[pending sent cancelled failed] }

    scope :pending, -> { where(status: "pending") }
    scope :due_now, -> { pending.where("scheduled_for <= ?", Time.current) }
    scope :upcoming, -> { pending.where("scheduled_for > ?", Time.current).order(:scheduled_for) }

    # Process all due scheduled invoices
    def self.process_due!
      due_now.find_each do |scheduled|
        scheduled.send_invoice!
      end
    end

    def send_invoice!
      return if status != "pending"

      transaction do
        # Update invoice status
        invoice.update!(status: "submitted", sent_at: Time.current)

        # Send email if configured
        if send_email?
          InvoiceMailer.send_invoice(invoice).deliver_later
        end

        update!(
          status: "sent",
          sent_at: Time.current
        )
      end
    rescue StandardError => e
      update!(
        status: "failed",
        error_message: e.message
      )
    end

    def cancel!
      update!(status: "cancelled", cancelled_at: Time.current)
    end

    def reschedule!(new_date)
      update!(scheduled_for: new_date, status: "pending")
    end
  end
end
