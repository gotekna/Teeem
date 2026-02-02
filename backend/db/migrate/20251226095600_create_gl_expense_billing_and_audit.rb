# frozen_string_literal: true

class CreateGlExpenseBillingAndAudit < ActiveRecord::Migration[7.1]
  def change
    # ===== EXPENSE PASS-THROUGH BILLING =====

    # Expenses that can be billed to clients
    create_table :gl_billable_expenses do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true
      t.references :contact, foreign_key: true  # Client to bill
      t.references :user, foreign_key: true  # Who incurred expense
      t.references :source_invoice, foreign_key: { to_table: :gl_invoices }  # Original bill
      t.references :billed_invoice, foreign_key: { to_table: :gl_invoices }  # Client invoice

      t.date :expense_date, null: false
      t.string :expense_type, null: false, limit: 30
      # travel, materials, equipment, subcontractor, meals, accommodation, other

      t.string :description, null: false
      t.string :vendor_name
      t.string :receipt_reference

      # Amounts
      t.decimal :cost_amount, precision: 15, scale: 2, null: false  # What we paid
      t.decimal :markup_percent, precision: 5, scale: 2, default: 0
      t.decimal :markup_amount, precision: 15, scale: 2, default: 0
      t.decimal :billable_amount, precision: 15, scale: 2  # What client pays

      t.string :status, default: "pending", limit: 20
      # pending, approved, billed, paid, written_off

      t.boolean :billable, default: true
      t.boolean :reimbursable, default: false  # Employee reimbursement

      t.text :notes
      t.string :document_file_id

      t.timestamps
    end

    add_index :gl_billable_expenses, [:corporate_id, :job_id, :status],
              name: "idx_billable_expenses_job"
    add_index :gl_billable_expenses, [:status], name: "idx_billable_expenses_status"

    # ===== COMPLETE AUDIT TRAIL =====

    # Audit log for all changes
    create_table :gl_audit_logs do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :user, foreign_key: true

      # What was changed
      t.string :auditable_type, null: false
      t.bigint :auditable_id, null: false
      t.string :action, null: false, limit: 20  # create, update, delete, approve, etc.

      # Change details
      t.json :changes_made  # { field: [old_value, new_value], ... }
      t.json :previous_values  # Snapshot of all values before change
      t.json :new_values  # Snapshot of all values after change

      # Context
      t.string :ip_address
      t.string :user_agent
      t.string :request_id
      t.string :source, limit: 30  # web, api, import, system

      t.text :notes

      t.timestamps
    end

    add_index :gl_audit_logs, [:auditable_type, :auditable_id],
              name: "idx_audit_logs_auditable"
    add_index :gl_audit_logs, [:corporate_id, :created_at],
              name: "idx_audit_logs_date"
    add_index :gl_audit_logs, [:user_id, :created_at],
              name: "idx_audit_logs_user"
    add_index :gl_audit_logs, [:action], name: "idx_audit_logs_action"

    # Audit snapshots (periodic full copies for compliance)
    create_table :gl_audit_snapshots do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users }

      t.string :snapshot_type, null: false, limit: 30
      # daily, monthly, quarterly, annual, eofy

      t.date :snapshot_date, null: false
      t.string :reference

      # Counts
      t.integer :invoice_count, default: 0
      t.integer :payment_count, default: 0
      t.integer :journal_count, default: 0

      # Totals
      t.decimal :total_revenue, precision: 15, scale: 2
      t.decimal :total_expenses, precision: 15, scale: 2
      t.decimal :total_assets, precision: 15, scale: 2
      t.decimal :total_liabilities, precision: 15, scale: 2

      # Storage
      t.string :file_path  # Path to exported data
      t.string :checksum   # SHA256 of exported data

      t.timestamps
    end

    add_index :gl_audit_snapshots, [:corporate_id, :snapshot_date],
              name: "idx_audit_snapshots_date"
    add_index :gl_audit_snapshots, [:snapshot_type], name: "idx_audit_snapshots_type"

    # ===== RETAINAGE RELEASE TRACKING =====

    # Track retainage releases over time
    create_table :gl_retainage_releases do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true
      t.references :progress_claim, foreign_key: { to_table: :gl_progress_claims }
      t.references :invoice, foreign_key: { to_table: :gl_invoices }
      t.references :approved_by, foreign_key: { to_table: :users }

      t.string :release_type, null: false, limit: 20
      # partial, final, milestone

      t.date :release_date, null: false
      t.decimal :amount, precision: 15, scale: 2, null: false
      t.decimal :remaining_retainage, precision: 15, scale: 2

      t.string :status, default: "pending", limit: 20
      # pending, approved, invoiced, paid

      t.text :conditions  # Conditions for release
      t.text :notes

      t.timestamps
    end

    add_index :gl_retainage_releases, [:corporate_id, :job_id],
              name: "idx_retainage_releases_job"
    add_index :gl_retainage_releases, [:status], name: "idx_retainage_releases_status"
  end
end
