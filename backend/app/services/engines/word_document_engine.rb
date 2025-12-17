# frozen_string_literal: true

module Engines
  # WordDocumentEngine wraps the existing DocumentGenerator for Word templates
  # stored in SharePoint. Uses Sablon for mail-merge and Microsoft Graph for PDF conversion.
  #
  class WordDocumentEngine
    attr_reader :template

    def initialize(template)
      @template = template
    end

    def generate(job: nil, contact: nil, invoice: nil, claim_stage: nil, extra_data: {})
      generator = DocumentGenerator.new(template)
      result = generator.generate(
        job: job,
        contact: contact,
        invoice: invoice,
        claim_stage: claim_stage,
        extra_data: extra_data
      )

      # Normalize result format
      {
        pdf_content: result[:pdf_content],
        docx_content: result[:docx_content],
        filename: result[:pdf_filename] || result[:filename],
        docx_filename: result[:filename],
        generated_at: result[:generated_at] || Time.current
      }
    end

    def generate_and_upload(job: nil, contact: nil, extra_data: {}, destination_folder:)
      generator = DocumentGenerator.new(template)
      generator.generate_and_upload(
        job: job,
        contact: contact,
        extra_data: extra_data,
        destination_folder: destination_folder
      )
    end
  end
end
