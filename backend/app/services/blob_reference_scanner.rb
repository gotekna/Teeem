# frozen_string_literal: true

# BlobReferenceScanner - SSoT for finding all StorageBlob references
#
# FRC (Feb 2026): Previous orphan detection only checked 3 of 20+ models,
# causing false orphan detection and potential data loss. This scanner
# checks ALL models/tables with storage_blob_id before declaring a blob orphaned.
#
# Used by:
#   - blob:cleanup:orphaned rake task
#   - blob:audit:integrity rake task
#   - OrphanBlobAuditJob (weekly safety net)
#
class BlobReferenceScanner
  # SSoT: ALL models that have belongs_to :storage_blob
  # FRC: Missing any = false orphan = data loss.
  REFERENCE_SOURCES = {
    "WarehouseDocument" => :storage_blob_id,
    "ChatMessage" => :storage_blob_id,
    "BillInbox" => :storage_blob_id,
    "TeeemDocument" => :storage_blob_id,
    "TeeemPdf" => :storage_blob_id,
    "TeeemPresentation" => :storage_blob_id,
    "TeeemSpreadsheet" => :storage_blob_id,
    "NotebookPageAttachment" => :storage_blob_id,
    "PdfGeneration" => :storage_blob_id,
    "FinancialTransaction" => :storage_blob_id,
    "AssetExpense" => :storage_blob_id,
    "AssetOdometerReading" => :storage_blob_id,
    "DocumentInbox" => :storage_blob_id,
    "DocumentTask" => :storage_blob_id,
    "UserDocument" => :storage_blob_id,
    "ContactDocument" => :storage_blob_id
  }.freeze

  # PricebookItem has 3 blob columns (image, spec, qr_code)
  PRICEBOOK_BLOB_COLUMNS = %i[image_storage_blob_id spec_storage_blob_id qr_code_storage_blob_id].freeze

  # Legacy tables without ActiveRecord model (still have FK to storage_blobs)
  LEGACY_TABLES = %w[email_attachments].freeze

  # Collect ALL referenced blob IDs across the entire system.
  # Returns a Set of integer IDs.
  # Yields (source_name, count) for each source if block given.
  def self.all_referenced_blob_ids(&block)
    all_ids = Set.new

    REFERENCE_SOURCES.each do |model_name, column|
      next unless Object.const_defined?(model_name)

      klass = model_name.constantize
      next unless table_exists?(klass)

      scope = klass.respond_to?(:unscoped) ? klass.unscoped : klass
      ids = scope.where.not(column => nil).distinct.pluck(column)
      all_ids.merge(ids)
      block&.call(model_name, ids.count)
    end

    # PricebookItem has 3 blob columns
    if Object.const_defined?("PricebookItem") && table_exists?(PricebookItem)
      PRICEBOOK_BLOB_COLUMNS.each do |col|
        ids = PricebookItem.where.not(col => nil).distinct.pluck(col)
        all_ids.merge(ids)
        block&.call("PricebookItem.#{col}", ids.count)
      end
    end

    # Legacy tables (no model, use raw SQL)
    LEGACY_TABLES.each do |table|
      if ActiveRecord::Base.connection.table_exists?(table)
        ids = ActiveRecord::Base.connection.select_values(
          "SELECT DISTINCT storage_blob_id FROM #{table} WHERE storage_blob_id IS NOT NULL"
        ).map(&:to_i)
        all_ids.merge(ids)
        block&.call(table, ids.count)
      end
    end

    all_ids
  end

  # Count actual references for a single blob across ALL models.
  # Used by integrity audit to verify reference_count accuracy.
  def self.count_references_for(blob_id)
    count = 0

    REFERENCE_SOURCES.each do |model_name, column|
      next unless Object.const_defined?(model_name)

      klass = model_name.constantize
      next unless table_exists?(klass)

      scope = klass.respond_to?(:unscoped) ? klass.unscoped : klass
      count += scope.where(column => blob_id).count
    end

    if Object.const_defined?("PricebookItem") && table_exists?(PricebookItem)
      PRICEBOOK_BLOB_COLUMNS.each do |col|
        count += PricebookItem.where(col => blob_id).count
      end
    end

    LEGACY_TABLES.each do |table|
      if ActiveRecord::Base.connection.table_exists?(table)
        count += ActiveRecord::Base.connection.select_value(
          "SELECT COUNT(*) FROM #{table} WHERE storage_blob_id = #{blob_id.to_i}"
        ).to_i
      end
    end

    count
  end

  # Total number of reference sources being checked
  def self.source_count
    REFERENCE_SOURCES.count + PRICEBOOK_BLOB_COLUMNS.count + LEGACY_TABLES.count
  end

  # Check if a model's table exists in the database.
  # FRC (Feb 2026): ContactDocument model exists but table doesn't yet.
  # const_defined? passes but querying crashes with PG::UndefinedTable.
  def self.table_exists?(klass)
    klass.connection.table_exists?(klass.table_name)
  rescue StandardError => e
    Rails.logger.warn "[BlobReferenceScanner] Failed to check table existence for #{klass.name}: #{e.message}"
    false
  end
end
