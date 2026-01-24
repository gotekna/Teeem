# frozen_string_literal: true

# UnifiedDocumentGenerator routes document generation to the appropriate engine
# based on the template's template_type field.
#
# This provides a single entry point for all document generation using
# HTML/ERB templates or PDF overlay.
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
#     template_type: "html" | "pdf_overlay"
#   }
#
# Note: Word templates were removed in December 2024.
# Use TeknaDocumentGenerator for new document generation.
#
class UnifiedDocumentGenerator
  class GenerationError < StandardError; end
  class UnsupportedTypeError < StandardError; end
  class CredentialError < StandardError; end
  class TemplateError < StandardError; end

  attr_reader :template

  def initialize(template)
    @template = template
  end

  # Generate document using the appropriate engine
  def generate(job: nil, contact: nil, invoice: nil, claim_stage: nil, extra_data: {})
    result = case template.template_type
    when "word", "sharepoint_fetch"
      raise UnsupportedTypeError, "Word templates are no longer supported. Use TeknaDocumentGenerator instead."
    when "html"
      generate_html(job: job, contact: contact, extra_data: extra_data)
    when "pdf_overlay"
      generate_pdf_overlay(job: job, contact: contact, extra_data: extra_data)
    else
      raise UnsupportedTypeError, "Unknown template_type: #{template.template_type}"
    end

    result.merge(template_type: template.template_type)
  end

  # Generate and upload to destination folder
  def generate_and_upload(job: nil, contact: nil, extra_data: {}, destination_folder:)
    case template.template_type
    when "word", "sharepoint_fetch"
      raise UnsupportedTypeError, "Word templates are no longer supported. Use TeknaDocumentGenerator instead."
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

    # SSoT: Use DocumentProviders for provider-agnostic upload
    provider = DocumentProviders.for_organization(Organization.first)
    filename = result[:filename] || result[:pdf_filename]

    uploaded_file = provider.upload_file(
      destination_folder,
      result[:pdf_content],
      filename,
      content_type: "application/pdf"
    )

    result.merge(
      uploaded_files: [uploaded_file.merge(type: "pdf")]
    )
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.error("Credential decryption failed during upload: #{e.message}")
    raise CredentialError, "Storage credentials expired. Please reconnect storage provider."
  end
end
