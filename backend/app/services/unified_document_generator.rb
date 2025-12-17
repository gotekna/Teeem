# frozen_string_literal: true

# UnifiedDocumentGenerator routes document generation to the appropriate engine
# based on the template's template_type field.
#
# This provides a single entry point for all document generation, whether the
# template is a Word file from SharePoint, an HTML/ERB template, or a PDF overlay.
#
# Usage:
#   generator = UnifiedDocumentGenerator.new(template)
#   result = generator.generate(job: job, contact: contact)
#
# Returns a consistent hash:
#   {
#     pdf_content: <binary>,
#     filename: "document.pdf",
#     generated_at: Time,
#     template_type: "word" | "html" | etc
#   }
#
class UnifiedDocumentGenerator
  class GenerationError < StandardError; end
  class UnsupportedTypeError < StandardError; end

  attr_reader :template

  def initialize(template)
    @template = template
  end

  # Generate document using the appropriate engine
  def generate(job: nil, contact: nil, invoice: nil, claim_stage: nil, extra_data: {})
    result = case template.template_type
    when "word"
      generate_word(job: job, contact: contact, invoice: invoice, claim_stage: claim_stage, extra_data: extra_data)
    when "html"
      generate_html(job: job, contact: contact, extra_data: extra_data)
    when "pdf_overlay"
      generate_pdf_overlay(job: job, contact: contact, extra_data: extra_data)
    when "sharepoint_fetch"
      fetch_from_sharepoint(job: job)
    else
      raise UnsupportedTypeError, "Unknown template_type: #{template.template_type}"
    end

    result.merge(template_type: template.template_type)
  end

  # Generate and upload to destination folder
  def generate_and_upload(job: nil, contact: nil, extra_data: {}, destination_folder:)
    case template.template_type
    when "word"
      # Word templates have built-in upload support
      Engines::WordDocumentEngine.new(template).generate_and_upload(
        job: job,
        contact: contact,
        extra_data: extra_data,
        destination_folder: destination_folder
      )
    when "html"
      # Generate HTML template then upload manually
      result = generate_html(job: job, contact: contact, extra_data: extra_data)
      upload_result(result, destination_folder: destination_folder)
    else
      # Other types: generate then upload
      result = generate(job: job, contact: contact, extra_data: extra_data)
      upload_result(result, destination_folder: destination_folder)
    end
  end

  private

  def generate_word(job:, contact:, invoice:, claim_stage:, extra_data:)
    Engines::WordDocumentEngine.new(template).generate(
      job: job,
      contact: contact,
      invoice: invoice,
      claim_stage: claim_stage,
      extra_data: extra_data
    )
  end

  def generate_html(job:, contact:, extra_data:)
    Engines::HtmlDocumentEngine.new(template).generate(
      job: job,
      contact: contact,
      extra_data: extra_data
    )
  end

  def generate_pdf_overlay(job:, contact:, extra_data:)
    # Future implementation for HIA documents
    Engines::PdfOverlayEngine.new(template).generate(
      job: job,
      contact: contact,
      extra_data: extra_data
    )
  end

  def fetch_from_sharepoint(job:)
    Engines::SharepointFetchEngine.new(template).fetch(job: job)
  end

  def upload_result(result, destination_folder:)
    return result unless result[:pdf_content]

    # Use Microsoft Graph client to upload
    graph_client = MicrosoftAppGraphClient.new
    site_id = template.sharepoint_site_id
    drive_id = template.sharepoint_drive_id

    uploaded_file = graph_client.upload_file_content(
      site_id,
      drive_id,
      destination_folder,
      result[:filename] || result[:pdf_filename],
      result[:pdf_content]
    )

    result.merge(
      uploaded_files: [uploaded_file.merge(type: "pdf")]
    )
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.error("Microsoft credential decryption failed during upload: #{e.message}")
    raise DocumentGenerator::CredentialError, "Microsoft credentials expired. Please reconnect OneDrive."
  end
end
