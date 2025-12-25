# frozen_string_literal: true

module Gl
  class InvoiceLine < ApplicationRecord
    self.table_name = 'gl_invoice_lines'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :gl_invoice, class_name: 'Gl::Invoice'
    belongs_to :gl_account, class_name: 'Gl::Account', optional: true
    belongs_to :gl_tax_rate, class_name: 'Gl::TaxRate', optional: true
    belongs_to :job, optional: true

    # Delegate corporate company from invoice
    delegate :corporate_company, to: :gl_invoice

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :line_number, presence: true, numericality: { greater_than: 0 }
    validates :quantity, numericality: true
    validates :unit_price, numericality: true
    validates :line_amount, numericality: true
    validates :tax_amount, numericality: true

    # ═══════════════════════════════════════════════════════════════
    # CALLBACKS
    # ═══════════════════════════════════════════════════════════════
    before_validation :set_line_number, on: :create
    before_save :calculate_amounts
    after_save :update_invoice_totals
    after_destroy :update_invoice_totals

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :ordered, -> { order(:line_number) }
    scope :with_account, -> { where.not(gl_account_id: nil) }
    scope :for_job, ->(job_id) { where(job_id: job_id) }

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS
    # ═══════════════════════════════════════════════════════════════

    # Calculate line amount from quantity, price, and discount
    def calculate_amounts
      # Line amount = quantity * unit_price - discount
      self.line_amount = (quantity.to_d * unit_price.to_d) - discount_amount.to_d

      # Apply percentage discount if specified
      if discount_rate.to_d > 0 && discount_amount.to_d == 0
        discount = (quantity.to_d * unit_price.to_d) * (discount_rate.to_d / 100)
        self.discount_amount = discount
        self.line_amount = (quantity.to_d * unit_price.to_d) - discount
      end

      # Calculate tax
      if gl_tax_rate.present?
        self.tax_amount = line_amount * (gl_tax_rate.rate / 100)
        self.tax_type = gl_tax_rate.code
      elsif tax_type.present? && tax_amount.to_d == 0
        # Default GST calculation if tax_type specified but no rate
        self.tax_amount = line_amount * 0.10 if tax_type == 'GST'
      end
    end

    # Total including tax
    def total
      line_amount + tax_amount
    end

    # Display description
    def display_description
      if item_code.present?
        "#{item_code} - #{description}"
      else
        description
      end
    end

    private

    def set_line_number
      return if line_number.present?

      max_line = gl_invoice.lines.maximum(:line_number) || 0
      self.line_number = max_line + 1
    end

    def update_invoice_totals
      gl_invoice.recalculate_totals! if gl_invoice.present?
    end
  end
end
