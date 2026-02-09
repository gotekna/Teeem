# frozen_string_literal: true

# WarehouseSyncable - SSoT for syncing documents to S3 warehouse on save
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  THE ONE concern for warehouse document sync                       ║
# ║  All warehouse documents (Excel, Word, PPT, PDF, Notes) use this  ║
# ║                                                                   ║
# ║  SSoT: Uses TenantResolvable for fail-fast tenant derivation      ║
# ║  (Jan 2026 fix - removed Organization.first fallback)             ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   class TeeemSpreadsheet < ApplicationRecord
#     include WarehouseSyncable
#     warehouse_type :xlsx
#   end
#
# Supported types:
#   :xlsx     - TeeemSpreadsheet → Excel via TeeemXl
#   :html     - TeeemDocument → HTML from TipTap content
#   :pptx     - TeeemPresentation → PPTX (JSON for now)
#   :pdf      - TeeemPdf → PDF via Prawn
#   :file     - NotebookPageAttachment → Original file from ActiveStorage
#   :notebook - NotebookPage → HTML via NotebookExportService (Feb 2026)
#
module WarehouseSyncable
  extend ActiveSupport::Concern

  included do
    include TenantResolvable

    class_attribute :warehouse_document_type, default: nil

    after_save :sync_to_warehouse, if: :should_sync_to_warehouse?
  end

  class_methods do
    # Define the warehouse document type for this model
    def warehouse_type(type)
      self.warehouse_document_type = type
    end
  end

  # Sync this document to S3 warehouse AND create WarehouseDocument entry
  # @return [Hash] { success: true/false, path: "...", error: "..." }
  #
  # Phase 4 (Jan 2026): Now creates StorageBlob + WarehouseDocument entries
  # so documents appear in File Warehouse UI, not just S3.
  def sync_to_warehouse!
    return { success: false, error: "No warehouse type defined" } unless warehouse_document_type

    content = generate_warehouse_content
    return { success: false, error: "No content to export" } unless content.present?

    # SSoT: Get filename and content type
    full_path = warehouse_path
    filename = File.basename(full_path)
    content_type = warehouse_content_type

    begin
      # Step 1: Create/update StorageBlob (handles deduplication + upload)
      blob = StorageBlob.find_or_create_for_content!(
        content,
        filename: filename,
        content_type: content_type
      )

      # Step 2: Link blob to this model (if model has storage_blob_id column)
      if respond_to?(:storage_blob_id=) && respond_to?(:storage_blob_id)
        old_blob_id = storage_blob_id
        if old_blob_id != blob.id
          # Decrement old blob reference, increment new
          StorageBlob.find_by(id: old_blob_id)&.decrement_reference! if old_blob_id
          blob.increment_reference!
          update_column(:storage_blob_id, blob.id)
        end
      else
        # For models without storage_blob_id column, just increment reference
        blob.increment_reference!
      end

      # Step 3: Create/update WarehouseDocument entry
      create_or_update_warehouse_document!(blob)

      Rails.logger.info "[WarehouseSync] Synced #{self.class.name} #{id} to warehouse (blob: #{blob.id})"
      { success: true, path: blob.storage_path, blob_id: blob.id }
    rescue StandardError => e
      Rails.logger.error "[WarehouseSync] Failed to sync #{self.class.name} #{id}: #{e.message}"
      { success: false, error: e.message }
    end
  end

  private

  def should_sync_to_warehouse?
    warehouse_document_type.present? && warehouse_sync_enabled?
  end

  def warehouse_sync_enabled?
    # SSoT: Use resolved_tenant (from TenantResolvable) to get storage config
    tenant = resolved_tenant
    WarehouseProvider.for_tenant(tenant).warehouse_sync_enabled?
  rescue ::TenantNotFoundError => e
    Rails.logger.warn "[WarehouseSyncable] Sync disabled - no tenant: #{e.message}"
    false
  rescue StandardError => e
    Rails.logger.warn "[WarehouseSyncable] Sync disabled - error: #{e.message}"
    false
  end

  def warehouse_provider
    # SSoT: Use resolved_tenant (from TenantResolvable) to get provider
    tenant = resolved_tenant
    DocumentProviders.for_tenant(tenant)
  rescue ::TenantNotFoundError => e
    Rails.logger.warn "[WarehouseSyncable] No provider - no tenant: #{e.message}"
    nil
  rescue StandardError => e
    Rails.logger.warn "[WarehouseSyncable] No provider - error: #{e.message}"
    nil
  end

  def warehouse_filename
    case warehouse_document_type
    when :xlsx
      "#{safe_filename}.xlsx"
    when :html
      "#{safe_filename}.html"
    when :pptx
      "#{safe_filename}.pptx"
    when :pdf
      "#{safe_filename}.pdf"
    when :file
      file_name
    when :notebook
      "#{safe_filename}.html"
    else
      "document"
    end
  end

  def warehouse_content_type
    case warehouse_document_type
    when :xlsx
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    when :html, :notebook
      "text/html"
    when :pptx
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    when :pdf
      "application/pdf"
    when :file
      content_type || "application/octet-stream"
    else
      "application/octet-stream"
    end
  end

  # Generate file content based on document type
  def generate_warehouse_content
    case warehouse_document_type
    when :xlsx
      generate_xlsx_content
    when :html
      generate_html_content
    when :pptx
      generate_pptx_content
    when :pdf
      generate_pdf_content
    when :file
      generate_file_content
    when :notebook
      generate_notebook_content
    else
      nil
    end
  end

  # ========================================
  # Content Generators
  # ========================================

  def generate_xlsx_content
    workbook = TeeemXl::Models::Workbook.new

    data["sheets"]&.each do |sheet_data|
      sheet = workbook.add_sheet(sheet_data["name"] || "Sheet1")
      cells = sheet_data["cells"] || {}
      rows = cells_to_rows(cells)
      rows.each { |row| sheet.add_row(row) }
    end

    temp_file = Tempfile.new(["spreadsheet", ".xlsx"])
    begin
      TeeemXl.write(workbook, temp_file.path)
      temp_file.rewind
      File.binread(temp_file.path)
    ensure
      temp_file.close
      temp_file.unlink
    end
  end

  def generate_html_content
    content = data["content"] || "<p></p>"
    page_settings = data["pageSettings"] || {}

    <<~HTML
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>#{name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 2em; }
          @page { size: #{page_settings['size'] || 'A4'} #{page_settings['orientation'] || 'portrait'}; }
        </style>
      </head>
      <body>
        #{content}
      </body>
      </html>
    HTML
  end

  def generate_pptx_content
    # For now, export as JSON (proper PPTX generation would require pptx gem)
    data.to_json
  end

  def generate_pdf_content
    require "prawn"

    Prawn::Document.new(page_size: "LETTER") do |doc|
      data["pages"]&.each_with_index do |page_data, page_index|
        doc.start_new_page if page_index > 0

        page_data["elements"]&.each do |element|
          case element["type"]
          when "text"
            doc.draw_text element["content"].to_s,
                          at: [element["x"] || 0, element["y"] || 700],
                          size: element["fontSize"] || 12
          when "rectangle"
            doc.fill_rectangle(
              [element["x"] || 0, element["y"] || 0],
              element["width"] || 100,
              element["height"] || 50
            )
          end
        end
      end
    end.render
  rescue LoadError
    # Fallback if Prawn not available - export as JSON
    data.to_json
  end

  def generate_file_content
    # NotebookPageAttachment uses ActiveStorage
    if respond_to?(:file) && file.attached?
      file.download
    else
      nil
    end
  end

  def generate_notebook_content
    # NotebookPage uses NotebookExportService to generate HTML
    # The service handles: TipTap content + positioned boxes + drawing strokes
    NotebookExportService.new.export_html(self)
  end

  # ========================================
  # Helper Methods
  # ========================================

  def cells_to_rows(cells)
    return [] if cells.empty?

    max_row = 0
    max_col = 0

    cells.each_key do |cell_ref|
      col_letter = cell_ref.gsub(/\d/, "")
      row_num = cell_ref.gsub(/[A-Z]/i, "").to_i

      col_num = col_letter_to_number(col_letter)
      max_row = [max_row, row_num].max
      max_col = [max_col, col_num].max
    end

    rows = Array.new(max_row) { Array.new(max_col) }

    cells.each do |cell_ref, cell_data|
      col_letter = cell_ref.gsub(/\d/, "")
      row_num = cell_ref.gsub(/[A-Z]/i, "").to_i

      col_num = col_letter_to_number(col_letter)
      value = cell_data.is_a?(Hash) ? cell_data["value"] : cell_data

      rows[row_num - 1][col_num - 1] = value if row_num > 0 && col_num > 0
    end

    rows
  end

  def col_letter_to_number(letter)
    result = 0
    letter.upcase.each_char do |char|
      result = result * 26 + (char.ord - "A".ord + 1)
    end
    result
  end

  def sync_to_warehouse
    sync_to_warehouse!
  end

  # Create or update the WarehouseDocument entry for this record
  # SSoT: All warehouse-synced documents must have a WarehouseDocument to appear in File Warehouse
  def create_or_update_warehouse_document!(blob)
    return unless respond_to?(:warehouse_document)

    doc = warehouse_document || build_warehouse_document

    # Compute virtual folder path for File Warehouse display
    folder = compute_virtual_folder_path

    # Determine source_type based on document type
    source = compute_source_type

    # Get linkable (Job or nil)
    linkable = respond_to?(:job) ? job : nil

    doc.assign_attributes(
      source_type: source,
      display_name: name,
      original_filename: warehouse_filename,
      storage_blob: blob,
      linkable: linkable,
      metadata: {
        document_type: warehouse_document_type.to_s,
        created_by_id: respond_to?(:user_id) ? user_id : nil,
        created_by_name: respond_to?(:user) ? user&.name : nil,
        job_code: linkable&.job_code
      }.compact
    )

    doc.save!
    Rails.logger.debug "[WarehouseSyncable] Created/updated WarehouseDocument #{doc.id} for #{self.class.name} #{id}"
  end

  # Compute virtual folder path for File Warehouse display
  # Override in models for custom folder structure
  def compute_virtual_folder_path
    return virtual_folder_path if respond_to?(:virtual_folder_path)

    # Default folder structure: Warehousing/{DocumentType}/{UserName}/{Year}
    doc_type = warehouse_type_to_folder_name
    user_name = respond_to?(:user) ? (user&.name || "Unknown") : "Unknown"
    year = (created_at || Time.current).year.to_s

    "Warehousing/#{doc_type}/#{user_name}/#{year}"
  end

  # Map warehouse_document_type to human-readable folder name
  def warehouse_type_to_folder_name
    case warehouse_document_type
    when :xlsx then "Excel"
    when :html then "Word"
    when :pptx then "PowerPoint"
    when :pdf then "PDF"
    when :file then "Files"
    when :notebook then "Notes"
    else "Documents"
    end
  end

  # Compute source_type for WarehouseDocument
  # "warehouse" is the catch-all for user-created documents
  def compute_source_type
    "warehouse"
  end
end
