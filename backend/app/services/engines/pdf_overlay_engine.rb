# frozen_string_literal: true

require "hexapdf"

module Engines
  # PdfOverlayEngine handles PDF form filling and text overlay for documents
  # that must maintain exact original format (e.g., QBCC contracts, HIA documents).
  #
  # Uses HexaPDF for PDF manipulation:
  # - Form field filling (AcroForm)
  # - Text overlay at specific coordinates
  # - Page stamping
  #
  # ============================================================================
  # SSoT: Official PDF templates stored in app/views/tekna_documents/templates/qbcc/
  # ============================================================================
  #
  class PdfOverlayEngine
    class OverlayError < StandardError; end
    class TemplateNotFoundError < OverlayError; end

    # Field mappings for QBCC documents
    # Maps our data fields to PDF form field names or overlay positions
    QBCC_CONTRACT_FIELDS = {
      # Contract details
      contract_date: { type: :text, page: 1, x: 400, y: 720, size: 10 },
      contract_price: { type: :text, page: 1, x: 400, y: 680, size: 10 },

      # Builder details
      builder_name: { type: :text, page: 1, x: 150, y: 620, size: 10 },
      builder_abn: { type: :text, page: 1, x: 150, y: 600, size: 10 },
      builder_qbcc: { type: :text, page: 1, x: 150, y: 580, size: 10 },
      builder_address: { type: :text, page: 1, x: 150, y: 560, size: 10 },
      builder_phone: { type: :text, page: 1, x: 150, y: 540, size: 10 },
      builder_email: { type: :text, page: 1, x: 150, y: 520, size: 10 },

      # Owner details
      owner_name: { type: :text, page: 1, x: 400, y: 620, size: 10 },
      owner_address: { type: :text, page: 1, x: 400, y: 600, size: 10 },
      owner_phone: { type: :text, page: 1, x: 400, y: 580, size: 10 },
      owner_email: { type: :text, page: 1, x: 400, y: 560, size: 10 },

      # Site details
      site_address: { type: :text, page: 1, x: 150, y: 480, size: 10 },
      lot_number: { type: :text, page: 1, x: 150, y: 460, size: 10 },
      plan_number: { type: :text, page: 1, x: 300, y: 460, size: 10 }
    }.freeze

    QBCC_CONSUMER_GUIDE_FIELDS = {
      # Minimal fields - mostly informational document
      builder_name: { type: :text, page: 1, x: 150, y: 100, size: 10 },
      builder_qbcc: { type: :text, page: 1, x: 350, y: 100, size: 10 },
      date: { type: :text, page: 1, x: 480, y: 100, size: 10 }
    }.freeze

    QBCC_GENERAL_CONDITIONS_FIELDS = {
      # Reference fields only (text overlay)
      contract_date: { type: :text, page: 1, x: 400, y: 50, size: 8 },
      job_reference: { type: :text, page: 1, x: 150, y: 50, size: 8 }
    }.freeze

    # AcroForm field mappings for QBCC General Conditions page 16
    # Maps our data keys to PDF form field names
    QBCC_GENERAL_CONDITIONS_FORM_FIELDS = {
      # Page 16 - Personal Contacts section (YOUR PERSONAL CONTACTS)
      # Row 4: Building Contractor
      builder_name: "Text Field 10218",          # Building Contractor Name
      builder_phone: "Text Field 10219",         # Building Contractor Phone
      builder_qbcc: "Text Field 10220",          # Building Contractor QBCC License

      # Row 5: Site Supervisor
      site_supervisor_name: "Text Field 10221",  # Site Supervisor Name
      site_supervisor_phone: "Text Field 10222"  # Site Supervisor Phone
    }.freeze

    attr_reader :template_key, :pdf_path

    def initialize(template_key)
      @template_key = template_key.to_sym
      @pdf_path = resolve_pdf_path
    end

    # Generate filled PDF
    # Returns binary PDF content
    def generate(job: nil, contact: nil, extra_data: {})
      unless File.exist?(pdf_path)
        raise TemplateNotFoundError, "PDF template not found: #{pdf_path}"
      end

      # Build data context
      data = build_data_context(job: job, contact: contact, extra_data: extra_data)

      # Get field mapping for this template
      field_mapping = field_mapping_for_template

      # Open PDF and apply overlays
      doc = HexaPDF::Document.open(pdf_path)

      # Try form filling first (if PDF has AcroForm fields)
      fill_form_fields(doc, data)

      # Then apply text overlays for any remaining fields
      apply_text_overlays(doc, data, field_mapping)

      # Return PDF content
      io = StringIO.new
      doc.write(io, optimize: true)
      io.string
    end

    # Check if template has PDF overlay support
    def self.supports_template?(template_key)
      pdf_templates.include?(template_key.to_sym)
    end

    # List of templates that use PDF overlay
    def self.pdf_templates
      %i[qbcc_contract qbcc_consumer_guide qbcc_general_conditions]
    end

    private

    def resolve_pdf_path
      base_path = Rails.root.join("app/views/tekna_documents/templates/qbcc")

      case template_key
      when :qbcc_contract
        base_path.join("qbcc_contract.pdf")
      when :qbcc_consumer_guide
        base_path.join("qbcc_consumer_guide.pdf")
      when :qbcc_general_conditions
        base_path.join("qbcc_general_conditions.pdf")
      else
        raise TemplateNotFoundError, "Unknown PDF template: #{template_key}"
      end
    end

    def field_mapping_for_template
      case template_key
      when :qbcc_contract
        QBCC_CONTRACT_FIELDS
      when :qbcc_consumer_guide
        QBCC_CONSUMER_GUIDE_FIELDS
      when :qbcc_general_conditions
        QBCC_GENERAL_CONDITIONS_FIELDS
      else
        {}
      end
    end

    def build_data_context(job:, contact:, extra_data:)
      data = extra_data.symbolize_keys

      if job
        # Company/builder info
        settings = ::CorporateCompanySetting.instance
        data[:builder_name] ||= settings.company_name
        data[:builder_abn] ||= format_abn(settings.abn)
        data[:builder_qbcc] ||= settings.qbcc_license
        data[:builder_address] ||= settings.address
        data[:builder_phone] ||= settings.phone
        data[:builder_email] ||= settings.email

        # Job/site info
        data[:site_address] ||= job.address
        data[:lot_number] ||= job.try(:lot_number)
        data[:plan_number] ||= job.try(:plan_number)
        data[:job_reference] ||= job.job_number || job.id.to_s

        # Contract info
        data[:contract_date] ||= format_date(job.try(:contract_date) || Date.current)
        data[:contract_price] ||= format_currency(job.try(:contract_price))

        # Owner info from primary contact
        primary = job.try(:primary_contact)
        if primary
          data[:owner_name] ||= primary.full_name
          data[:owner_address] ||= primary.try(:address)
          data[:owner_phone] ||= primary.try(:phone)
          data[:owner_email] ||= primary.try(:email)
        end

        # Add secondary contact if exists
        secondary = job.try(:secondary_contact)
        if secondary
          existing_name = data[:owner_name]
          data[:owner_name] = "#{existing_name} & #{secondary.full_name}" if existing_name
        end

        # Site supervisor info (from job columns)
        data[:site_supervisor_name] ||= job.site_supervisor_name
        data[:site_supervisor_phone] ||= job.site_supervisor_phone
      end

      data[:date] ||= format_date(Date.current)

      data
    end

    def fill_form_fields(doc, data)
      return unless doc.acro_form

      # Get explicit field mapping for this template
      explicit_mapping = form_field_mapping_for_template

      doc.acro_form.each_field do |field|
        pdf_field_name = field.full_field_name.to_s
        value = nil

        # First check explicit mapping (data_key -> pdf_field_name)
        explicit_mapping.each do |data_key, mapped_field_name|
          if mapped_field_name == pdf_field_name && data.key?(data_key)
            value = data[data_key]
            break
          end
        end

        # Fall back to generic name matching if no explicit mapping found
        if value.nil?
          generic_key = pdf_field_name.downcase.gsub(/[^a-z0-9]/, "_").to_sym
          value = data[generic_key] if data.key?(generic_key)
        end

        if value.present?
          field.field_value = value.to_s
          Rails.logger.debug "[PdfOverlayEngine] Filled '#{pdf_field_name}' with '#{value}'"
        end
      end
    rescue StandardError => e
      Rails.logger.warn "[PdfOverlayEngine] Form fill error: #{e.message}"
    end

    def form_field_mapping_for_template
      case template_key
      when :qbcc_general_conditions
        QBCC_GENERAL_CONDITIONS_FORM_FIELDS
      else
        {}
      end
    end

    def apply_text_overlays(doc, data, field_mapping)
      field_mapping.each do |field_name, config|
        value = data[field_name]
        next if value.blank?

        page_index = (config[:page] || 1) - 1
        page = doc.pages[page_index]
        next unless page

        canvas = page.canvas(type: :overlay)
        canvas.font("Helvetica", size: config[:size] || 10)
        canvas.text(value.to_s, at: [config[:x], config[:y]])
      end
    rescue StandardError => e
      Rails.logger.error "[PdfOverlayEngine] Text overlay error: #{e.message}"
      raise OverlayError, "Failed to apply text overlay: #{e.message}"
    end

    def format_date(date)
      return "" unless date
      date.strftime("%d/%m/%Y")
    end

    def format_currency(amount)
      return "" unless amount
      "$#{format('%.2f', amount.to_f).reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse}"
    end

    def format_abn(abn)
      return "" unless abn
      abn.to_s.gsub(/\D/, "").gsub(/(\d{2})(\d{3})(\d{3})(\d{3})/, '\1 \2 \3 \4')
    end
  end
end
