# frozen_string_literal: true

class CreateGlAdvancedReporting < ActiveRecord::Migration[7.2]
  def change
    # Departments for departmental P&L
    create_table :gl_departments do |t|
      t.references :corporate, null: false, foreign_key: true
      t.string :name, null: false
      t.string :code
      t.references :parent, foreign_key: { to_table: :gl_departments }
      t.references :manager, foreign_key: { to_table: :users }
      t.boolean :active, default: true
      t.decimal :budget_amount, precision: 15, scale: 2
      t.text :description
      t.integer :position, default: 0
      t.timestamps
    end

    add_index :gl_departments, [:corporate_id, :code], unique: true
    add_index :gl_departments, :active

    # Tracking classes (multi-dimensional tagging)
    create_table :gl_tracking_classes do |t|
      t.references :corporate, null: false, foreign_key: true
      t.string :name, null: false
      t.string :class_type, null: false # location, project, product_line, region, etc.
      t.string :code
      t.references :parent, foreign_key: { to_table: :gl_tracking_classes }
      t.boolean :active, default: true
      t.jsonb :metadata, default: {}
      t.timestamps
    end

    add_index :gl_tracking_classes, [:corporate_id, :class_type, :code], unique: true
    add_index :gl_tracking_classes, :class_type
    add_index :gl_tracking_classes, :active

    # Transaction class assignments (many-to-many)
    create_table :gl_class_assignments do |t|
      t.references :tracking_class, null: false, foreign_key: { to_table: :gl_tracking_classes }
      t.references :assignable, polymorphic: true, null: false
      t.decimal :percentage, precision: 5, scale: 2, default: 100 # For split allocations
      t.timestamps
    end

    add_index :gl_class_assignments, [:assignable_type, :assignable_id, :tracking_class_id],
              unique: true, name: "idx_class_assignments_unique"

    # Split transactions
    create_table :gl_split_transactions do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :original_transaction, polymorphic: true # Bank transaction, journal, etc.
      t.decimal :original_amount, precision: 15, scale: 2, null: false
      t.string :status, default: "pending" # pending, completed, reversed
      t.references :created_by, foreign_key: { to_table: :users }
      t.references :approved_by, foreign_key: { to_table: :users }
      t.datetime :completed_at
      t.text :notes
      t.timestamps
    end

    add_index :gl_split_transactions, :status

    # Split transaction lines
    create_table :gl_split_lines do |t|
      t.references :split_transaction, null: false, foreign_key: { to_table: :gl_split_transactions }
      t.references :account, null: false, foreign_key: { to_table: :gl_accounts }
      t.references :department, foreign_key: { to_table: :gl_departments }
      t.references :job, foreign_key: true
      t.decimal :amount, precision: 15, scale: 2, null: false
      t.decimal :percentage, precision: 5, scale: 2
      t.text :description
      t.references :tax_rate, foreign_key: { to_table: :gl_tax_rates }
      t.timestamps
    end

    # Comparative report snapshots (for period comparisons)
    create_table :gl_period_snapshots do |t|
      t.references :corporate, null: false, foreign_key: true
      t.string :period_type, null: false # month, quarter, year
      t.date :period_start, null: false
      t.date :period_end, null: false
      t.string :label # "Jan 2024", "Q1 2024", "FY2024"
      t.jsonb :account_balances, default: {} # account_id => balance
      t.jsonb :department_totals, default: {} # department_id => {revenue, expense, profit}
      t.jsonb :class_totals, default: {} # class_id => totals
      t.jsonb :kpi_values, default: {} # kpi_name => value
      t.boolean :finalized, default: false
      t.timestamps
    end

    add_index :gl_period_snapshots, [:corporate_id, :period_type, :period_start], unique: true
    add_index :gl_period_snapshots, :period_type
    add_index :gl_period_snapshots, :finalized

    # KPI definitions
    create_table :gl_kpi_definitions do |t|
      t.references :corporate, null: false, foreign_key: true
      t.string :name, null: false
      t.string :code, null: false
      t.string :category # profitability, liquidity, efficiency, growth
      t.string :formula_type, null: false # ratio, percentage, sum, average, custom
      t.jsonb :formula, null: false # Formula definition
      t.string :format # currency, percent, number, days
      t.decimal :target_value, precision: 15, scale: 4
      t.string :target_direction # higher_is_better, lower_is_better, target_range
      t.decimal :warning_threshold, precision: 15, scale: 4
      t.decimal :critical_threshold, precision: 15, scale: 4
      t.boolean :active, default: true
      t.boolean :show_on_dashboard, default: false
      t.integer :position
      t.timestamps
    end

    add_index :gl_kpi_definitions, [:corporate_id, :code], unique: true
    add_index :gl_kpi_definitions, :category
    add_index :gl_kpi_definitions, :show_on_dashboard

    # Industry benchmarks
    create_table :gl_benchmarks do |t|
      t.string :industry_code, null: false # ANZSIC code
      t.string :industry_name, null: false
      t.string :kpi_code, null: false
      t.integer :year, null: false
      t.decimal :percentile_25, precision: 15, scale: 4
      t.decimal :percentile_50, precision: 15, scale: 4
      t.decimal :percentile_75, precision: 15, scale: 4
      t.decimal :percentile_90, precision: 15, scale: 4
      t.string :source
      t.timestamps
    end

    add_index :gl_benchmarks, [:industry_code, :kpi_code, :year], unique: true

    # Document request portal
    create_table :gl_document_requests do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.references :job, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users }
      t.string :title, null: false
      t.text :description
      t.string :status, default: "pending" # pending, sent, partially_received, completed, expired
      t.date :due_date
      t.datetime :sent_at
      t.datetime :completed_at
      t.string :access_token
      t.integer :reminder_count, default: 0
      t.datetime :last_reminder_at
      t.jsonb :email_settings, default: {}
      t.timestamps
    end

    add_index :gl_document_requests, :status
    add_index :gl_document_requests, :access_token, unique: true
    add_index :gl_document_requests, :due_date

    # Requested documents (items within a request)
    create_table :gl_requested_documents do |t|
      t.references :document_request, null: false, foreign_key: { to_table: :gl_document_requests }
      t.string :document_type, null: false # tax_return, bank_statement, invoice, receipt, etc.
      t.string :name, null: false
      t.text :instructions
      t.string :status, default: "pending" # pending, uploaded, approved, rejected
      t.boolean :required, default: true
      t.bigint :uploaded_file_id # No FK - document_files may not exist
      t.datetime :uploaded_at
      t.references :reviewed_by, foreign_key: { to_table: :users }
      t.datetime :reviewed_at
      t.text :rejection_reason
      t.timestamps
    end

    add_index :gl_requested_documents, :status
    add_index :gl_requested_documents, :document_type

    # Add department tracking to existing tables (if columns don't exist)
    unless column_exists?(:gl_invoices, :department_id)
      add_reference :gl_invoices, :department, foreign_key: { to_table: :gl_departments }
    end

    unless column_exists?(:gl_journal_entries, :department_id)
      add_reference :gl_journal_entries, :department, foreign_key: { to_table: :gl_departments }
    end
  end
end
