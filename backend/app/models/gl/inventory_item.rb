# frozen_string_literal: true

module Gl
  # Inventory items with stock tracking
  class InventoryItem < ApplicationRecord
    self.table_name = "gl_inventory_items"

    COSTING_METHODS = %w[average fifo lifo].freeze
    STATUSES = %w[active discontinued out_of_stock].freeze

    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
    belongs_to :pricebook_item, optional: true
    belongs_to :cogs_account, class_name: "Gl::Account", optional: true
    belongs_to :inventory_account, class_name: "Gl::Account", optional: true
    belongs_to :income_account, class_name: "Gl::Account", optional: true

    has_many :transactions, class_name: "Gl::InventoryTransaction", foreign_key: "inventory_item_id", dependent: :destroy

    validates :sku, presence: true, uniqueness: { scope: :corporate_company_id }
    validates :name, presence: true
    validates :costing_method, presence: true, inclusion: { in: COSTING_METHODS }
    validates :status, presence: true, inclusion: { in: STATUSES }

    before_save :calculate_available_quantity

    scope :active, -> { where(status: "active") }
    scope :tracked, -> { where(track_inventory: true) }
    scope :low_stock, -> { where("quantity_on_hand <= reorder_point AND reorder_point IS NOT NULL") }
    scope :out_of_stock, -> { where("quantity_on_hand <= 0") }
    scope :sellable, -> { where(is_sellable: true) }
    scope :purchasable, -> { where(is_purchasable: true) }

    # Receive stock (from purchase)
    def receive!(quantity:, unit_cost: nil, reference: nil, user: nil, notes: nil)
      unit_cost ||= self.cost_price || 0

      transaction do
        create_transaction!(
          transaction_type: "receive",
          quantity: quantity,
          unit_cost: unit_cost,
          reference: reference,
          user: user,
          notes: notes
        )

        # Update average cost
        update_average_cost(quantity, unit_cost) if costing_method == "average"

        update!(
          quantity_on_hand: quantity_on_hand + quantity,
          last_received_at: Time.current
        )
      end
    end

    # Sell/issue stock
    def sell!(quantity:, reference: nil, user: nil, notes: nil)
      raise "Insufficient stock" if quantity > quantity_available

      transaction do
        cost = calculate_cogs(quantity)

        create_transaction!(
          transaction_type: "sell",
          quantity: -quantity,
          unit_cost: cost_price,
          total_cost: cost,
          reference: reference,
          user: user,
          notes: notes
        )

        update!(
          quantity_on_hand: quantity_on_hand - quantity,
          last_sold_at: Time.current
        )

        cost
      end
    end

    # Adjust stock (manual adjustment)
    def adjust!(quantity:, reason: nil, user: nil)
      adjustment = quantity - quantity_on_hand

      transaction do
        create_transaction!(
          transaction_type: "adjust",
          quantity: adjustment,
          unit_cost: cost_price,
          notes: reason,
          user: user
        )

        update!(
          quantity_on_hand: quantity,
          last_counted_at: Time.current
        )
      end
    end

    # Write off stock
    def write_off!(quantity:, reason: nil, user: nil)
      transaction do
        create_transaction!(
          transaction_type: "write_off",
          quantity: -quantity,
          unit_cost: cost_price,
          total_cost: quantity * (cost_price || 0),
          notes: reason,
          user: user
        )

        update!(quantity_on_hand: quantity_on_hand - quantity)
      end
    end

    # Return stock
    def return!(quantity:, reference: nil, user: nil, notes: nil)
      transaction do
        create_transaction!(
          transaction_type: "return",
          quantity: quantity,
          unit_cost: cost_price,
          reference: reference,
          user: user,
          notes: notes
        )

        update!(quantity_on_hand: quantity_on_hand + quantity)
      end
    end

    # Calculate value of inventory
    def inventory_value
      quantity_on_hand * (cost_price || 0)
    end

    def needs_reorder?
      reorder_point.present? && quantity_available <= reorder_point
    end

    def stock_status
      return "out_of_stock" if quantity_on_hand <= 0
      return "low_stock" if needs_reorder?

      "in_stock"
    end

    private

    def calculate_available_quantity
      self.quantity_available = (quantity_on_hand || 0) - (quantity_committed || 0)
    end

    def update_average_cost(new_quantity, new_unit_cost)
      total_existing = quantity_on_hand * (cost_price || 0)
      total_new = new_quantity * new_unit_cost
      new_total_quantity = quantity_on_hand + new_quantity

      self.cost_price = new_total_quantity.positive? ? (total_existing + total_new) / new_total_quantity : new_unit_cost
    end

    def calculate_cogs(quantity)
      # For now, use average cost. FIFO/LIFO would require lot tracking
      quantity * (cost_price || 0)
    end

    def create_transaction!(attrs)
      transactions.create!(
        quantity_before: quantity_on_hand,
        quantity_after: (quantity_on_hand || 0) + (attrs[:quantity] || 0),
        transaction_date: Time.current,
        **attrs.except(:reference)
      ).tap do |txn|
        if attrs[:reference]
          txn.update!(
            reference_type: attrs[:reference].class.name,
            reference_id: attrs[:reference].id
          )
        end
      end
    end
  end
end
