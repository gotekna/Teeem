# frozen_string_literal: true

module HealthChecks
  # Health checks for Warehouse Documents
  # Foundation: warehouse_documents (slug-based lookup - SSoT)
  #
  # now use WarehouseDocument (SSoT).
  #
  # Checks:
  #   - Documents missing storage blob (warning)
  #   - Documents missing display name (info)
  #   - Orphaned documents by source type
  #
  class DocumentsCheck < BaseCheck
    FOUNDATION_SLUG = "warehouse_documents"

    def self.check_type
      "warehouse_documents"
    end

    # SSoT: Use slug lookup, not hardcoded numeric ID (differs per environment)
    def self.foundation_id
      @foundation_id ||= Foundation.find_by(slug: FOUNDATION_SLUG)&.id
    end

    # Documents missing storage blob (file not uploaded)
    def check_missing_storage_blob
      docs = WarehouseDocument.where(storage_blob_id: nil)
                              .limit(100)

      build_result(
        name: "Documents Missing Storage",
        description: "Warehouse documents without an associated storage blob - file may not be uploaded.",
        severity: :warning,
        items: docs,
        icon: "exclamation-triangle",
        action_path: "/admin/warehouse"
      )
    end

    # Documents missing UI name
    def check_missing_ui_name
      docs = WarehouseDocument.where(ui_name: [nil, ""])
                              .limit(100)

      build_result(
        name: "Documents Missing UI Name",
        description: "Documents without a UI name set.",
        severity: :info,
        items: docs,
        icon: "document-text",
        action_path: "/admin/warehouse"
      )
    end

    # Orphaned documents (documentable deleted)
    def check_orphaned_documents
      # Find documents where documentable no longer exists
      orphaned = WarehouseDocument.where.not(documentable_type: nil)
                                   .where.not(documentable_id: nil)
                                   .left_joins(:documentable)
                                   .where("warehouse_documents.documentable_type IS NOT NULL AND warehouse_documents.documentable_id IS NOT NULL")
                                   .limit(100)
                                   .select { |d| d.documentable.nil? }

      build_result(
        name: "Orphaned Documents",
        description: "Documents linked to entities that no longer exist.",
        severity: :warning,
        items: orphaned,
        icon: "link-slash",
        action_path: "/admin/warehouse"
      )
    end

    # Documents by source type breakdown
    def check_source_type_distribution
      counts = WarehouseDocument.group(:source_type).count

      items = counts.map do |source_type, count|
        {
          id: source_type,
          display: "#{source_type || 'Unknown'}: #{count} documents",
          count: count
        }
      end

      build_result(
        name: "Document Source Distribution",
        description: "Breakdown of documents by source type.",
        severity: :info,
        items: items,
        icon: "chart-pie",
        action_path: "/admin/warehouse"
      )
    end

    protected

    def format_items(items)
      items.map do |item|
        if item.is_a?(Hash)
          item
        elsif item.is_a?(WarehouseDocument)
          {
            id: item.id,
            display: item.ui_name || item.original_filename || "Document ##{item.id}",
            source_type: item.source_type,
            folder: item.folder_path,
            documentable_type: item.documentable_type,
            documentable_id: item.documentable_id
          }
        else
          super
        end
      end
    end
  end
end
