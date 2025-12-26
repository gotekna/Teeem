# frozen_string_literal: true

module Gl
  # Records inventory movements (receives, sales, adjustments)
  class InventoryTransaction < ApplicationRecord
    self.table_name = "gl_inventory_transactions"

    TRANSACTION_TYPES = %w[receive sell adjust transfer count return write_off].freeze

    belongs_to :inventory_item, class_name: "Gl::InventoryItem"
    belongs_to :user, optional: true
    belongs_to :reference, polymorphic: true, optional: true

    validates :transaction_type, presence: true, inclusion: { in: TRANSACTION_TYPES }
    validates :quantity, presence: true
    validates :transaction_date, presence: true

    scope :receives, -> { where(transaction_type: "receive") }
    scope :sales, -> { where(transaction_type: "sell") }
    scope :adjustments, -> { where(transaction_type: %w[adjust count write_off]) }
    scope :for_period, ->(start_date, end_date) { where(transaction_date: start_date..end_date) }

    def type_label
      {
        "receive" => "Received",
        "sell" => "Sold",
        "adjust" => "Adjusted",
        "transfer" => "Transferred",
        "count" => "Stock Count",
        "return" => "Returned",
        "write_off" => "Written Off"
      }[transaction_type]
    end

    def movement_direction
      quantity.positive? ? "in" : "out"
    end
  end
end
