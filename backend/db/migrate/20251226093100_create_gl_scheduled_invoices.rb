# frozen_string_literal: true

class CreateGlScheduledInvoices < ActiveRecord::Migration[7.1]
  def change
    create_table :gl_scheduled_invoices do |t|
      t.references :corporate_company, null: false, foreign_key: true
      t.references :invoice, null: false, foreign_key: { to_table: :gl_invoices }
      t.references :created_by, foreign_key: { to_table: :users }

      t.datetime :scheduled_for, null: false
      t.string :status, null: false, default: "pending", limit: 20
      t.boolean :send_email, default: true

      t.datetime :sent_at
      t.datetime :cancelled_at
      t.text :error_message

      t.timestamps
    end

    add_index :gl_scheduled_invoices, [:status, :scheduled_for], name: "idx_scheduled_invoices_due"
  end
end
