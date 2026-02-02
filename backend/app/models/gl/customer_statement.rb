# frozen_string_literal: true

module Gl
  # Customer statement showing account activity
  class CustomerStatement < ApplicationRecord
    self.table_name = "gl_customer_statements"

    STATUSES = %w[generated sent viewed].freeze

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :contact
    belongs_to :generated_by, class_name: "User", optional: true

    has_many :lines, class_name: "Gl::CustomerStatementLine",
                     foreign_key: "statement_id", dependent: :destroy

    validates :reference, presence: true
    validates :statement_date, presence: true
    validates :status, inclusion: { in: STATUSES }

    before_create :generate_reference
    before_create :calculate_balances

    scope :for_contact, ->(contact) { where(contact_id: contact.id) }
    scope :recent, -> { order(statement_date: :desc) }

    # Generate statement for a contact
    def self.generate!(contact, as_of: Date.current, period_start: nil, user: nil)
      period_start ||= as_of.beginning_of_month

      statement = create!(
        corporate_company: contact.corporate_company,
        contact: contact,
        statement_date: as_of,
        period_start: period_start,
        period_end: as_of,
        generated_by: user
      )

      statement.populate_lines!
      statement.calculate_aging!
      statement
    end

    # Populate statement lines
    def populate_lines!
      # Get invoices
      invoices = Gl::Invoice.where(contact: contact, invoice_type: "sales")
                            .where("date <= ?", statement_date)
                            .where(status: %w[submitted approved paid])
                            .order(:date)

      running = opening_balance

      invoices.each do |inv|
        running += inv.total
        lines.create!(
          invoice: inv,
          transaction_date: inv.date,
          transaction_type: "invoice",
          reference: inv.reference,
          description: "Invoice #{inv.reference}",
          amount: inv.total,
          running_balance: running
        )
      end

      # Get payments
      payments = Gl::Payment.where(contact: contact)
                            .where("date <= ?", statement_date)
                            .order(:date)

      payments.each do |pmt|
        running -= pmt.amount
        lines.create!(
          payment: pmt,
          transaction_date: pmt.date,
          transaction_type: "payment",
          reference: pmt.reference,
          description: "Payment received",
          amount: -pmt.amount,
          running_balance: running
        )
      end

      update!(closing_balance: running)
    end

    # Calculate aging buckets
    def calculate_aging!
      today = statement_date
      outstanding = Gl::Invoice.where(contact: contact, invoice_type: "sales")
                               .where(status: %w[submitted approved])

      self.current_amount = outstanding.where("due_date >= ?", today).sum(:total)
      self.days_30 = outstanding.where("due_date < ? AND due_date >= ?", today, today - 30.days).sum(:total)
      self.days_60 = outstanding.where("due_date < ? AND due_date >= ?", today - 30.days, today - 60.days).sum(:total)
      self.days_90 = outstanding.where("due_date < ? AND due_date >= ?", today - 60.days, today - 90.days).sum(:total)
      self.days_90_plus = outstanding.where("due_date < ?", today - 90.days).sum(:total)

      save!
    end

    # Mark as sent
    def mark_sent!
      update!(status: "sent", sent_at: Time.current)
    end

    # Mark as viewed
    def mark_viewed!
      update!(status: "viewed", viewed_at: Time.current) unless status == "viewed"
    end

    # Total overdue
    def total_overdue
      days_30 + days_60 + days_90 + days_90_plus
    end

    private

    def generate_reference
      return if reference.present?

      year = Date.current.year.to_s[-2..]
      month = Date.current.strftime("%m")
      sequence = self.class.where(corporate_company_id: corporate_company_id)
                           .where("reference LIKE ?", "STMT#{year}#{month}%")
                           .count + 1

      self.reference = "STMT#{year}#{month}#{sequence.to_s.rjust(3, '0')}"
    end

    def calculate_balances
      # Calculate opening balance (outstanding as of period start)
      self.opening_balance = Gl::Invoice
                             .where(contact: contact, invoice_type: "sales")
                             .where("date < ?", period_start)
                             .where(status: %w[submitted approved paid])
                             .sum(:total) - Gl::Payment
                                            .where(contact: contact)
                                            .where("date < ?", period_start)
                                            .sum(:amount)

      # Calculate totals for period
      self.total_invoices = Gl::Invoice
                            .where(contact: contact, invoice_type: "sales")
                            .where(date: period_start..period_end)
                            .where(status: %w[submitted approved paid])
                            .sum(:total)

      self.total_payments = Gl::Payment
                            .where(contact: contact)
                            .where(date: period_start..period_end)
                            .sum(:amount)
    end
  end
end
