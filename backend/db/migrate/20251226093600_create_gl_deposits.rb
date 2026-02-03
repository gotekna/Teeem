# frozen_string_literal: true

class CreateGlDeposits < ActiveRecord::Migration[7.1]
  def change
    create_table :gl_deposits do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.references :job, foreign_key: true
      t.references :received_by, foreign_key: { to_table: :users }
      t.references :bank_account, foreign_key: { to_table: :gl_accounts }

      # Deposit details
      t.string :reference, null: false
      t.date :received_date, null: false
      t.decimal :amount, precision: 15, scale: 2, null: false
      t.decimal :applied_amount, precision: 15, scale: 2, default: 0
      t.decimal :refunded_amount, precision: 15, scale: 2, default: 0
      t.decimal :balance, precision: 15, scale: 2  # Remaining unallocated

      # Type
      t.string :deposit_type, null: false, default: "deposit", limit: 20  # deposit, prepayment, retainer

      # Status
      t.string :status, null: false, default: "received", limit: 20  # received, partially_applied, fully_applied, refunded

      # Payment info
      t.string :payment_method, limit: 30  # cash, check, eft, credit_card
      t.string :payment_reference  # Check number, transaction ID

      # Notes
      t.text :description
      t.text :notes

      t.timestamps
    end

    add_index :gl_deposits, [:corporate_id, :contact_id, :status],
              name: "idx_deposits_contact_status"
    add_index :gl_deposits, [:corporate_id, :reference],
              unique: true, name: "idx_deposits_reference"

    # Deposit allocations (which invoices the deposit was applied to)
    create_table :gl_deposit_allocations do |t|
      t.references :deposit, null: false, foreign_key: { to_table: :gl_deposits }
      t.references :invoice, null: false, foreign_key: { to_table: :gl_invoices }
      t.references :allocated_by, foreign_key: { to_table: :users }

      t.decimal :amount, precision: 15, scale: 2, null: false
      t.datetime :allocated_at, null: false

      t.timestamps
    end

    add_index :gl_deposit_allocations, [:deposit_id, :invoice_id],
              unique: true, name: "idx_deposit_allocations_unique"
  end
end
