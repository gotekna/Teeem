class CreateExternalInvoices < ActiveRecord::Migration[8.0]
  def change
    create_table :external_invoices do |t|
      # Source system identification
      t.string :source, null: false  # 'xero', 'myob', 'quickbooks'
      t.string :external_id  # ID in the external system (null if created in TEEEM, not yet synced)
      t.string :tenant_id  # For multi-org systems (Xero tenant, MYOB company file)

      # Common invoice fields (normalized across all systems)
      t.string :invoice_number
      t.string :reference
      t.string :invoice_type, null: false  # 'sales_invoice' or 'bill'
      t.string :status  # 'draft', 'submitted', 'approved', 'paid', 'voided', 'deleted'

      # Dates
      t.date :invoice_date
      t.date :due_date
      t.date :fully_paid_date

      # Amounts (normalized to AUD or base currency)
      t.decimal :subtotal, precision: 15, scale: 4
      t.decimal :total_tax, precision: 15, scale: 4
      t.decimal :total, precision: 15, scale: 4
      t.decimal :amount_due, precision: 15, scale: 4
      t.decimal :amount_paid, precision: 15, scale: 4
      t.string :currency_code, default: 'AUD'

      # External contact info
      t.string :external_contact_id
      t.string :contact_name

      # Links to TEEEM records
      t.references :contact, foreign_key: true  # Linked TEEEM contact
      t.references :job, foreign_key: true      # Linked TEEEM job (via tracking)

      # System-specific data stored as JSON
      t.jsonb :raw_data, default: {}      # Full API response
      t.jsonb :line_items, default: []    # Line item details
      t.jsonb :payments, default: []      # Payment details
      t.jsonb :tracking_data, default: [] # Tracking categories/classes/jobs

      # Two-way sync control (matching contact_xero_links pattern)
      t.boolean :sync_enabled, default: true
      t.string :sync_direction, default: 'bidirectional'  # import_only, export_only, bidirectional
      t.boolean :created_in_teeem, default: false  # Track where invoice originated
      t.boolean :pending_push, default: false  # Needs to be pushed to external system
      t.jsonb :conflict_fields, default: {}  # Track conflicts between TEEEM and external

      # Sync metadata
      t.datetime :external_updated_at  # When external system last modified
      t.datetime :teeem_updated_at  # When TEEEM last modified (for conflict detection)
      t.datetime :last_synced_at
      t.string :sync_error

      t.timestamps
    end

    # Unique constraint: one record per source + tenant + external_id
    add_index :external_invoices, [ :source, :tenant_id, :external_id ], unique: true, name: 'idx_external_invoices_unique'
    add_index :external_invoices, :source
    add_index :external_invoices, :external_id
    add_index :external_invoices, :tenant_id
    add_index :external_invoices, :external_contact_id
    add_index :external_invoices, :invoice_type
    add_index :external_invoices, :status
    add_index :external_invoices, :invoice_date
    add_index :external_invoices, :tracking_data, using: :gin
    add_index :external_invoices, :pending_push  # Find invoices needing to be pushed
    add_index :external_invoices, :sync_enabled
    add_index :external_invoices, :created_in_teeem
  end
end
