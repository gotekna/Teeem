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
