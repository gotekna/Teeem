# frozen_string_literal: true

# SSoT Migration: Provider-Agnostic Storage
#
# PROBLEM (FRC Analysis):
#   Multiple tables had SharePoint-specific required columns blocking S3/Wasabi uploads:
#   - job_documents.sharepoint_item_id (required) - should be storage_item_id
#   - plan_folder_scans.sharepoint_file_id (required) - should be storage_item_id
#
#   Both tables already have storage_item_id (optional) - the provider-agnostic SSoT.
#   This violated SSoT and prevented S3/Wasabi uploads without fake SharePoint IDs.
#
# SOLUTION:
#   Make SharePoint columns NULLABLE so documents can use:
#   - storage_item_id = THE ONE SSoT for all providers
#   - storage_provider = which provider (sharepoint, s3_compatible, etc.)
#   - sharepoint_* columns = only populated for SharePoint synced files
#
# The unique indexes still work (PostgreSQL allows multiple NULLs).
#
class MakeSharepointItemIdNullableOnJobDocuments < ActiveRecord::Migration[8.0]
  def up
    # SSoT: Make SharePoint columns nullable for provider-agnostic storage
    change_column_null :job_documents, :sharepoint_item_id, true
    change_column_null :plan_folder_scans, :sharepoint_file_id, true

    # Backfill storage_item_id from sharepoint columns for existing records
    # This ensures existing records work with the new SSoT validation
    execute <<-SQL
      UPDATE job_documents
      SET storage_item_id = sharepoint_item_id
      WHERE storage_item_id IS NULL AND sharepoint_item_id IS NOT NULL
    SQL

    execute <<-SQL
      UPDATE plan_folder_scans
      SET storage_item_id = sharepoint_file_id
      WHERE storage_item_id IS NULL AND sharepoint_file_id IS NOT NULL
    SQL
  end

  def down
    # Before reverting, ensure no NULL values exist
    JobDocument.where(sharepoint_item_id: nil).find_each do |doc|
      doc.update_column(:sharepoint_item_id, "legacy_#{doc.id}")
    end
    change_column_null :job_documents, :sharepoint_item_id, false

    PlanFolderScan.where(sharepoint_file_id: nil).find_each do |scan|
      scan.update_column(:sharepoint_file_id, "legacy_#{scan.id}")
    end
    change_column_null :plan_folder_scans, :sharepoint_file_id, false
  end
end
