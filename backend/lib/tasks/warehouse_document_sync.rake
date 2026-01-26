# frozen_string_literal: true

# Warehouse Document Sync - Export Teeem documents (Excel, Word, PowerPoint) to S3 warehouse
#
# Usage:
#   rails warehouse:sync_documents           # Dry run (preview)
#   rails warehouse:sync_documents[execute]  # Actually sync
#   rails warehouse:sync_spreadsheets        # Just spreadsheets
#
namespace :warehouse do
  desc "Sync all Teeem documents (Excel, Word, PowerPoint) to S3 warehouse"
  task :sync_documents, [:mode] => :environment do |_t, args|
    mode = args[:mode] || "dry_run"
    execute = mode == "execute"

    puts "=" * 70
    puts "Warehouse Document Sync"
    puts "Mode: #{execute ? 'EXECUTE' : 'DRY RUN (preview only)'}"
    puts "=" * 70
    puts ""

    total_synced = 0
    total_errors = 0

    # Sync each document type
    [
      { name: "TeeemSpreadsheet", model: TeeemSpreadsheet, scope: :excel_documents, ext: ".xlsx" },
      { name: "TeeemDocument", model: TeeemDocument, scope: :word_documents, ext: ".html" },
      { name: "TeeemPresentation", model: TeeemPresentation, scope: :powerpoint_documents, ext: ".pptx" },
      { name: "TeeemPdf", model: TeeemPdf, scope: :pdf_documents, ext: ".pdf" },
      { name: "NotebookPageAttachment", model: NotebookPageAttachment, scope: :notes, ext: nil }
    ].each do |config|
      result = sync_document_type(config, execute)
      total_synced += result[:synced]
      total_errors += result[:errors]
    end

    puts ""
    puts "=" * 70
    puts "Summary"
    puts "=" * 70
    puts "Total synced: #{total_synced}"
    puts "Total errors: #{total_errors}"

    unless execute
      puts ""
      puts "To execute, run:"
      puts "  rails warehouse:sync_documents[execute]"
    end
  end

  desc "Sync TeeemSpreadsheets to S3 warehouse"
  task :sync_spreadsheets, [:mode] => :environment do |_t, args|
    mode = args[:mode] || "dry_run"
    execute = mode == "execute"

    result = sync_document_type(
      { name: "TeeemSpreadsheet", model: TeeemSpreadsheet, scope: :excel_documents, ext: ".xlsx" },
      execute
    )

    puts ""
    puts "Synced: #{result[:synced]}, Errors: #{result[:errors]}"
  end

  def sync_document_type(config, execute)
    name = config[:name]
    model = config[:model]
    scope = config[:scope]
    ext = config[:ext]

    puts "-" * 70
    puts "Processing #{name}"
    puts "-" * 70

    count = model.count
    puts "Total records: #{count}"

    if count == 0
      puts "  No records to sync"
      return { synced: 0, errors: 0 }
    end

    synced = 0
    errors = 0

    organization = Organization.first
    provider = DocumentProviders::S3Compatible.for_organization(organization) rescue nil

    unless provider
      puts "  ERROR: No S3 provider configured"
      return { synced: 0, errors: count }
    end

    model.find_each.with_index do |record, index|
      if (index + 1) % 10 == 0 || index == 0
        puts "  Progress: #{index + 1}/#{count}"
      end

      begin
        # SSoT: Use model's warehouse_path method which includes ID for uniqueness
        full_path = record.warehouse_path

        if execute
          # SSoT: Use WarehouseSyncable concern's sync method
          result = record.sync_to_warehouse!
          if result[:success]
            synced += 1
          else
            puts "    SKIP #{record.id}: #{result[:error]}"
          end
        else
          # Dry run - just show what would happen
          display_name = record.respond_to?(:name) ? record.name : record.file_name
          if index < 5
            puts "    Would save: #{display_name}"
            puts "            to: #{full_path}"
          elsif index == 5
            puts "    ... and #{count - 5} more"
          end
          synced += 1
        end
      rescue StandardError => e
        puts "    ERROR #{record.id}: #{e.message}"
        errors += 1
      end
    end

    { synced: synced, errors: errors }
  end

  def generate_file_content(record, type)
    case type
    when "TeeemSpreadsheet"
      generate_xlsx_content(record)
    when "TeeemDocument"
      generate_html_content(record)
    when "TeeemPresentation"
      generate_pptx_content(record)
    when "TeeemPdf"
      generate_pdf_content(record)
    when "NotebookPageAttachment"
      generate_notes_content(record)
    else
      nil
    end
  end

  def generate_xlsx_content(spreadsheet)
    workbook = TeeemXl::Models::Workbook.new

    spreadsheet.data["sheets"]&.each do |sheet_data|
      sheet = workbook.add_sheet(sheet_data["name"] || "Sheet1")
      cells = sheet_data["cells"] || {}
      rows = cells_to_rows(cells)
      rows.each { |row| sheet.add_row(row) }
    end

    temp_file = Tempfile.new(["spreadsheet", ".xlsx"])
    begin
      TeeemXl.write(workbook, temp_file.path)
      temp_file.rewind
      File.read(temp_file.path)
    ensure
      temp_file&.close
      temp_file&.unlink
    end
  end

  def generate_html_content(document)
    # Export TipTap content as HTML
    content = document.data["content"] || "<p></p>"
    page_settings = document.data["pageSettings"] || {}

    <<~HTML
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>#{document.name}</title>
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

  def generate_pptx_content(presentation)
    # For now, export as JSON (proper PPTX generation would require pptx gem)
    # This is a placeholder - in production you'd use a proper PPTX generator
    presentation.data.to_json
  end

  def generate_pdf_content(pdf)
    # Export TeeemPdf as actual PDF using Prawn
    require "prawn"

    Prawn::Document.new(page_size: "LETTER") do |doc|
      pdf.data["pages"]&.each_with_index do |page_data, page_index|
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
    pdf.data.to_json
  end

  def generate_notes_content(attachment)
    # NotebookPageAttachment uses ActiveStorage - get the file content
    if attachment.file.attached?
      attachment.file.download
    else
      nil
    end
  end

  def cells_to_rows(cells)
    return [] if cells.empty?

    # Find max row and column
    max_row = 0
    max_col = 0

    cells.each_key do |cell_ref|
      col_letter = cell_ref.gsub(/\d/, "")
      row_num = cell_ref.gsub(/[A-Z]/i, "").to_i

      col_num = col_letter_to_number(col_letter)
      max_row = [max_row, row_num].max
      max_col = [max_col, col_num].max
    end

    # Build rows array
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

  def mime_type_for(ext)
    case ext
    when ".xlsx"
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    when ".html"
      "text/html"
    when ".pptx"
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    else
      "application/octet-stream"
    end
  end
end
