# frozen_string_literal: true

# Add storage_blob_id to remaining models to complete ActiveStorage -> StorageBlob migration
#
# SSoT Architecture:
#   Document → StorageBlob (deduplicated by content_hash)
#
# This migration covers all remaining models that still use ActiveStorage:
# - ContactDocument, JobDocument, PeopleDocument, UserDocument (has_one_attached :file)
# - NotebookPageAttachment, DocumentTask (has_one_attached :file/:document)
# - Asset (has_many_attached :photos)
# - AssetExpense (has_one_attached :receipt)
# - AssetOdometerReading (has_one_attached :photo)
# - AssetServiceHistory (has_one_attached :invoice, :document)
# - FinancialTransaction (has_one_attached :receipt)
# - PayNowRequest (has_one_attached :invoice_file, has_many_attached :proof_photos)
# - User (has_one_attached :signature, :photo)
#
# For models with multiple attachments, we use separate columns or JSONB arrays.
#
class AddStorageBlobToRemainingModels < ActiveRecord::Migration[8.0]
  def change
    # ========================================
    # Document models with single file
    # ========================================

    # ContactDocument - contact attachments (16 records with files)
    add_reference :contact_documents, :storage_blob, foreign_key: true, index: true

    # JobDocument - job files (0 records with ActiveStorage files)
    add_reference :job_documents, :storage_blob, foreign_key: true, index: true

    # PeopleDocument - identity documents (0 records with files)
    add_reference :people_documents, :storage_blob, foreign_key: true, index: true

    # UserDocument - user-uploaded documents (0 records with files)
    add_reference :user_documents, :storage_blob, foreign_key: true, index: true

    # NotebookPageAttachment - notebook file attachments (0 records)
    add_reference :notebook_page_attachments, :storage_blob, foreign_key: true, index: true

    # DocumentTask - job document tasks (0 records with files)
    add_reference :document_tasks, :storage_blob, foreign_key: true, index: true

    # ========================================
    # Asset-related models
    # ========================================

    # Asset - primary photo (has_many_attached but we track primary)
    # Use JSONB array for multiple photo blob IDs
    add_column :assets, :photo_blob_ids, :jsonb, default: [], null: false

    # AssetExpense - receipt photo (0 records)
    add_reference :asset_expenses, :storage_blob, foreign_key: true, index: true

    # AssetOdometerReading - odometer photo (0 records)
    add_reference :asset_odometer_readings, :storage_blob, foreign_key: true, index: true

    # AssetServiceHistory - invoice and document (0 records)
    # Two separate attachments, so two separate blob references
    add_reference :asset_service_histories, :invoice_blob, foreign_key: { to_table: :storage_blobs }, index: true
    add_reference :asset_service_histories, :document_blob, foreign_key: { to_table: :storage_blobs }, index: true

    # ========================================
    # Financial models
    # ========================================

    # FinancialTransaction - receipt (0 records)
    add_reference :financial_transactions, :storage_blob, foreign_key: true, index: true

    # PayNowRequest - invoice file and proof photos (0 records)
    # invoice_file -> single blob, proof_photos -> JSONB array
    add_reference :pay_now_requests, :invoice_blob, foreign_key: { to_table: :storage_blobs }, index: true
    add_column :pay_now_requests, :proof_photo_blob_ids, :jsonb, default: [], null: false

    # ========================================
    # User model
    # ========================================

    # User - signature and photo (1 signature, 1 photo in production)
    add_reference :users, :signature_blob, foreign_key: { to_table: :storage_blobs }, index: true
    add_reference :users, :photo_blob, foreign_key: { to_table: :storage_blobs }, index: true
  end
end
