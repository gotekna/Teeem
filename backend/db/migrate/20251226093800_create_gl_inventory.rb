# frozen_string_literal: true

class CreateGlInventory < ActiveRecord::Migration[7.1]
  def change
    # Inventory items
    create_table :gl_inventory_items do |t|
      t.references :corporate_company, null: false, foreign_key: true
      t.references :pricebook_item, foreign_key: { to_table: :pricebook }
      t.references :cogs_account, foreign_key: { to_table: :gl_accounts }
      t.references :inventory_account, foreign_key: { to_table: :gl_accounts }
      t.references :income_account, foreign_key: { to_table: :gl_accounts }

      t.string :sku, null: false
      t.string :name, null: false
      t.text :description
      t.string :category
      t.string :unit_of_measure, default: "each", limit: 20

      # Pricing
      t.decimal :cost_price, precision: 15, scale: 4  # Average or last cost
      t.decimal :sale_price, precision: 15, scale: 2
      t.string :costing_method, default: "average", limit: 20  # average, fifo, lifo

      # Stock levels
      t.decimal :quantity_on_hand, precision: 15, scale: 4, default: 0
      t.decimal :quantity_committed, precision: 15, scale: 4, default: 0  # On sales orders
      t.decimal :quantity_on_order, precision: 15, scale: 4, default: 0  # On purchase orders
      t.decimal :quantity_available, precision: 15, scale: 4, default: 0  # on_hand - committed

      # Reorder
      t.decimal :reorder_point, precision: 15, scale: 4
      t.decimal :reorder_quantity, precision: 15, scale: 4
      t.boolean :track_inventory, default: true

      # Status
      t.string :status, default: "active", limit: 20  # active, discontinued, out_of_stock
      t.boolean :is_sellable, default: true
      t.boolean :is_purchasable, default: true

      # Audit
      t.datetime :last_counted_at
      t.datetime :last_received_at
      t.datetime :last_sold_at

      t.timestamps
    end

    add_index :gl_inventory_items, [:corporate_company_id, :sku], unique: true, name: "idx_inventory_items_sku"
    add_index :gl_inventory_items, [:corporate_company_id, :category], name: "idx_inventory_items_category"
    add_index :gl_inventory_items, [:status], name: "idx_inventory_items_status"

    # Inventory transactions (movements)
    create_table :gl_inventory_transactions do |t|
      t.references :inventory_item, null: false, foreign_key: { to_table: :gl_inventory_items }
      t.references :user, foreign_key: true

      t.string :transaction_type, null: false, limit: 30
      # Types: receive, sell, adjust, transfer, count, return, write_off

      t.decimal :quantity, precision: 15, scale: 4, null: false
      t.decimal :unit_cost, precision: 15, scale: 4
      t.decimal :total_cost, precision: 15, scale: 2

      t.decimal :quantity_before, precision: 15, scale: 4
      t.decimal :quantity_after, precision: 15, scale: 4

      # Reference document
      t.string :reference_type  # PurchaseOrder, Invoice, StockCount
      t.bigint :reference_id

      t.text :notes
      t.datetime :transaction_date, null: false

      t.timestamps
    end

    add_index :gl_inventory_transactions, [:inventory_item_id, :transaction_date],
              name: "idx_inventory_txns_date"
    add_index :gl_inventory_transactions, [:reference_type, :reference_id],
              name: "idx_inventory_txns_ref"

    # Stock counts (stocktakes)
    create_table :gl_stock_counts do |t|
      t.references :corporate_company, null: false, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users }
      t.references :approved_by, foreign_key: { to_table: :users }

      t.string :reference, null: false
      t.date :count_date, null: false
      t.string :status, default: "draft", limit: 20  # draft, in_progress, completed, approved

      t.text :notes
      t.datetime :started_at
      t.datetime :completed_at

      t.timestamps
    end

    add_index :gl_stock_counts, [:corporate_company_id, :reference],
              unique: true, name: "idx_stock_counts_ref"

    # Stock count lines
    create_table :gl_stock_count_lines do |t|
      t.references :stock_count, null: false, foreign_key: { to_table: :gl_stock_counts }
      t.references :inventory_item, null: false, foreign_key: { to_table: :gl_inventory_items }

      t.decimal :system_quantity, precision: 15, scale: 4
      t.decimal :counted_quantity, precision: 15, scale: 4
      t.decimal :variance, precision: 15, scale: 4
      t.decimal :variance_value, precision: 15, scale: 2

      t.text :notes

      t.timestamps
    end

    add_index :gl_stock_count_lines, [:stock_count_id, :inventory_item_id],
              unique: true, name: "idx_stock_count_lines_item"
  end
end
