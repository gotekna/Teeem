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
      description_of_works: "Text Field 23", # Building work description (from Job Type)

      # Item 4: The Site
      site_address: "Text Field 24",         # Site address
      lot_number: "Text Field 25",           # Lot on plan
      plan_number: "Text Field 26",          # Plan number (RP/SP)
      local_authority: "Text Field 27",      # Local authority (council)

      # Item 5: Commencement and Duration
      proposed_start_date: "Text Field 28",  # Proposed start date
      build_period: "Text Field 29",         # Building period (weeks)
      construction_days: "Text Field 31",    # Construction days (default 300)
      weather_days: "Text Field 32",         # Weather days allowance (default 10)

      # Item 6: Contract Price
      contract_price: "Text Field 33",       # Total contract price

      # Item 7: Deposit (calculated from Item 6)
      deposit: "Text Field 34",              # Deposit amount

      # Item 8a: Progress Payments (from Claims tab)
      # Each stage has: percentage field, amount field
      stage_1_pct: "Text Field 35",          # Deposit %
      stage_1_amt: "Text Field 36",          # Deposit $
      stage_2_pct: "Text Field 37",          # Base/Slab %
      stage_2_amt: "Text Field 38",          # Base/Slab $
      stage_3_pct: "Text Field 39",          # Frame %
      stage_3_amt: "Text Field 40",          # Frame $
      stage_4_pct: "Text Field 41",          # Enclosed %
      stage_4_amt: "Text Field 42",          # Enclosed $
      stage_5_pct: "Text Field 43",          # Fixing %
      stage_5_amt: "Text Field 44",          # Fixing $
      stage_6_pct: "Text Field 45",          # Practical Completion %
      stage_6_amt: "Text Field 46",          # Practical Completion $

      # Item 13: Liquidated Damages
      liquidated_damages: "Text Field 47",   # Liquidated damages amount per day

      # Item 14: Certification responsibility (text field: "Owner" or "Contractor")
      certification_by: "Text Field 48",     # Who obtains certification

      # Item 15: Prime Cost, Provisional Sums details, and Special Conditions
      prime_cost_details: "Text Field 49",   # What the prime cost items are
      provisional_sums_details: "Text Field 50", # What the provisional sum items are
      special_conditions: "Text Field 51"    # Special conditions text
    }.freeze

    # Checkbox field mappings for QBCC Contract
    QBCC_CONTRACT_CHECKBOX_FIELDS = {
      resident_owner_is: "Owner-Sched-IS",        # Check if IS a resident owner
      resident_owner_is_not: "Sched-Owner-IS NOT", # Check if IS NOT a resident owner
      # Item 12: Finance Approval
      finance_approval_is: "Check Box 12-IS",     # Check if IS subject to finance approval
      finance_approval_is_not: "Check Box 12-IS NOT" # Check if IS NOT subject to finance approval
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
      deposit: "[Deposit amount]",
      date: "[Date]",
      description_of_works: "[Description of building work]",
      lot_number: "[Lot number]",
      plan_number: "[Plan number]",
      local_authority: "[Local authority]",
      proposed_start_date: "[Proposed start date]",
      build_period: "[Build period]",
      construction_days: "300",
      weather_days: "10"
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

        # Job/site info (Item 4: The Site)
        data[:site_address] ||= job.address
        data[:lot_number] ||= job.try(:lot_number)
        data[:plan_number] ||= job.try(:plan_number)
        data[:local_authority] ||= job.try(:council)  # Council = Local Authority
        data[:job_reference] ||= job.job_number || job.id.to_s

        # Contract info (Item 6 & 7)
        data[:contract_date] ||= format_date(job.try(:contract_date) || Date.current)
        data[:contract_price] ||= format_currency(job.try(:contract_price))
        data[:deposit] ||= format_currency(job.try(:deposit))  # Item 7 - from Claims tab

        # Item 8a: Progress Payments (from Claims tab)
        stages = job.job_claim_stages.order(:sequence_order).to_a
        stages.each_with_index do |stage, index|
          stage_num = index + 1
          next if stage_num > 6  # Max 6 stages on QBCC form

          pct_key = :"stage_#{stage_num}_pct"
          amt_key = :"stage_#{stage_num}_amt"
          data[pct_key] ||= "#{stage.percentage.to_i}%" if stage.percentage
          data[amt_key] ||= format_currency(stage.expected_amount) if stage.expected_amount
        end

        # Item 5: Commencement and Duration
        data[:proposed_start_date] ||= format_date(job.try(:start_date)) if job.try(:start_date).present?
        data[:build_period] ||= job.try(:build_period)
        data[:construction_days] ||= (job.try(:construction_days) || 300).to_s
        data[:weather_days] ||= job.try(:stage_weather) || "10"

        # Item 13: Liquidated Damages
        liquidated_amount = job.try(:liquidated_damages) || 50.00
        data[:liquidated_damages] ||= format_currency(liquidated_amount)

        # Item 14: Certification responsibility
        data[:certification_by] ||= job.try(:certification_by_owner) ? "Owner" : "Contractor"

        # Item 15: Prime Cost/Provisional Sums details and Special Conditions
        data[:prime_cost_details] ||= job.try(:prime_cost_details) if job.try(:prime_cost_details).present?
        data[:provisional_sums_details] ||= job.try(:provisional_sums_details) if job.try(:provisional_sums_details).present?
        data[:special_conditions] ||= job.try(:special_conditions) if job.try(:has_special_conditions) && job.try(:special_conditions).present?

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

        # Item 12: Finance Approval (for checkbox)
        data[:finance_approval_required] = job.finance_approval_required

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
      finance_approval = data[:finance_approval_required]

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
      when "Check Box 12-IS"
        # Item 12: Check this box if IS subject to finance approval
        if finance_approval == true
          field.field_value = field.allowed_values&.last || "Yes"
          Rails.logger.debug "[PdfOverlayEngine] Checked 'IS subject to finance approval'"
        end
      when "Check Box 12-IS NOT"
        # Item 12: Check this box if IS NOT subject to finance approval
        if finance_approval == false
          field.field_value = field.allowed_values&.last || "Yes"
          Rails.logger.debug "[PdfOverlayEngine] Checked 'IS NOT subject to finance approval'"
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
