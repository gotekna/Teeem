# frozen_string_literal: true

class CreateGlInvoices < ActiveRecord::Migration[8.0]
  def change
    # ═══════════════════════════════════════════════════════════════
    # GL INVOICES - Sales Invoices and Bills
    # ═══════════════════════════════════════════════════════════════
    create_table :gl_invoices do |t|
      t.references :corporate_company, null: false, foreign_key: true

      # External provider linking (nullable - works for ANY provider or standalone)
      t.string :external_provider         # 'xero', 'quickbooks', 'myob', nil (standalone)
      t.string :external_tenant_id        # Provider's org/company ID
      t.string :external_invoice_id       # Provider's invoice ID (e.g., Xero's GUID)
      t.datetime :external_synced_at
      t.datetime :external_updated_at     # Last modified in external system

      # Invoice Identity
      t.string :invoice_number            # INV-0001, BILL-0042
      t.string :invoice_type, null: false # sales_invoice, bill, credit_note
      t.string :reference                 # Customer/supplier reference
      t.date :invoice_date, null: false
      t.date :due_date

      # Contact/Counterparty
      t.references :contact, foreign_key: true
      t.string :external_contact_id       # Provider's contact ID
      t.string :contact_name              # Denormalized for display

      # Amounts (calculated from lines)
      t.decimal :subtotal, precision: 15, scale: 2, default: 0
      t.decimal :total_tax, precision: 15, scale: 2, default: 0
      t.decimal :total, precision: 15, scale: 2, default: 0
      t.decimal :amount_due, precision: 15, scale: 2, default: 0
      t.decimal :amount_paid, precision: 15, scale: 2, default: 0

      # Currency
      t.string :currency_code, default: 'AUD'
      t.decimal :exchange_rate, precision: 15, scale: 6, default: 1.0

      # Status
      t.string :status, default: 'draft'  # draft, submitted, approved, paid, voided, deleted
      t.datetime :approved_at
      t.references :approved_by, foreign_key: { to_table: :users }

      # Job linking (for job costing)
      t.references :job, foreign_key: true, index: { name: 'idx_gl_invoices_job' }

      # Journalization
      t.references :gl_journal_entry, foreign_key: true, index: { name: 'idx_gl_invoices_journal' }
      t.boolean :journalized, default: false

      # Sync tracking
      t.boolean :sync_enabled, default: true
      t.boolean :pending_push, default: false
      t.boolean :created_in_teeem, default: false
      t.datetime :teeem_updated_at
      t.string :sync_error
      t.jsonb :sync_metadata, default: {}

      # Additional data
      t.text :description
      t.text :notes
      t.boolean :has_attachments, default: false
      t.jsonb :tracking_data, default: []

      t.timestamps

      t.index [ :external_provider, :external_tenant_id, :external_invoice_id ],
              name: 'idx_gl_invoices_external', unique: true
      t.index [ :corporate_company_id, :invoice_type, :status ], name: 'idx_gl_inv_company_type_status'
      t.index [ :corporate_company_id, :invoice_date ], name: 'idx_gl_inv_company_date'
      t.index [ :contact_id, :invoice_type ], name: 'idx_gl_inv_contact_type'
      t.index :pending_push, name: 'idx_gl_inv_pending_push'
    end

    # ═══════════════════════════════════════════════════════════════
    # GL INVOICE LINES - Line items for invoices
    # ═══════════════════════════════════════════════════════════════
    create_table :gl_invoice_lines do |t|
      t.references :gl_invoice, null: false, foreign_key: true
      t.references :gl_account, foreign_key: true

      # External linking
      t.string :external_line_id          # Provider's line item ID

      # Line item details
      t.integer :line_number, default: 1
      t.string :item_code                 # Inventory/product code
      t.text :description
      t.decimal :quantity, precision: 15, scale: 4, default: 1
      t.decimal :unit_price, precision: 15, scale: 4, default: 0
      t.decimal :discount_rate, precision: 5, scale: 2, default: 0
      t.decimal :discount_amount, precision: 15, scale: 2, default: 0

      # Amounts
      t.decimal :line_amount, precision: 15, scale: 2, default: 0  # qty * price - discount
      t.decimal :tax_amount, precision: 15, scale: 2, default: 0

      # Tax
      t.references :gl_tax_rate, foreign_key: true
      t.string :tax_type                  # GST, GST-Free, etc.

      # Job linking (can be different per line)
      t.references :job, foreign_key: true, index: { name: 'idx_gl_inv_lines_job' }

      # Tracking categories
      t.string :tracking_category_1
      t.string :tracking_option_1
      t.string :tracking_category_2
      t.string :tracking_option_2

      t.timestamps

      t.index [ :gl_invoice_id, :line_number ]
    end

    # ═══════════════════════════════════════════════════════════════
    # GL PAYMENTS - Payment records
    # ═══════════════════════════════════════════════════════════════
    create_table :gl_payments do |t|
      t.references :corporate_company, null: false, foreign_key: true

      # External provider linking
      t.string :external_provider
      t.string :external_tenant_id
      t.string :external_payment_id
      t.datetime :external_synced_at
      t.datetime :external_updated_at

      # Payment Identity
      t.string :payment_number
      t.string :payment_type, null: false # customer_payment, supplier_payment, refund
      t.date :payment_date, null: false
      t.string :reference

      # Contact/Counterparty
      t.references :contact, foreign_key: true
      t.string :external_contact_id
      t.string :contact_name

      # Amounts
      t.decimal :amount, precision: 15, scale: 2, null: false
      t.string :currency_code, default: 'AUD'
      t.decimal :exchange_rate, precision: 15, scale: 6, default: 1.0

      # Bank Account
      t.references :gl_account, foreign_key: true  # Bank account
      t.string :bank_account_code
      t.string :bank_account_name

      # Status
      t.string :status, default: 'pending'  # pending, completed, voided

      # Journalization
      t.references :gl_journal_entry, foreign_key: true
      t.boolean :journalized, default: false

      # Sync tracking
      t.boolean :sync_enabled, default: true
      t.boolean :pending_push, default: false
      t.boolean :created_in_teeem, default: false

      t.timestamps

      t.index [ :external_provider, :external_tenant_id, :external_payment_id ],
              name: 'idx_gl_payments_external', unique: true
      t.index [ :corporate_company_id, :payment_type, :payment_date ], name: 'idx_gl_pay_company_type_date'
      t.index :contact_id, name: 'idx_gl_pay_contact'
      t.index :gl_journal_entry_id, name: 'idx_gl_pay_journal'
    end

    # ═══════════════════════════════════════════════════════════════
    # GL PAYMENT ALLOCATIONS - Link payments to invoices
    # ═══════════════════════════════════════════════════════════════
    create_table :gl_payment_allocations do |t|
      t.references :gl_payment, null: false, foreign_key: true
      t.references :gl_invoice, null: false, foreign_key: true
      t.decimal :amount, precision: 15, scale: 2, null: false

      t.timestamps

      t.index [ :gl_payment_id, :gl_invoice_id ], unique: true
    end
  end
end
