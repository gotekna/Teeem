# frozen_string_literal: true

# Parses PDF form fields (AcroForms) to detect field positions and sizes
# Used by PDF Field Editor to show clickable hotspots for mapping data fields
class PdfFormParserService
  PDF_TEMPLATES = {
    "qbcc_contract" => "app/views/tekna_documents/templates/qbcc/qbcc_contract.pdf",
    "qbcc_consumer_guide" => "app/views/tekna_documents/templates/qbcc/qbcc_consumer_guide.pdf",
    "qbcc_general_conditions" => "app/views/tekna_documents/templates/qbcc/qbcc_general_conditions.pdf"
  }.freeze

  def self.parse(template_key)
    new(template_key).parse
  end

  def initialize(template_key)
    @template_key = template_key
  end

  def parse
    path = pdf_path
    return { success: false, error: "Template not found: #{@template_key}" } unless path && File.exist?(path)

    require "hexapdf"
    pdf = HexaPDF::Document.open(path)

    acro_form = pdf.acro_form
    unless acro_form
      return {
        success: true,
        detected_fields: [],
        message: "No form fields found in PDF (not an AcroForm)"
      }
    end

    fields = []
    acro_form.each_field do |field|
      field_data = extract_field_data(pdf, field)
      fields << field_data if field_data
    end

    {
      success: true,
      detected_fields: fields,
      total_count: fields.count,
      pages: fields.map { |f| f[:page] }.uniq.sort
    }
  rescue StandardError => e
    Rails.logger.error("[PdfFormParserService] Error parsing PDF: #{e.message}")
    { success: false, error: e.message }
  end

  private

  def pdf_path
    relative_path = PDF_TEMPLATES[@template_key]
    return nil unless relative_path

    Rails.root.join(relative_path).to_s
  end

  def extract_field_data(pdf, field)
    rect = field[:Rect]
    return nil unless rect

    # Rect is [x1, y1, x2, y2] in PDF coordinates (origin at bottom-left)
    x1, y1, x2, y2 = rect.map(&:to_f)

    # Find which page this field belongs to
    page_number = find_page_number(pdf, field)

    {
      name: field.full_field_name,
      type: field_type_string(field),
      page: page_number,
      x: x1.round(2),
      y: y1.round(2),
      width: (x2 - x1).round(2),
      height: (y2 - y1).round(2),
      # Additional metadata for UI
      is_text: field.field_type == :Tx,
      is_checkbox: field.field_type == :Btn,
      is_dropdown: field.field_type == :Ch
    }
  end

  def field_type_string(field)
    case field.field_type
    when :Tx then "text"
    when :Btn then "checkbox"
    when :Ch then "dropdown"
    else field.field_type.to_s
    end
  end

  def find_page_number(pdf, field)
    # Walk up the widget annotation to find the page
    widget = field[:Kids]&.first || field

    # Try to find page through parent references
    page = widget[:P]
    if page
      pdf.pages.each_with_index do |p, idx|
        return idx + 1 if p == page
      end
    end

    # Fallback: search all pages for this annotation
    pdf.pages.each_with_index do |page_obj, idx|
      annots = page_obj[:Annots]
      next unless annots

      annots.each do |annot|
        return idx + 1 if annot == widget || annot == field
      end
    end

    1 # Default to page 1 if not found
  end
end
