# frozen_string_literal: true

class CreateDocsortItems < ActiveRecord::Migration[7.1]
  def change
    create_table :docsort_items do |t|
      # Tenant scoping (multi-tenancy SSoT)
      t.references :tenant, null: false, foreign_key: true

      # Storage links (reuse existing SSoT patterns)
      t.references :storage_blob, foreign_key: true, null: true
      t.references :warehouse_document, foreign_key: true, null: true

      # Source tracking
      t.references :synced_email, foreign_key: true, null: true
      t.references :uploaded_by, foreign_key: { to_table: :users }, null: true

      # Source type: how the document entered DocSort
      t.string :source, null: false, default: 'upload'  # email, upload, api, forward

      # Processing status
      t.string :status, null: false, default: 'pending'  # pending, classifying, classified, processing, completed, error, archived

      # Classification result
      t.string :document_type          # invoice, plan, quote, contract, email, purchase_order, work_order, general
      t.decimal :classification_confidence, precision: 5, scale: 4  # 0.0000 - 1.0000
      t.jsonb :classification_result, default: {}  # Full AI/heuristic result

      # Original file info
      t.string :original_filename
      t.string :content_type
      t.integer :file_size

      # Email source info (when source = 'email' or 'forward')
      t.string :from_email
      t.string :subject

      # Routing result (polymorphic - where the document was routed)
      t.string :routed_to_type        # BillInbox, JobPlan, etc.
      t.bigint :routed_to_id
      t.datetime :routed_at

      # User override (if user manually changed classification)
      t.boolean :user_override, default: false
      t.references :overridden_by, foreign_key: { to_table: :users }, null: true
      t.datetime :overridden_at

      # Processing metadata
      t.jsonb :metadata, default: {}
      t.text :error_message
      t.datetime :processed_at

      t.timestamps
    end

    # Indexes for common queries
    add_index :docsort_items, :status
    add_index :docsort_items, :document_type
    add_index :docsort_items, :source
    add_index :docsort_items, [:routed_to_type, :routed_to_id]
    add_index :docsort_items, :created_at
    add_index :docsort_items, :classification_confidence
    add_index :docsort_items, [:tenant_id, :status]
    add_index :docsort_items, [:tenant_id, :document_type]
  end
end
