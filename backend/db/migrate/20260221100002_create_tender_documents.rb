# frozen_string_literal: true

# Create tender_documents and tender_document_items tables for versioned tender generation.
#
# TenderDocument = A versioned snapshot of a job's tender, created from POs grouped by tender section.
# TenderDocumentItem = A frozen line item from a PO, grouped by tender section.
#
# Version control flow:
#   1. Create tender → Snapshot PO items → Lock POs → Status: "locked"
#   2. Send to client → Status: "sent"
#   3. Client requests changes → Mark current as "superseded" → Unlock POs
#   4. Modify POs → Create new tender (v2) → Repeat
#
class CreateTenderDocuments < ActiveRecord::Migration[8.0]
  def change
    # ═══════════════════════════════════════════════════════════════════════════
    # tender_documents - Versioned tender per job
    # ═══════════════════════════════════════════════════════════════════════════
    create_table :tender_documents do |t|
      t.bigint :tenant_id, null: false
      t.references :job, foreign_key: true, null: false
      t.references :created_by, foreign_key: { to_table: :users }

      # Document identity
      t.string :document_number, null: false          # "TD-000001"
      t.integer :version, null: false, default: 1     # v1, v2, v3...
      t.string :status, null: false, default: "draft" # draft, locked, sent, revision_requested, accepted, declined, superseded

      # Dates
      t.date :date_prepared, null: false
      t.date :valid_until
      t.integer :validity_days, default: 30

      # Snapshotted totals
      t.decimal :subtotal, precision: 15, scale: 2, default: 0
      t.decimal :gst, precision: 15, scale: 2, default: 0
      t.decimal :total, precision: 15, scale: 2, default: 0

      # Snapshotted job/client info (frozen at creation)
      t.string :job_name
      t.string :job_address
      t.string :job_code
      t.string :client_name
      t.string :client_address
      t.string :client_email
      t.string :client_phone
      t.string :salesperson_name

      # Configurable text sections (HTML content for PDF)
      t.text :cover_letter_html
      t.text :terms_and_conditions_html
      t.text :base_specification_html
      t.text :acceptance_page_html
      t.text :notes_html

      # PDF tracking
      t.references :pdf_generation, foreign_key: true, null: true
      t.references :storage_blob, foreign_key: true, null: true

      # Version tracking
      t.bigint :previous_version_id
      t.datetime :locked_at
      t.references :locked_by, foreign_key: { to_table: :users }, null: true
      t.datetime :sent_at
      t.datetime :accepted_at
      t.datetime :declined_at
      t.text :revision_notes

      # Settings
      t.jsonb :settings, default: {}

      t.timestamps
    end

    add_index :tender_documents, [:tenant_id, :document_number], unique: true
    add_index :tender_documents, [:job_id, :version]
    add_index :tender_documents, :status
    add_foreign_key :tender_documents, :tenants, on_delete: :cascade
    add_foreign_key :tender_documents, :tender_documents, column: :previous_version_id, on_delete: :nullify

    # ═══════════════════════════════════════════════════════════════════════════
    # tender_document_items - Frozen line items from POs, grouped by section
    # ═══════════════════════════════════════════════════════════════════════════
    create_table :tender_document_items do |t|
      t.references :tender_document, foreign_key: true, null: false

      # Snapshotted section info
      t.string :tender_section_name, null: false
      t.string :tender_section_code
      t.integer :section_sort_order
      t.string :section_type, default: "priced"      # priced, note, included, provisional

      # Line item data
      t.integer :line_number, null: false
      t.text :description, null: false
      t.decimal :quantity, precision: 15, scale: 3
      t.string :unit
      t.decimal :unit_price, precision: 15, scale: 2
      t.decimal :total_amount, precision: 15, scale: 2
      t.string :gst_code, default: "GST"
      t.string :item_type, default: "priced"          # priced, note, included, provisional
      t.text :notes

      # Source tracking (audit trail)
      t.bigint :source_purchase_order_id
      t.string :source_po_number
      t.bigint :source_line_item_id
      t.string :cost_centre_name
      t.string :trade_name

      t.timestamps
    end

    add_index :tender_document_items,
              [:tender_document_id, :tender_section_name, :line_number],
              name: "idx_tender_doc_items_section_line"
    add_index :tender_document_items, :source_purchase_order_id
  end
end
