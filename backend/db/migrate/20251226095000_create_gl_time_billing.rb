# frozen_string_literal: true

class CreateGlTimeBilling < ActiveRecord::Migration[7.1]
  def change
    # Billable rates per user/role/project
    create_table :gl_billable_rates do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :user, foreign_key: true  # Specific user rate
      t.references :job, foreign_key: true   # Job-specific rate
      t.references :contact, foreign_key: true  # Client-specific rate

      t.string :rate_type, null: false, limit: 20  # user, role, default
      t.string :role_name  # If rate_type is 'role'

      t.decimal :hourly_rate, precision: 15, scale: 2, null: false
      t.decimal :overtime_rate, precision: 15, scale: 2
      t.decimal :weekend_rate, precision: 15, scale: 2

      t.date :effective_from
      t.date :effective_to
      t.boolean :active, default: true

      t.timestamps
    end

    add_index :gl_billable_rates, [:corporate_id, :user_id, :job_id],
              name: "idx_billable_rates_user_job"
    add_index :gl_billable_rates, [:corporate_id, :rate_type],
              name: "idx_billable_rates_type"

    # Time entries marked for billing
    create_table :gl_billable_time_entries do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :time_entry, null: false  # Link to existing SmTimeEntry
      t.references :job, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.references :billable_rate, foreign_key: { to_table: :gl_billable_rates }
      t.references :invoice, foreign_key: { to_table: :gl_invoices }

      t.date :entry_date, null: false
      t.decimal :hours, precision: 8, scale: 2, null: false
      t.decimal :billable_hours, precision: 8, scale: 2  # May differ from actual
      t.decimal :hourly_rate, precision: 15, scale: 2, null: false
      t.decimal :amount, precision: 15, scale: 2, null: false

      t.string :description
      t.string :task_type  # Design, Development, Meeting, etc.

      t.string :status, default: "unbilled", limit: 20
      # unbilled, pending_approval, approved, billed, written_off

      t.datetime :approved_at
      t.references :approved_by, foreign_key: { to_table: :users }

      t.text :notes
      t.boolean :billable, default: true
      t.boolean :invoiced, default: false

      t.timestamps
    end

    add_index :gl_billable_time_entries, [:corporate_id, :status],
              name: "idx_billable_time_status"
    add_index :gl_billable_time_entries, [:corporate_id, :job_id, :entry_date],
              name: "idx_billable_time_job_date"
    add_index :gl_billable_time_entries, [:invoice_id],
              name: "idx_billable_time_invoice"

    # Time billing batches (group entries for invoicing)
    create_table :gl_time_billing_batches do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true  # Client
      t.references :job, foreign_key: true
      t.references :invoice, foreign_key: { to_table: :gl_invoices }
      t.references :created_by, foreign_key: { to_table: :users }

      t.string :reference, null: false
      t.date :period_start, null: false
      t.date :period_end, null: false

      t.decimal :total_hours, precision: 10, scale: 2
      t.decimal :total_amount, precision: 15, scale: 2

      t.string :status, default: "draft", limit: 20
      # draft, approved, invoiced

      t.text :notes

      t.timestamps
    end

    add_index :gl_time_billing_batches, [:corporate_id, :reference],
              unique: true, name: "idx_time_batches_ref"
    add_index :gl_time_billing_batches, [:corporate_id, :contact_id, :status],
              name: "idx_time_batches_client"
  end
end
