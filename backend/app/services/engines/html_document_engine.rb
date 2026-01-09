# frozen_string_literal: true

module Engines
  # HtmlDocumentEngine wraps TeknaDocumentGenerator for HTML/ERB templates.
  # Uses Grover (Puppeteer) for HTML→PDF conversion.
  #
  class HtmlDocumentEngine
    attr_reader :template

    def initialize(template)
      @template = template
    end

    def generate(job: nil, contact: nil, extra_data: {})
      # Map template to TeknaDocumentGenerator template key
      template_key = determine_template_key

      generator = TeknaDocumentGenerator.new(template_key)
      result = generator.generate(
        job: job,
        contact: contact,
        extra_data: extra_data
      )

      # Normalize result format
      {
        pdf_content: result[:pdf_content],
        html_content: result[:html],
        filename: result[:filename] || "#{template.name.parameterize}_#{Date.current.strftime('%Y%m%d')}.pdf",
        generated_at: result[:generated_at] || Time.current
      }
    end

    private

    def determine_template_key
      # Use local_template_path if set, otherwise derive from name
      if template.local_template_path.present?
        # Convert path to key format: "templates/welcome_letter" -> :welcome_letter
        path = template.local_template_path
        path = path.sub(%r{^templates/}, "")
        path = path.sub(%r{^qbcc/}, "qbcc_")
        path.to_sym
      else
        # Derive from template name
        template.name.parameterize.underscore.to_sym
      end
    end
  end
end
