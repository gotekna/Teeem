# frozen_string_literal: true

module Gl
  # Line item on a change order
  class ChangeOrderLine < ApplicationRecord
    self.table_name = "gl_change_order_lines"

    COST_TYPES = %w[labor material equipment subcontract other].freeze

    belongs_to :change_order, class_name: "Gl::ChangeOrder"

    validates :description, presence: true

    before_validation :calculate_amount

    scope :ordered, -> { order(:sort_order) }

    private

    def calculate_amount
      return unless quantity.present? && unit_price.present?

      self.amount = (quantity * unit_price).round(2)
    end
  end
end
