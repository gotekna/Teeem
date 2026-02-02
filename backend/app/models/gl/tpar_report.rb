# frozen_string_literal: true

module Gl
  # TPAR (Taxable Payments Annual Report) for ATO
  class TparReport < ApplicationRecord
    self.table_name = "gl_tpar_reports"

    STATUSES = %w[draft review lodged amended].freeze

    # TPAR Industry codes for construction
    INDUSTRY_CODES = {
      "building" => "B",
      "cleaning" => "C",
      "courier" => "D",
      "road_freight" => "R",
      "it" => "I",
      "security" => "S"
    }.freeze

    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
    belongs_to :created_by, class_name: "User", optional: true

    has_many :payees, class_name: "Gl::TparPayee", foreign_key: "tpar_report_id", dependent: :destroy

    validates :financial_year, presence: true, uniqueness: { scope: :corporate_company_id }
    validates :period_start, presence: true
    validates :period_end, presence: true
    validates :status, inclusion: { in: STATUSES }

    scope :draft, -> { where(status: "draft") }
    scope :lodged, -> { where(status: "lodged") }

    # Generate TPAR report for a financial year
    def self.generate!(company, financial_year:, user: nil)
      # Parse financial year (e.g., "2024-25")
      year_start = financial_year.split("-").first.to_i
      period_start = Date.new(year_start, 7, 1)
      period_end = Date.new(year_start + 1, 6, 30)

      report = create!(
        corporate_company: company,
        financial_year: financial_year,
        period_start: period_start,
        period_end: period_end,
        created_by: user
      )

      report.populate_payees!
      report.calculate_totals!
      report
    end

    # Populate payees from contractor payments
    def populate_payees!
      # Find all contractors with TPAR payments
      payments = Gl::Invoice
                 .joins(:contact)
                 .where(corporate_company: corporate_company)
                 .where(invoice_type: "bill")
                 .where(status: "paid")
                 .where(date: period_start..period_end)
                 .where(contacts: { tpar_required: true })
                 .group(:contact_id)
                 .select(
                   "contact_id",
                   "SUM(total) as gross_paid",
                   "SUM(tax) as gst_paid"
                 )

      payments.each do |payment|
        contact = Contact.find(payment.contact_id)

        payees.create!(
          contact: contact,
          abn: contact.abn,
          payee_name: contact.name,
          address_line1: contact.address_line1,
          suburb: contact.suburb,
          state: contact.state,
          postcode: contact.postcode,
          gross_paid: payment.gross_paid,
          gst_paid: payment.gst_paid,
          no_abn_quoted: contact.abn.blank?
        )
      end
    end

    # Calculate totals
    def calculate_totals!
      update!(
        payee_count: payees.count,
        total_gross: payees.sum(:gross_paid),
        total_gst: payees.sum(:gst_paid),
        total_tax_withheld: payees.sum(:tax_withheld)
      )
    end

    # Submit for review
    def submit_for_review!
      return false unless status == "draft"

      update!(status: "review")
    end

    # Mark as lodged
    def mark_lodged!(reference = nil, response = nil)
      update!(
        status: "lodged",
        lodged_at: Time.current,
        lodgement_reference: reference,
        lodgement_response: response
      )
    end

    # Generate TPAR file for lodgement (ATO format)
    def generate_lodgement_file
      # TODO: Implement ATO TPAR file format
      # This would generate the file in the format required by ATO
      raise NotImplementedError, "TPAR file generation pending ATO integration"
    end

    # Financial year string helper
    def self.current_financial_year
      today = Date.current
      if today.month >= 7
        "#{today.year}-#{(today.year + 1).to_s[-2..]}"
      else
        "#{today.year - 1}-#{today.year.to_s[-2..]}"
      end
    end
  end
end
