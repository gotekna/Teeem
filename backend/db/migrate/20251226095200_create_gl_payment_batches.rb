# frozen_string_literal: true

class CreateGlPaymentBatches < ActiveRecord::Migration[7.1]
  def change
    # Payment batches (for batch payments to suppliers)
    create_table :gl_payment_batches do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :bank_account, foreign_key: { to_table: :gl_accounts }
      t.references :created_by, foreign_key: { to_table: :users }
      t.references :approved_by, foreign_key: { to_table: :users }

      t.string :reference, null: false
      t.date :payment_date, null: false
      t.string :status, default: "draft", limit: 20
      # draft, pending_approval, approved, processing, completed, failed

      # Totals
      t.integer :payment_count, default: 0
      t.decimal :total_amount, precision: 15, scale: 2, default: 0

      # ABA file
      t.text :aba_file_content
      t.string :aba_file_name
      t.datetime :aba_generated_at

      # Processing
      t.datetime :approved_at
      t.datetime :processed_at
      t.datetime :completed_at
      t.text :processing_notes

      t.timestamps
    end

    add_index :gl_payment_batches, [:corporate_id, :reference],
              unique: true, name: "idx_payment_batches_ref"
    add_index :gl_payment_batches, [:corporate_id, :status],
              name: "idx_payment_batches_status"

    # Individual payments in a batch
    create_table :gl_payment_batch_items do |t|
      t.references :payment_batch, null: false, foreign_key: { to_table: :gl_payment_batches }
      t.references :contact, null: false, foreign_key: true  # Payee
      t.references :invoice, foreign_key: { to_table: :gl_invoices }  # Bill being paid

      t.decimal :amount, precision: 15, scale: 2, null: false
      t.string :reference  # Payment reference

      # Bank details (denormalized for ABA generation)
      t.string :bsb, limit: 7
      t.string :account_number, limit: 9
      t.string :account_name, limit: 32

      t.string :status, default: "pending", limit: 20
      # pending, processed, failed

      t.text :notes
      t.string :error_message

      t.timestamps
    end

    add_index :gl_payment_batch_items, [:payment_batch_id, :contact_id],
              name: "idx_batch_items_contact"
    add_index :gl_payment_batch_items, [:payment_batch_id, :status],
              name: "idx_batch_items_status"

    # Bank details for contacts (for ABA payments)
    unless column_exists?(:contacts, :bank_bsb)
      add_column :contacts, :bank_bsb, :string, limit: 7
      add_column :contacts, :bank_account_number, :string, limit: 15
      add_column :contacts, :bank_account_name, :string, limit: 32
      add_column :contacts, :bank_name, :string, limit: 50
    end
  end
end
