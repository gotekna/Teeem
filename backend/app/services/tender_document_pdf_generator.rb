# frozen_string_literal: true

# TenderDocumentPdfGenerator - Generates professional tender PDFs from TenderDocument records.
#
# Uses TeknaTemplateRenderer to render ERB templates with the Tekna branded layout,
# then Grover to convert to PDF.
#
# Usage:
#   generator = TenderDocumentPdfGenerator.new(tender_document)
#   result = generator.generate
#   # result[:pdf_content] - PDF binary
#   # result[:filename] - "TD-000001_v1_JobName.pdf"
#
class TenderDocumentPdfGenerator
  TEMPLATE_PATH = "templates/tender_document"
  LAYOUT_PATH = "layouts/tekna"

  def initialize(tender_document)
    @doc = tender_document
    @job = tender_document.job
  end

  def generate
    html = render_html
    pdf_content = convert_to_pdf(html)

    {
      pdf_content: pdf_content,
      filename: generate_filename,
      html: html
    }
  end

  def preview
    render_html
  end

  private

  def render_html
    renderer = TeknaTemplateRenderer.new
    renderer.render(
      template_path: TEMPLATE_PATH,
      layout: LAYOUT_PATH,
      locals: build_context
    )
  end

  def build_context
    sections = @doc.sections_grouped
    section_subtotals = @doc.section_subtotals
    image_urls = build_image_urls(sections)

    {
      # Document info
      tender_document: @doc,
      document_number: @doc.document_number,
      version: @doc.version,
      date_prepared: @doc.date_prepared&.strftime("%d/%m/%Y"),
      valid_until: @doc.valid_until&.strftime("%d/%m/%Y"),

      # Job info (snapshotted)
      job_name: @doc.job_name,
      job_address: @doc.job_address,
      job_code: @doc.job_code,

      # Client info (snapshotted)
      client_name: @doc.client_name,
      client_address: @doc.client_address,
      client_email: @doc.client_email,
      client_phone: @doc.client_phone,
      salesperson_name: @doc.salesperson_name,

      # Sections and items
      sections: sections,
      section_subtotals: section_subtotals,
      section_names: sections.keys,

      # Pricebook item images: { item_id => { thumbnail_url:, full_url: } }
      image_urls: image_urls,

      # Totals
      subtotal: @doc.subtotal,
      gst: @doc.gst,
      total: @doc.total,

      # Text sections
      cover_letter_html: @doc.cover_letter_html,
      terms_and_conditions_html: @doc.terms_and_conditions_html,
      base_specification_html: @doc.base_specification_html,
      acceptance_page_html: @doc.acceptance_page_html,
      notes_html: @doc.notes_html,

      # Company branding
      company: build_company_context,

      # Helpers
      generated_date: Date.current.strftime("%d/%m/%Y"),
      current_year: Date.current.year.to_s,

      # Template info
      document_title: "Tender"
    }
  end

  # Resolve presigned image URLs for pricebook items that have images.
  # Returns: { tender_document_item_id => { thumbnail_url: "...", full_url: "..." } }
  # Uses long-lived presigned URLs (7 days) since PDFs are generated asynchronously.
  def build_image_urls(sections)
    # Collect all items with pricebook_item_id
    all_items = sections.values.flatten
    items_with_pricebook = all_items.select { |item| item.pricebook_item_id.present? }
    return {} if items_with_pricebook.empty?

    # Batch load pricebook items with their image blobs
    pricebook_ids = items_with_pricebook.map(&:pricebook_item_id).uniq
    pricebook_items = PricebookItem.where(id: pricebook_ids)
                                   .includes(:image_storage_blob)
                                   .index_by(&:id)

    urls = {}
    items_with_pricebook.each do |item|
      pb = pricebook_items[item.pricebook_item_id]
      next unless pb&.image_storage_blob

      blob = pb.image_storage_blob
      # Generate presigned URL valid for 7 days (PDF generation + viewing)
      full_url = blob.presigned_url(expires_in: 7.days.to_i, disposition: :inline)

      urls[item.id] = {
        thumbnail_url: full_url,
        full_url: full_url
      }
    rescue StandardError => e
      Rails.logger.warn "[TenderDocumentPdfGenerator] Failed to get image URL for item #{item.id}: #{e.message}"
      next
    end

    urls
  end

  def build_company_context
    settings = TenantSetting.instance
    {
      name: settings&.company_name || "Company",
      abn: settings&.abn,
      acn: settings&.acn,
      phone: settings&.phone,
      email: settings&.email,
      address: settings&.address,
      logo_url: settings&.logo_url,
      qbcc_licence: settings&.qbcc_licence_number,
      website: settings&.website
    }
  end

  def convert_to_pdf(html)
    raise "Grover (PDF generation) is only available on the worker dyno." unless defined?(Grover)

    Grover.new(html, **grover_options).to_pdf
  end

  def grover_options
    {
      format: "A4",
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
      print_background: true,
      prefer_css_page_size: true,
      display_header_footer: false,
      launch_args: ["--no-sandbox", "--disable-dev-shm-usage"]
    }
  end

  def generate_filename
    job_slug = @doc.job_name.to_s.parameterize.presence || "draft"
    "#{@doc.document_number}_v#{@doc.version}_#{job_slug}.pdf"
  end
end
