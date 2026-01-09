class CreateGlRecurringInvoices < ActiveRecord::Migration[7.2]
  def change
    create_table :gl_recurring_invoices, if_not_exists: true do |t|
      # Template info
      t.string :name, null: false
      t.string :invoice_type, null: false, default: 'sales_invoice' # sales_invoice, bill
      t.text :description

      # Contact
      t.references :contact, foreign_key: true
      t.string :contact_name

      # Job (optional - for job-based recurring)
      t.references :job, foreign_key: true

      # Schedule
      t.string :frequency, null: false # daily, weekly, fortnightly, monthly, quarterly, annually
      t.integer :frequency_interval, default: 1 # every N periods
      t.integer :day_of_month # for monthly (1-28, or -1 for last day)
      t.integer :day_of_week # for weekly (0=Sunday, 1=Monday, etc.)
      t.date :start_date, null: false
      t.date :end_date # null = no end date
      t.integer :occurrences_limit # null = unlimited, otherwise stop after N
      t.integer :occurrences_count, default: 0

      # Next generation
      t.date :next_generation_date
      t.datetime :last_generated_at

      # Invoice defaults
      t.integer :payment_terms_days, default: 14
      t.string :currency_code, default: 'AUD'
      t.decimal :exchange_rate, precision: 12, scale: 6, default: 1.0
      t.text :notes

      # Template lines stored as JSON
      t.jsonb :line_items_template, default: []

      # Calculated totals (from template)
      t.decimal :subtotal, precision: 15, scale: 2, default: 0
      t.decimal :total_tax, precision: 15, scale: 2, default: 0
      t.decimal :total, precision: 15, scale: 2, default: 0

      # Status
      t.boolean :is_active, default: true
      t.string :status, default: 'active' # active, paused, completed, cancelled

      # Auto-approve generated invoices?
      t.boolean :auto_approve, default: false

      # Email settings
      t.boolean :send_email_on_generation, default: false
      t.string :email_to
      t.string :email_cc

      # Audit
      t.references :created_by, foreign_key: { to_table: :users }
      t.references :updated_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    # Track which invoices were generated from recurring templates
    unless column_exists?(:gl_invoices, :recurring_invoice_id)
      add_reference :gl_invoices, :recurring_invoice, foreign_key: { to_table: :gl_recurring_invoices }, null: true
    end
    unless column_exists?(:gl_invoices, :recurring_sequence)
      add_column :gl_invoices, :recurring_sequence, :integer # 1st, 2nd, 3rd, etc.
    end

    add_index :gl_recurring_invoices, :next_generation_date, if_not_exists: true
    add_index :gl_recurring_invoices, [:is_active, :status], if_not_exists: true
    # contact_id index already created by t.references above
  end
end
