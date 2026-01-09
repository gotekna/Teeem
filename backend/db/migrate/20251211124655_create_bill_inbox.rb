class CreateBillInbox < ActiveRecord::Migration[8.0]
  def change
    create_table :bill_inboxes do |t|
      # Source tracking
      t.string :source, null: false, default: 'email'  # email, upload, api
      t.string :email_message_id        # Link to email_warehouse
      t.bigint :email_warehouse_id

      # Company assignment (multi-tenant)
      t.references :corporate_company, foreign_key: true
      t.bigint :detected_company_id  # AI-detected company from invoice

      # Supplier info (extracted or matched)
      t.references :supplier, foreign_key: { to_table: :contacts }
      t.string :supplier_name_raw       # As extracted from invoice
      t.string :supplier_abn_raw

      # Invoice details (extracted)
      t.string :invoice_number
      t.date :invoice_date
      t.date :due_date
      t.decimal :subtotal, precision: 15, scale: 2
      t.decimal :tax_amount, precision: 15, scale: 2
      t.decimal :total_amount, precision: 15, scale: 2
      t.string :currency, default: 'AUD'

      # Line items (JSON array)
      t.jsonb :line_items, default: []

      # AI extraction results
      t.jsonb :ai_extraction_result, default: {}
      t.decimal :ai_confidence, precision: 5, scale: 4
      t.datetime :extracted_at

      # PO matching
      t.references :matched_purchase_order, foreign_key: { to_table: :purchase_orders }
      t.string :match_status, default: 'unmatched'  # unmatched, matched, variance, no_po_required
      t.decimal :variance_amount, precision: 15, scale: 2
      t.string :variance_reason

      # Processing status
      t.string :status, null: false, default: 'pending'
      # pending, extracting, extracted, matching, matched, approval_pending,
      # approved, rejected, processing, paid, cancelled, error

      # Approval workflow
      t.bigint :bpmn_process_instance_id
      t.references :approved_by, foreign_key: { to_table: :users }
      t.datetime :approved_at
      t.text :rejection_reason

      # External sync
      t.references :external_invoice, foreign_key: true  # Created in Xero
      t.string :xero_invoice_id
      t.datetime :synced_to_xero_at

      # Attachments (via ActiveStorage)
      t.string :original_filename
      t.string :content_type

      t.text :notes
      t.timestamps
    end

    add_index :bill_inboxes, :status
    add_index :bill_inboxes, :match_status
    add_index :bill_inboxes, [ :corporate_company_id, :status ]
    add_index :bill_inboxes, :email_message_id, unique: true, where: "email_message_id IS NOT NULL"
    add_index :bill_inboxes, [ :supplier_id, :invoice_number ], unique: true, where: "invoice_number IS NOT NULL"
    add_foreign_key :bill_inboxes, :corporate_companies, column: :detected_company_id
    add_foreign_key :bill_inboxes, :email_warehouse, column: :email_warehouse_id
    add_foreign_key :bill_inboxes, :bpmn_process_instances, column: :bpmn_process_instance_id
  end
end
