# frozen_string_literal: true

class CreateGlBillingMilestones < ActiveRecord::Migration[7.1]
  def change
    create_table :gl_billing_milestones do |t|
      t.references :corporate_company, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.references :invoice, foreign_key: { to_table: :gl_invoices }
      t.references :completed_by, foreign_key: { to_table: :users }

      # Milestone details
      t.string :name, null: false
      t.text :description
      t.integer :sort_order, default: 0

      # Billing
      t.decimal :amount, precision: 15, scale: 2, null: false
      t.decimal :percentage_of_contract, precision: 5, scale: 2  # If % based
      t.boolean :is_percentage, default: false

      # Schedule
      t.date :target_date
      t.date :completed_date

      # Status
      t.string :status, null: false, default: "pending", limit: 20
      t.datetime :invoiced_at
      t.boolean :auto_invoice, default: false  # Auto-create invoice when completed

      # Notes
      t.text :completion_notes
      t.text :deliverables  # JSON array of deliverables

      t.timestamps
    end

    add_index :gl_billing_milestones, [:corporate_company_id, :job_id, :sort_order],
              name: "idx_billing_milestones_order"
    add_index :gl_billing_milestones, [:status], name: "idx_billing_milestones_status"
  end
end
