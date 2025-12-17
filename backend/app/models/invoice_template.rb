# frozen_string_literal: true

# InvoiceTemplate stores code-driven invoice layouts with JSONB sections.
# Each section defines a part of the invoice (header, line items, totals, etc.)
#
# Section Types:
#   - header: Company info, logo, invoice number, dates
#   - client: Client/recipient details
#   - job: Job reference information
#   - line_items: Invoice line items table
#   - totals: Subtotal, tax, total amounts
#   - payment: Bank details, payment instructions
#   - footer: Terms, notes, legal text
#   - custom: User-defined HTML content
#
# Section Structure:
#   {
#     type: "header",
#     visible: true,
#     order: 0,
#     content: { ... type-specific options ... }
#   }
#
class InvoiceTemplate < ApplicationRecord
  # Constants
  SECTION_TYPES = %w[header client job line_items totals payment footer custom].freeze
  PAPER_SIZES = %w[A4 Letter Legal].freeze
  ORIENTATIONS = %w[portrait landscape].freeze

  # Validations
  validates :name, presence: true
  validates :paper_size, inclusion: { in: PAPER_SIZES }
  validates :orientation, inclusion: { in: ORIENTATIONS }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :default_template, -> { where(is_default: true) }

  # Callbacks
  before_save :ensure_single_default

  # Get the default active template
  def self.default
    default_template.active.first || active.first
  end

  # Get sections as an array, sorted by order
  def section_list
    (sections || []).sort_by { |s| s["order"] || 0 }
  end

  # Get visible sections only
  def visible_sections
    section_list.select { |s| s["visible"] != false }
  end

  # Get a specific section by type
  def section(type)
    section_list.find { |s| s["type"] == type.to_s }
  end

  # Check if a section type is visible
  def section_visible?(type)
    sec = section(type)
    sec && sec["visible"] != false
  end

  # Generate output filename
  def generate_filename(invoice:, job: nil)
    pattern = output_naming_pattern.presence || "{invoice_number}_{date}"

    filename = pattern.dup
    filename.gsub!("{invoice_number}", invoice&.invoice_number.to_s.presence || "draft")
    filename.gsub!("{date}", Date.current.strftime("%Y%m%d"))
    filename.gsub!("{job_number}", job&.job_number.to_s)
    filename.gsub!("{reference}", invoice&.reference.to_s.parameterize)

    # Clean up
    filename.gsub!(/\{[^}]+\}/, "")
    filename.gsub!(/_+/, "_")
    filename.chomp!("_")

    "#{filename}.pdf"
  end

  # Get bank details hash
  def bank_details
    return nil if bank_name.blank? && bank_bsb.blank? && bank_account_number.blank?

    {
      bank_name: bank_name,
      bsb: bank_bsb,
      account_number: bank_account_number,
      account_name: bank_account_name
    }.compact
  end

  # Default section structure for a new template
  def self.default_sections
    [
      {
        type: "header",
        visible: true,
        order: 0,
        content: {
          show_logo: true,
          show_company_name: true,
          show_company_address: true,
          show_invoice_number: true,
          show_invoice_date: true,
          show_due_date: true,
          title: "TAX INVOICE"
        }
      },
      {
        type: "client",
        visible: true,
        order: 1,
        content: {
          label: "Bill To",
          show_company: true,
          show_name: true,
          show_address: true,
          show_email: false,
          show_phone: false
        }
      },
      {
        type: "job",
        visible: true,
        order: 2,
        content: {
          label: "Job Reference",
          show_job_number: true,
          show_job_name: true,
          show_job_address: true
        }
      },
      {
        type: "line_items",
        visible: true,
        order: 3,
        content: {
          columns: %w[description quantity unit_price amount],
          show_headers: true,
          alternate_rows: true
        }
      },
      {
        type: "totals",
        visible: true,
        order: 4,
        content: {
          show_subtotal: true,
          show_tax: true,
          show_total: true,
          tax_label: "GST (10%)",
          currency_symbol: "$"
        }
      },
      {
        type: "payment",
        visible: true,
        order: 5,
        content: {
          label: "Payment Details",
          show_bank_details: true,
          show_payment_terms: true,
          payment_instructions: "Please include invoice number as payment reference"
        }
      },
      {
        type: "footer",
        visible: true,
        order: 6,
        content: {
          show_terms: true,
          show_notes: true,
          show_footer_text: true
        }
      }
    ]
  end

  private

  def ensure_single_default
    return unless is_default_changed? && is_default?

    InvoiceTemplate.where.not(id: id).update_all(is_default: false)
  end
end
