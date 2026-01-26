# frozen_string_literal: true

# Phase 3: Blob Architecture - Universal Table
#
# This is THE SSoT table for all document warehouse metadata.
# Instead of adding storage_blob_id to 10+ models, this ONE table
# links ANY document type to StorageBlob.
#
# Architecture:
#   JobDocument / EmailAttachment / CorporateCompanyDocument / etc.
#       └── has_one :warehouse_document, as: :documentable
#               └── belongs_to :storage_blob (deduplication via content_hash)
#
# Benefits:
#   1. ONE migration instead of 10
#   2. ONE model instead of updating 10 existing models
#   3. Single SSoT for all warehouse metadata
#   4. Existing models stay unchanged
#   5. Polymorphic - can link ANY model to warehouse storage
#
class CreateWarehouseDocuments < ActiveRecord::Migration[8.0]
  def change
    create_table :warehouse_documents do |t|
      # Polymorphic: links to JobDocument, EmailAttachment, CorporateCompanyDocument, etc.
      t.references :documentable, polymorphic: true, null: false

      # Link to StorageBlob for deduplication (same file = same blob)
      t.references :storage_blob, foreign_key: true, index: true

      # Display Name: What user SEES in File Warehouse UI
      # Example: "Tax Return FY2024", "RE: Invoice Question"
      t.string :display_name, null: false

      # Send Name: What file is CALLED when downloaded/emailed
      # Example: "TA Tax Return 2024.pdf", "RE Invoice Question - 2026-01-17.eml"
      # If null, falls back to display_name
      t.string :send_name

      # Virtual folder path (changing this is instant - no S3 copy needed)
      # Example: "Corporate/TH/Tab 10", "Jobs/J-001/Plans"
      t.string :folder

      # Source type for filtering and template selection
      # Values: "corporate", "job", "email", "task", "people", "contact"
      t.string :source_type, null: false

      # Original filename (for reference/fallback)
      t.string :original_filename

      # File metadata (cached from storage_blob for performance)
      t.bigint :file_size
      t.string :content_type

      t.timestamps

      # Ensure one warehouse_document per documentable
      t.index [:documentable_type, :documentable_id], unique: true, name: "idx_warehouse_docs_documentable_unique"

      # Fast folder queries
      t.index :folder

      # Fast source_type filtering
      t.index :source_type

      # Search by display_name
      t.index :display_name
    end
  end
end
