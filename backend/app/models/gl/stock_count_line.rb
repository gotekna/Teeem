# frozen_string_literal: true

module Gl
  # Individual line items in a stock count
  class StockCountLine < ApplicationRecord
    self.table_name = "gl_stock_count_lines"

    belongs_to :stock_count, class_name: "Gl::StockCount"
    belongs_to :inventory_item, class_name: "Gl::InventoryItem"

    validates :inventory_item_id, uniqueness: { scope: :stock_count_id }

    before_save :calculate_variance

    def calculate_variance!
      calculate_variance
      save!
    end

    private

    def calculate_variance
      return unless counted_quantity.present? && system_quantity.present?

      self.variance = counted_quantity - system_quantity
      self.variance_value = variance * (inventory_item.cost_price || 0)
    end
  end
end
