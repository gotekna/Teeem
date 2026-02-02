# frozen_string_literal: true

module Gl
  # Sales quote for customers
  class Quote < ApplicationRecord
    self.table_name = "gl_quotes"

    STATUSES = %w[draft sent viewed accepted rejected expired converted].freeze
    DISCOUNT_TYPES = %w[percent amount].freeze

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :contact
    belongs_to :job, optional: true
    belongs_to :created_by, class_name: "User", optional: true
    belongs_to :invoice, class_name: "Gl::Invoice", optional: true

    has_many :lines, class_name: "Gl::QuoteLine", foreign_key: "quote_id", dependent: :destroy
    has_many :versions, class_name: "Gl::QuoteVersion", foreign_key: "quote_id", dependent: :destroy

    accepts_nested_attributes_for :lines, allow_destroy: true

    validates :quote_number, presence: true, uniqueness: { scope: :corporate_company_id }
    validates :quote_date, presence: true
    validates :status, inclusion: { in: STATUSES }

    before_create :generate_quote_number
    after_save :calculate_totals, if: :should_calculate_totals?

    scope :draft, -> { where(status: "draft") }
    scope :sent, -> { where(status: "sent") }
    scope :accepted, -> { where(status: "accepted") }
    scope :pending, -> { where(status: %w[sent viewed]) }
    scope :active, -> { where(status: %w[draft sent viewed]) }
    scope :expired, -> { where(status: "expired") }
    scope :not_expired, -> { where.not(status: "expired") }

    # Send the quote
    def send_to_customer!
      return false unless status == "draft"

      update!(status: "sent", sent_at: Time.current)
      create_version!("Sent to customer")
    end

    # Mark as viewed
    def mark_viewed!
      return if %w[accepted rejected converted].include?(status)

      update!(status: "viewed", viewed_at: Time.current) if status == "sent"
    end

    # Accept the quote
    def accept!(signature: nil, ip: nil)
      return false unless %w[sent viewed].include?(status)

      update!(
        status: "accepted",
        accepted_at: Time.current,
        customer_signature: signature,
        signature_date: Time.current,
        signature_ip: ip
      )
    end

    # Reject the quote
    def reject!(reason = nil)
      return false unless %w[sent viewed].include?(status)

      update!(
        status: "rejected",
        rejected_at: Time.current,
        rejection_reason: reason
      )
    end

    # Convert to invoice
    def convert_to_invoice!
      return nil unless status == "accepted"
      return invoice if invoice.present?

      new_invoice = Gl::Invoice.create!(
        corporate_company: corporate_company,
        contact: contact,
        job: job,
        invoice_type: "sales",
        date: Date.current,
        due_date: Date.current + 30.days,
        reference: "Quote: #{quote_number}",
        subtotal: subtotal,
        tax: tax,
        total: total,
        status: "draft"
      )

      # Copy selected lines
      lines.where(selected: true).order(:sort_order).each do |line|
        new_invoice.lines.create!(
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          amount: line.amount,
          line_type: line.line_type
        )
      end

      update!(status: "converted", converted_at: Time.current, invoice: new_invoice)
      new_invoice
    end

    # Check and mark expired quotes
    def self.mark_expired!
      where(status: %w[draft sent viewed])
        .where("expiry_date < ?", Date.current)
        .update_all(status: "expired")
    end

    # Duplicate quote
    def duplicate!
      new_quote = dup
      new_quote.quote_number = nil
      new_quote.status = "draft"
      new_quote.sent_at = nil
      new_quote.viewed_at = nil
      new_quote.accepted_at = nil
      new_quote.rejected_at = nil
      new_quote.converted_at = nil
      new_quote.invoice = nil
      new_quote.quote_date = Date.current
      new_quote.expiry_date = Date.current + 30.days if expiry_date
      new_quote.save!

      lines.each do |line|
        new_line = line.dup
        new_line.quote = new_quote
        new_line.save!
      end

      new_quote
    end

    # Create version snapshot
    def create_version!(summary = nil)
      version_num = versions.maximum(:version_number).to_i + 1
      versions.create!(
        version_number: version_num,
        total: total,
        changes_summary: summary,
        snapshot: as_json(include: :lines),
        created_by: created_by
      )
    end

    # Calculate totals from lines
    def calculate_totals
      selected_lines = lines.where(selected: true)

      self.subtotal = selected_lines.sum(:amount)

      # Apply document-level discount
      if discount.to_d.positive?
        if discount_type == "percent"
          self.subtotal -= (subtotal * discount / 100).round(2)
        else
          self.subtotal -= discount
        end
      end

      self.tax = selected_lines.sum do |line|
        (line.amount * (line.tax_rate || 0) / 100).round(2)
      end

      self.total = subtotal + tax
    end

    # Win rate for company
    def self.win_rate(company)
      total = where(corporate_company: company).where.not(status: "draft").count
      return 0 if total.zero?

      won = where(corporate_company: company, status: %w[accepted converted]).count
      (won.to_f / total * 100).round(1)
    end

    private

    def generate_quote_number
      return if quote_number.present?

      year = Date.current.year.to_s[-2..]
      sequence = self.class.where(corporate_company_id: corporate_company_id)
                           .where("quote_number LIKE ?", "Q#{year}%")
                           .count + 1

      self.quote_number = "Q#{year}#{sequence.to_s.rjust(4, '0')}"
    end

    def should_calculate_totals?
      saved_change_to_discount? || saved_change_to_discount_type?
    end
  end
end
