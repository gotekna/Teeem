# frozen_string_literal: true

module Gl
  # Line item on a sales quote
  class QuoteLine < ApplicationRecord
    self.table_name = "gl_quote_lines"

    LINE_TYPES = %w[item service subtotal discount].freeze

    belongs_to :quote, class_name: "Gl::Quote"
    belongs_to :pricebook_item, class_name: "Pricebook", optional: true

    validates :description, presence: true
    validates :unit_price, presence: true
    validates :amount, presence: true
    validates :line_type, inclusion: { in: LINE_TYPES }

    before_validation :calculate_amount

    scope :selected, -> { where(selected: true) }
    scope :optional, -> { where(optional: true) }
    scope :required, -> { where(optional: false) }
    scope :ordered, -> { order(:sort_order) }

    # Create from pricebook item
    def self.from_pricebook(item, quantity: 1)
      new(
        pricebook_item: item,
        code: item.item_code,
        description: item.item_name,
        quantity: quantity,
        unit_of_measure: item.unit_of_measure,
        unit_price: item.current_price || 0
      )
    end

    # Toggle selection for optional items
    def toggle_selection!
      return false unless optional?

      update!(selected: !selected)
      quote.calculate_totals
      quote.save!
      selected
    end

    private

    def calculate_amount
      return unless quantity.present? && unit_price.present?

      line_total = quantity * unit_price

      if discount_percent.to_d.positive?
        line_total -= (line_total * discount_percent / 100)
      end

      self.amount = line_total.round(2)
    end
  end
end
