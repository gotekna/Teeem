# frozen_string_literal: true

require "sablon"
require "tempfile"

# DocumentGenerator generates documents from Word templates using Sablon mail merge.
#
# Usage:
#   generator = DocumentGenerator.new(template)
#   result = generator.generate(job: job, contact: contact)
#   # result[:docx_content] - DOCX binary content
#   # result[:pdf_content] - PDF binary content (if output_format includes pdf)
#   # result[:filename] - Generated filename
#
class DocumentGenerator
  class GenerationError < StandardError; end
  class TemplateError < StandardError; end

  attr_reader :template, :graph_client

  def initialize(template, graph_client: nil)
    @template = template
    @graph_client = graph_client || MicrosoftAppGraphClient.new
  end

  # Generate document from template with provided data
  # Returns hash with :docx_content, :pdf_content (if applicable), :filename
  def generate(job: nil, contact: nil, extra_data: {})
    validate_inputs!(job, contact)

    # Build context data for Sablon
    context = build_context(job: job, contact: contact, extra_data: extra_data)

    # Download template from SharePoint
    template_content = download_template

    # Perform mail merge with Sablon
    docx_content = perform_mail_merge(template_content, context)

    # Generate output filename
    filename = template.generate_output_filename(job: job, contact: contact)

    result = {
      docx_content: docx_content,
      filename: filename,
      generated_at: Time.current
    }

    # Convert to PDF if needed
    if template.output_format.in?(%w[pdf both])
      pdf_content = convert_to_pdf(docx_content)
      result[:pdf_content] = pdf_content
      result[:pdf_filename] = filename.sub(/\.docx$/, ".pdf")
    end

    result
  end

  # Generate and upload to SharePoint
  # Returns hash with SharePoint file info
  def generate_and_upload(job: nil, contact: nil, extra_data: {}, destination_folder:)
    result = generate(job: job, contact: contact, extra_data: extra_data)

    # Get SharePoint credentials from template
    site_id = template.sharepoint_site_id
    drive_id = template.sharepoint_drive_id

    uploaded_files = []

    # Upload DOCX if output format is docx or both
    if template.output_format.in?(%w[docx both])
      docx_file = graph_client.upload_file_content(
        site_id,
        drive_id,
        destination_folder,
        result[:filename].sub(/\.pdf$/, ".docx"),
        result[:docx_content]
      )
      uploaded_files << docx_file.merge(type: "docx")
    end

    # Upload PDF if output format is pdf or both
    if template.output_format.in?(%w[pdf both]) && result[:pdf_content]
      pdf_file = graph_client.upload_file_content(
        site_id,
        drive_id,
        destination_folder,
        result[:pdf_filename] || result[:filename],
        result[:pdf_content]
      )
      uploaded_files << pdf_file.merge(type: "pdf")
    end

    result.merge(uploaded_files: uploaded_files)
  end

  private

  def validate_inputs!(job, contact)
    case template.category
    when "job"
      raise GenerationError, "Job is required for this template" unless job
    when "contact"
      raise GenerationError, "Contact is required for this template" unless contact
    when "quote", "contract"
      raise GenerationError, "Job is required for this template" unless job
    end
  end

  def download_template
    unless template.sharepoint_linked?
      raise TemplateError, "Template is not linked to a SharePoint file"
    end

    graph_client.get_drive_item_content(
      site_id: template.sharepoint_site_id,
      drive_id: template.sharepoint_drive_id,
      item_id: template.sharepoint_item_id
    )
  rescue MicrosoftAppGraphClient::ApiError => e
    raise TemplateError, "Failed to download template: #{e.message}"
  end

  def perform_mail_merge(template_content, context)
    # Create temp file for template
    template_file = Tempfile.new([ "template", ".docx" ])
    template_file.binmode
    template_file.write(template_content)
    template_file.close

    # Create temp file for output
    output_file = Tempfile.new([ "output", ".docx" ])
    output_file.close

    begin
      # Use Sablon for mail merge
      sablon_template = Sablon.template(template_file.path)
      sablon_template.render_to_file(output_file.path, context)

      # Read generated content
      File.binread(output_file.path)
    rescue StandardError => e
      raise GenerationError, "Mail merge failed: #{e.message}"
    ensure
      template_file.unlink
      output_file.unlink
    end
  end

  def convert_to_pdf(docx_content)
    # Upload temporary DOCX to SharePoint, convert to PDF, then delete
    temp_filename = "temp_#{SecureRandom.hex(8)}.docx"
    site_id = template.sharepoint_site_id
    drive_id = template.sharepoint_drive_id

    # Upload temp file
    uploaded = graph_client.upload_file_content(
      site_id,
      drive_id,
      "Temp",
      temp_filename,
      docx_content
    )

    begin
      # Convert to PDF via Microsoft Graph
      pdf_content = graph_client.convert_to_pdf(
        site_id: site_id,
        drive_id: drive_id,
        item_id: uploaded[:id]
      )
      pdf_content
    ensure
      # Delete temp file
      graph_client.delete_drive_item(
        site_id: site_id,
        drive_id: drive_id,
        item_id: uploaded[:id]
      )
    end
  rescue MicrosoftAppGraphClient::ApiError => e
    raise GenerationError, "PDF conversion failed: #{e.message}"
  end

  def build_context(job: nil, contact: nil, extra_data: {})
    context = Sablon.content({})

    # Add job data
    if job
      context[:job] = build_job_context(job)
    end

    # Add contact data
    if contact
      context[:contact] = build_contact_context(contact)
    end

    # Add job contacts if available
    if job
      context[:client_1] = build_contact_context(job.primary_contact) if job.respond_to?(:primary_contact) && job.primary_contact
      context[:client_2] = build_contact_context(job.secondary_contact) if job.respond_to?(:secondary_contact) && job.secondary_contact
      context[:builder] = build_contact_context(job.builder_contact) if job.respond_to?(:builder_contact) && job.builder_contact
    end

    # Add extra data
    extra_data.each do |key, value|
      context[key] = value
    end

    # Add common fields
    context[:generated_date] = Date.current.strftime("%d/%m/%Y")
    context[:generated_datetime] = Time.current.strftime("%d/%m/%Y %I:%M %p")
    context[:current_year] = Date.current.year.to_s

    context
  end

  def build_job_context(job)
    {
      # Core fields
      job_number: job.job_number,
      title: job.title,
      address: job.address,
      suburb: job.suburb,
      state: job.state,
      postcode: job.postcode,
      full_address: [ job.address, job.suburb, job.state, job.postcode ].compact.join(", "),
      status: job.status&.humanize,

      # Contract details
      contract_price: format_currency(job.contract_price),
      contract_price_raw: job.contract_price,
      contract_price_ex_gst: format_currency(job.try(:contract_price_ex_gst)),
      deposit: format_currency(job.try(:deposit)),
      deposit_percentage: job.try(:deposit_percentage),
      build_period: job.try(:build_period),
      build_period_weeks: job.try(:build_period_weeks),

      # Dates
      contract_date: format_date(job.contract_date),
      practical_completion_date: format_date(job.practical_completion_date),
      site_start_date: format_date(job.site_start_date),

      # Property details
      lot_number: job.lot_number,
      lot: job.lot_number, # Alias for Compoza compatibility
      plan_number: job.plan_number,
      plan_sp_number: job.plan_number, # Alias for Compoza compatibility
      council: job.try(:council),

      # Builder info
      builder_brand: job.try(:builder_brand),
      builder_licence: job.try(:builder_licence),
      builder_abn: job.try(:builder_abn),

      description: job.description
    }
  end

  def build_contact_context(contact)
    return {} unless contact

    {
      # Name fields
      display_name: contact.display_name,
      full_name: contact.display_name, # Alias for Compoza compatibility
      first_name: contact.first_name,
      last_name: contact.last_name,
      name: contact.display_name, # Short alias

      # Contact details
      email: contact.email,
      phone: contact.phone,
      mobile: contact.mobile,

      # Business details
      company_name: contact.company_name,
      abn: contact.abn,

      # Address
      address_line_1: contact.address_line_1,
      address_line_2: contact.address_line_2,
      suburb: contact.suburb,
      state: contact.state,
      postcode: contact.postcode,
      full_address: build_full_address(contact)
    }
  end

  def build_full_address(contact)
    parts = [ contact.address_line_1 ]
    parts << contact.address_line_2 if contact.address_line_2.present?
    parts << [ contact.suburb, contact.state, contact.postcode ].compact.join(" ")
    parts.compact.join(", ")
  end

  def format_currency(amount)
    return "" unless amount
    "$#{'%.2f' % amount}"
  end

  def format_date(date)
    return "" unless date
    date.strftime("%d/%m/%Y")
  end
end
