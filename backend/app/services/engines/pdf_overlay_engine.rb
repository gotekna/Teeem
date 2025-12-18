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

    # Field mappings for QBCC documents - text overlay positions (only used if no form fields)
    QBCC_CONTRACT_FIELDS = {}.freeze  # Contract uses AcroForm fields, not text overlay

    # AcroForm field mappings for QBCC Contract page 1
    # Maps our data keys to PDF form field names
    QBCC_CONTRACT_FORM_FIELDS = {
      # The Owner section
      owner_name: "Text Field 4",           # Owner's name/s
      owner_email: "Text Field 5",          # Email
      owner_address: "Text Field 6",        # Postal address
      owner_postcode: "Text Field 7",       # Postcode
      owner_phone: "Text Field 8",          # Mobile phone
      owner_home_phone: "Text Field 9",     # Home phone

      # Owner's Authorised Representative section
      owner_rep_name: "Text Field 11",      # Representative name
      owner_rep_address: "Text Field 12",   # Postal address
      owner_rep_postcode: "Text Field 14",  # Postcode
      owner_rep_phone: "Text Field 13",     # Mobile phone
      owner_rep_email: "Text Field 15",     # Email

      # The Contractor section
      builder_name: "Text Field 16",        # Contractor's name/s
      builder_qbcc: "Text Field 17",        # QBCC Licence Number
      builder_abn: "Text Field 18",         # ABN Number
      builder_address: "Text Field 19",     # Business address
      builder_postcode: "Text Field 20",    # Postcode
      builder_phone: "Text Field 21",       # Mobile phone
      builder_email: "Text Field 22",       # Email

      # Item 3: Description of Works
      description_of_works: "Text Field 23" # Building work description (from Job Type)
    }.freeze

    # Checkbox field mappings for QBCC Contract
    QBCC_CONTRACT_CHECKBOX_FIELDS = {
      resident_owner_is: "Owner-Sched-IS",        # Check if IS a resident owner
      resident_owner_is_not: "Sched-Owner-IS NOT" # Check if IS NOT a resident owner
    }.freeze

    # Placeholder text for missing data
    FIELD_PLACEHOLDERS = {
      owner_name: "[Owner name required]",
      owner_email: "[Owner email]",
      owner_address: "[Owner postal address]",
      owner_postcode: "[Postcode]",
      owner_phone: "[Owner mobile]",
      owner_home_phone: "[Owner home phone]",
      builder_name: "[Contractor name]",
      builder_qbcc: "[QBCC licence]",
      builder_abn: "[ABN]",
      builder_address: "[Business address]",
      builder_postcode: "[Postcode]",
      builder_phone: "[Contractor mobile]",
      builder_email: "[Contractor email]",
      site_supervisor_name: "[Site supervisor name]",
      site_supervisor_phone: "[Site supervisor phone]",
      site_address: "[Site address]",
      contract_date: "[Contract date]",
      contract_price: "[Contract price]",
      date: "[Date]",
      description_of_works: "[Description of building work]"
    }.freeze

    QBCC_CONSUMER_GUIDE_FIELDS = {}.freeze  # Consumer Guide uses AcroForm fields

    # AcroForm field mappings for QBCC Consumer Guide
    QBCC_CONSUMER_GUIDE_FORM_FIELDS = {
      owner_name: "OA-Owners Acknowledgement",  # Owner's acknowledgement name
      date: "OA-Date"                            # Date signed
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

        # Plan and Spec dates (for document packages)
        data[:plan_date] ||= format_date(job.try(:plan_date)) if job.try(:plan_date).present?
        data[:spec_date] ||= format_date(job.try(:spec_date)) if job.try(:spec_date).present?

        # Owner info from primary contact
        primary = job.try(:primary_contact)
        if primary
          data[:owner_name] ||= primary.full_name
          data[:owner_address] ||= primary.try(:address)
          data[:owner_phone] ||= primary.try(:phone)
          data[:owner_email] ||= primary.try(:email)
        end

        # Add secondary contact if exists (append to owner name)
        secondary = job.try(:secondary_contact)
        if secondary
          existing_name = data[:owner_name]
          data[:owner_name] = "#{existing_name} & #{secondary.full_name}" if existing_name
        end

        # Owner's Authorised Representative (from job_contacts with role 'client_representative')
        rep_contact = job.job_contacts.find_by(role: "client_representative")&.contact
        if rep_contact
          data[:owner_rep_name] ||= rep_contact.try(:full_name) || rep_contact.try(:display_name)
          data[:owner_rep_address] ||= rep_contact.try(:address)
          data[:owner_rep_phone] ||= rep_contact.try(:mobile_phone) || rep_contact.try(:phone)
          data[:owner_rep_email] ||= rep_contact.try(:email)
        end

        # Site supervisor info (from job columns)
        data[:site_supervisor_name] ||= job.site_supervisor_name
        data[:site_supervisor_phone] ||= job.site_supervisor_phone

        # Resident owner status (for checkbox)
        data[:resident_owner] = job.resident_owner

        # Item 3: Description of Works (from job type description)
        if job.job_type&.description.present?
          data[:description_of_works] ||= job.job_type.description
        end
      end

      # Generic date - use plan_date or spec_date if available, otherwise current date
      data[:date] ||= data[:plan_date] || data[:spec_date] || format_date(Date.current)

      data
    end

    def fill_form_fields(doc, data)
      return unless doc.acro_form

      # Get explicit field mapping for this template
      explicit_mapping = form_field_mapping_for_template

      doc.acro_form.each_field do |field|
        pdf_field_name = field.full_field_name.to_s
        value = nil
        data_key_used = nil

        # Handle checkbox fields for resident owner
        if template_key == :qbcc_contract && field.field_type == :Btn
          fill_checkbox_field(field, pdf_field_name, data)
          next
        end

        # First check explicit mapping (data_key -> pdf_field_name)
        explicit_mapping.each do |data_key, mapped_field_name|
          if mapped_field_name == pdf_field_name
            data_key_used = data_key
            value = data[data_key] if data.key?(data_key)
            break
          end
        end

        # Fall back to generic name matching if no explicit mapping found
        if data_key_used.nil?
          generic_key = pdf_field_name.downcase.gsub(/[^a-z0-9]/, "_").to_sym
          if data.key?(generic_key)
            data_key_used = generic_key
            value = data[generic_key]
          end
        end

        # Use placeholder if value is blank but we have a mapping
        if value.blank? && data_key_used && FIELD_PLACEHOLDERS.key?(data_key_used)
          value = FIELD_PLACEHOLDERS[data_key_used]
        end

        if value.present?
          field.field_value = value.to_s
          Rails.logger.debug "[PdfOverlayEngine] Filled '#{pdf_field_name}' with '#{value}'"
        end
      end
    rescue StandardError => e
      Rails.logger.warn "[PdfOverlayEngine] Form fill error: #{e.message}"
    end

    def fill_checkbox_field(field, pdf_field_name, data)
      resident_owner = data[:resident_owner]

      case pdf_field_name
      when "Owner-Sched-IS"
        # Check this box if IS a resident owner
        if resident_owner == true
          field.field_value = field.allowed_values&.last || "Yes"
          Rails.logger.debug "[PdfOverlayEngine] Checked 'IS a Resident Owner'"
        end
      when "Sched-Owner-IS NOT"
        # Check this box if IS NOT a resident owner
        if resident_owner == false
          field.field_value = field.allowed_values&.last || "Yes"
          Rails.logger.debug "[PdfOverlayEngine] Checked 'IS NOT a Resident Owner'"
        end
      when "Check Box 9"
        # "Owner has checked the Contractor's licence" - Yes
        # Auto-tick since we provide the QBCC Licensee Register link in the welcome letter
        field.field_value = field.allowed_values&.last || "Yes"
        Rails.logger.debug "[PdfOverlayEngine] Checked 'Owner has checked licence - Yes'"
      when "Check Box 11"
        # "Contractor confirms: My licence is current, active and appropriate" - Yes
        field.field_value = field.allowed_values&.last || "Yes"
        Rails.logger.debug "[PdfOverlayEngine] Checked 'Contractor licence is current - Yes'"
      end
    end

    def form_field_mapping_for_template
      case template_key
      when :qbcc_contract
        QBCC_CONTRACT_FORM_FIELDS
      when :qbcc_consumer_guide
        QBCC_CONSUMER_GUIDE_FORM_FIELDS
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
