# frozen_string_literal: true

module Engines
  # PdfOverlayEngine handles PDF form filling for documents that must maintain
  # exact original format (e.g., HIA contracts).
  #
  # Future implementation - will use PDFtk or similar for form filling.
  #
  class PdfOverlayEngine
    class NotImplementedError < StandardError; end

    attr_reader :template

    def initialize(template)
      @template = template
    end

    def generate(job: nil, contact: nil, extra_data: {})
      # TODO: Implement PDF form filling for HIA documents
      # This will:
      # 1. Download the original PDF template from SharePoint
      # 2. Use PDFtk or HexaPDF to fill form fields
      # 3. Return the filled PDF

      raise NotImplementedError, "PDF overlay generation is not yet implemented. " \
        "This feature is planned for HIA document support. " \
        "Template: #{template.name}"
    end
  end
end
