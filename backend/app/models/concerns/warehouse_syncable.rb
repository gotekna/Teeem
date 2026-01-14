# frozen_string_literal: true

# WarehouseSyncable - SSoT for syncing documents to S3 warehouse on save
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  THE ONE concern for warehouse document sync                       ║
# ║  All warehouse documents (Excel, Word, PPT, PDF, Notes) use this  ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   class TeeemSpreadsheet < ApplicationRecord
#     include WarehouseSyncable
#     warehouse_type :xlsx
#   end
#
# Supported types:
#   :xlsx  - TeeemSpreadsheet → Excel via TeeemXl
#   :html  - TeeemDocument → HTML from TipTap content
#   :pptx  - TeeemPresentation → PPTX (JSON for now)
#   :pdf   - TeeemPdf → PDF via Prawn
#   :file  - NotebookPageAttachment → Original file from ActiveStorage
#
module WarehouseSyncable
  extend ActiveSupport::Concern

  included do
    class_attribute :warehouse_document_type, default: nil

    after_save :sync_to_warehouse, if: :should_sync_to_warehouse?
  end

  class_methods do
    # Define the warehouse document type for this model
    def warehouse_type(type)
      self.warehouse_document_type = type
    end
  end

  # Sync this document to S3 warehouse
  # @return [Hash] { success: true/false, path: "...", error: "..." }
  def sync_to_warehouse!
    return { success: false, error: "No warehouse type defined" } unless warehouse_document_type

    content = generate_warehouse_content
    return { success: false, error: "No content to export" } unless content.present?

    provider = warehouse_provider
    return { success: false, error: "No S3 provider configured" } unless provider

    folder_path = warehouse_folder_path
    filename = warehouse_filename
    content_type = warehouse_content_type

    begin
      provider.upload_file(
        folder_path,
        content,
        filename,
        content_type: content_type,
        overwrite: true
      )

      Rails.logger.info "[WarehouseSync] Synced #{self.class.name} #{id} to #{folder_path}/#{filename}"
      { success: true, path: "#{folder_path}/#{filename}" }
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
    # Check if warehouse sync is enabled in StorageConfiguration
    StorageConfiguration.instance.warehouse_sync_enabled?
  rescue StandardError
    false
  end

  def warehouse_provider
    organization = Organization.first
    DocumentProviders::S3Compatible.for_organization(organization)
  rescue StandardError
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
    else
      "document"
    end
  end

  def warehouse_content_type
    case warehouse_document_type
    when :xlsx
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    when :html
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
end
