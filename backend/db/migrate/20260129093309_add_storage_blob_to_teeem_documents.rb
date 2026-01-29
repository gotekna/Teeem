# frozen_string_literal: true

# Add storage_blob_id to Teeem document tables for File Warehouse integration
#
# This migration connects user-created documents (Excel, Word, PDF, PPT) to
# the File Warehouse via StorageBlob. Previously these were uploaded to S3
# but not tracked in WarehouseDocument, so they didn't appear in File Warehouse.
#
# After this migration + model changes, all Teeem documents will:
# 1. Create a StorageBlob when synced to warehouse
# 2. Create a WarehouseDocument entry linking to that blob
# 3. Appear in the File Warehouse UI alongside emails, job docs, etc.
#
class AddStorageBlobToTeeemDocuments < ActiveRecord::Migration[8.0]
  def change
    add_reference :teeem_spreadsheets, :storage_blob, foreign_key: true, index: true
    add_reference :teeem_documents, :storage_blob, foreign_key: true, index: true
    add_reference :teeem_presentations, :storage_blob, foreign_key: true, index: true
    add_reference :teeem_pdfs, :storage_blob, foreign_key: true, index: true
  end
end
