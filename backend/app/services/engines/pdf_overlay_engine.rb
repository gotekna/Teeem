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

    # Field-specific X offsets to align text with visual lines
    # Measured manually from the QBCC PDF template
    # Positive = shift right, Negative = shift left
    QBCC_FIELD_X_OFFSETS = {
      # Owner section - fields start before their visual lines
      "Text Field 4" => 8,    # Owner name
      "Text Field 5" => 8,    # Owner email
      "Text Field 6" => 8,    # Owner address
      "Text Field 7" => 8,    # Owner postcode
      "Text Field 8" => 8,    # Owner phone
      "Text Field 9" => 8,    # Owner home phone

      # Owner's Rep section
      "Text Field 11" => 8,   # Rep name
      "Text Field 12" => 8,   # Rep address
      "Text Field 14" => 8,   # Rep postcode
      "Text Field 13" => 8,   # Rep phone
      "Text Field 15" => 12,  # Rep email (needs more offset)

      # Contractor section
      "Text Field 16" => 8,   # Builder name
      "Text Field 17" => 8,   # QBCC licence
      "Text Field 18" => 8,   # ABN
      "Text Field 19" => 8,   # Address
      "Text Field 20" => 8,   # Postcode
      "Text Field 21" => 8,   # Phone
      "Text Field 22" => 12,  # Email (needs more offset)

      # Contract Price breakdown (Item 1)
      "Text Field 27" => 8,   # Fixed price component (a)
      "Text Field 28" => 8,   # Prime cost items (b)
      "Text Field 29" => 8,   # Provisional sums (c)
      "Text Field 31" => 8,   # Contract price total

      # Completion Period (Item 6)
      "Text Field 44" => 8,   # A. Construction days
      "Text Field 45" => 8,   # B(i). Weather days
      "Text Field 46" => 8,   # B(ii). Other delays
      "Text Field 82" => 8,   # C. Non-working days
      "Text Field 83" => 8,   # COMPLETION PERIOD total
    }.freeze

    # Field mappings for QBCC documents - text overlay positions
    # Used for fields that don't have form fields in the PDF template
    QBCC_CONTRACT_FIELDS = {
      # Item 6: C and Total (no form fields exist on page 2)
      # Positions adjusted based on visual testing
      weekends_holidays_overlay: { type: :text, page: 2, x: 548, y: 263, size: 10 },  # C. after "etc.) ="
      total_completion_overlay: { type: :text, page: 2, x: 485, y: 252, size: 10 }    # Between "A+B+C):" and "Calendar days"
    }.freeze

    # AcroForm field mappings for QBCC Contract
    # Maps our data keys to PDF form field names
    # VERIFIED field numbers from diagnostic PDF - 18 Dec 2025
    QBCC_CONTRACT_FORM_FIELDS = {
      # The Owner section (Page 1)
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

      # Item 2: Deposit (VERIFIED: Field 32)
      deposit: "Text Field 32",              # Deposit amount

      # Item 3: Description of Works (VERIFIED: Field 33)
      description_of_works: "Text Field 33", # Building work description (from Job Type)

      # Item 4: The Site (VERIFIED: Fields 34-40)
      site_address: "Text Field 34",         # Site address line 1
      site_address_2: "Text Field 35",       # Site address line 2
      site_postcode: "Text Field 36",        # Site postcode
      lot_number: "Text Field 37",           # Lot on plan
      plan_type: "Text Field 38",            # Plan type (RP/SP/BUP)
      plan_number: "Text Field 39",          # Plan number
      local_authority: "Text Field 40",      # Local authority (council)

      # Item 5: Starting Date (split into day/month/year)
      start_date_day: "Text Field 41",       # Start date - day
      start_date_month: "Text Field 42",     # Start date - month
      start_date_year: "Text Field 43",      # Start date - year (2 digits)

      # Item 6: Completion Period
      construction_days: "Text Field 44",    # A. Construction days (working days)
      weather_days: "Text Field 45",         # B(i). Inclement weather allowance (days)
      other_delay_days: "Text Field 46",     # B(ii). Other likely delays (days)
      delay_details: "Text Field 47",        # Details of delay (text description)
      delay_details_2: "Text Field 48",      # Additional delay details
      weekends_holidays: "Text Field 82",    # C. Non-working days (weekends/public holidays)
      total_completion_days: "Text Field 83", # COMPLETION PERIOD (A+B+C) total calendar days

      # Item 1: Contract Price breakdown (VERIFIED: Fields 27-29, 31)
      fixed_price_component: "Text Field 27", # a. Fixed Price Component
      prime_cost: "Text Field 28",            # b. Prime Cost Items
      provisional_sums: "Text Field 29",      # c. Provisional Sums
      contract_price: "Text Field 31",        # Total contract price (a + b + c)

      # Item 8a: Progress Payments - percentages only (VERIFIED: Fields 55-59)
      # Note: Deposit stage uses Item 2 field (32), not a separate stage field
      stage_1_pct: "Text Field 55",          # Base/Slab %
      stage_2_pct: "Text Field 56",          # Frame %
      stage_3_pct: "Text Field 57",          # Enclosed %
      stage_4_pct: "Text Field 58",          # Fixing %
      stage_5_pct: "Text Field 59",          # Practical Completion %

      # TODO: Item 10: Liquidated Damages - needs field verification
      # (Field 47/48 are in Item 6 section, NOT Items 10-14)

      # TODO: Item 14: Certification responsibility - needs field verification

      # Item 15: Prime Cost, Provisional Sums details, and Special Conditions (TBC)
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
        # Company/builder info (SSoT: CorporateCompanySetting)
        settings = ::CorporateCompanySetting.instance
        data[:builder_name] ||= settings.company_name
        data[:builder_abn] ||= format_abn(settings.abn)
        data[:builder_qbcc] ||= settings.qbcc_license
        data[:builder_phone] ||= settings.phone
        data[:builder_email] ||= settings.email
        data[:builder_postcode] ||= settings.postcode
        # Remove postcode from address if it's duplicated there
        data[:builder_address] ||= settings.address.to_s.sub(/\s*#{settings.postcode}\s*$/, "").strip

        # Job/site info (Item 4: The Site)
        data[:site_address] ||= job.address
        data[:lot_number] ||= job.try(:lot_number)
        data[:plan_number] ||= job.try(:plan_number)
        data[:local_authority] ||= job.try(:council)  # Council = Local Authority
        data[:job_reference] ||= job.job_number || job.id.to_s

        # Contract info (Item 1: Contract Price breakdown)
        data[:contract_date] ||= format_date(job.try(:contract_date) || Date.current)

        # Item 1a, 1b, 1c: Price breakdown
        total = job.try(:contract_price).to_f
        prime = job.try(:prime_cost).to_f
        provisional = job.try(:provisional_sums).to_f
        fixed = total - prime - provisional  # a = total - b - c

        data[:fixed_price_component] ||= format_currency(fixed)
        data[:prime_cost] ||= format_currency(prime)
        data[:provisional_sums] ||= format_currency(provisional)
        data[:contract_price] ||= format_currency(total)

        # Item 2: Deposit (calculate as 5% of contract price if not set)
        if job.try(:deposit).present?
          data[:deposit] ||= format_currency(job.deposit)
        elsif job.try(:contract_price).present?
          deposit_amount = (job.contract_price * 0.05).round(2)
          data[:deposit] ||= format_currency(deposit_amount)
        end

        # Item 8a: Progress Payments (from Claims tab)
        # Stage mapping: 1=Base, 2=Frame, 3=Enclosed, 4=Fixing, 5=Practical Completion
        # (Deposit is separate in Item 2, not in the stages)
        stages = job.job_claim_stages.order(:sequence_order).to_a
        stage_names_to_num = {
          "base" => 1, "slab" => 1, "base/slab" => 1,
          "frame" => 2,
          "enclosed" => 3, "lockup" => 3, "lock-up" => 3,
          "fixing" => 4, "fix" => 4,
          "practical" => 5, "completion" => 5, "practical completion" => 5
        }

        stages.each do |stage|
          # Try to match stage name to a field number
          stage_name_lower = stage.name.to_s.downcase
          stage_num = stage_names_to_num.find { |k, _| stage_name_lower.include?(k) }&.last

          next unless stage_num && stage_num <= 5

          pct_key = :"stage_#{stage_num}_pct"
          data[pct_key] ||= "#{stage.percentage.to_i}%" if stage.percentage
        end

        # Item 5: Starting Date (split into day/month/year)
        if job.try(:start_date).present?
          start = job.start_date
          data[:start_date_day] ||= start.day.to_s
          data[:start_date_month] ||= start.month.to_s
          data[:start_date_year] ||= start.strftime("%y")  # 2-digit year
        end

        # Item 6: Completion Period (auto-calculate build period and weekends/holidays)
        construction_days = job.try(:construction_days) || 300
        weather_days = job.try(:weather_days) || 10
        other_delays = job.try(:other_delay_days) || 0
        start_date = job.try(:start_date) || Date.current

        # Calculate calendar days and weekends/holidays
        build_calc = calculate_build_period(start_date, construction_days, weather_days)

        # C = weekends + public holidays during construction period
        weekend_holiday_days = build_calc[:weekend_holiday_days]

        # Total = A + B(i) + B(ii) + C
        total_completion = construction_days.to_i + weather_days.to_i + other_delays.to_i + weekend_holiday_days

        data[:construction_days] ||= construction_days.to_s
        data[:weather_days] ||= weather_days.to_s
        data[:other_delay_days] ||= other_delays.to_s if other_delays > 0
        data[:weekends_holidays] ||= weekend_holiday_days.to_s
        data[:total_completion_days] ||= total_completion.to_s
        data[:build_period] ||= "#{build_calc[:total_weeks]} weeks"

        # Text overlay versions (for fields that don't exist as form fields on page 2)
        data[:weekends_holidays_overlay] = weekend_holiday_days.to_s
        data[:total_completion_overlay] = total_completion.to_s

        # Item 15: Prime Cost/Provisional Sums details and Special Conditions
        data[:prime_cost_details] ||= job.try(:prime_cost_details) if job.try(:prime_cost_details).present?
        data[:provisional_sums_details] ||= job.try(:provisional_sums_details) if job.try(:provisional_sums_details).present?
        data[:special_conditions] ||= job.try(:special_conditions) if job.try(:has_special_conditions) && job.try(:special_conditions).present?

        # Plan and Spec dates (for document packages)
        data[:plan_date] ||= format_date(job.try(:plan_date)) if job.try(:plan_date).present?
        data[:spec_date] ||= format_date(job.try(:spec_date)) if job.try(:spec_date).present?

        # Owner info from ALL client contacts (handles multiple owners, companies, combos)
        client_contacts = job.job_contacts
          .where(role: "client")
          .includes(:contact)
          .order(primary: :desc, created_at: :asc)
          .map(&:contact)
          .compact

        if client_contacts.any?
          # Build owner name from all clients
          owner_names = client_contacts.map { |c| format_contract_party(c) }

          data[:owner_name] ||= owner_names.join(" & ")

          # Use primary contact's details for address/phone/email (SSoT: Contact model)
          primary = client_contacts.first
          data[:owner_phone] ||= primary.try(:mobile_phone) || primary.try(:phone)
          data[:owner_email] ||= primary.try(:email)
          data[:owner_postcode] ||= primary.try(:postcode)
          # Remove postcode from address if duplicated
          owner_addr = primary.try(:address).to_s
          owner_pc = primary.try(:postcode).to_s
          data[:owner_address] ||= owner_pc.present? ? owner_addr.sub(/\s*#{owner_pc}\s*$/, "").strip : owner_addr
        end

        # Owner's Authorised Representative (from job_contacts with role 'client_representative')
        rep_contact = job.job_contacts.find_by(role: "client_representative")&.contact
        if rep_contact
          data[:owner_rep_name] ||= rep_contact.try(:full_name) || rep_contact.try(:display_name)
          data[:owner_rep_phone] ||= rep_contact.try(:mobile_phone) || rep_contact.try(:phone)
          data[:owner_rep_email] ||= rep_contact.try(:email)
          data[:owner_rep_postcode] ||= rep_contact.try(:postcode)
          # Remove postcode from address if duplicated
          rep_addr = rep_contact.try(:address).to_s
          rep_pc = rep_contact.try(:postcode).to_s
          data[:owner_rep_address] ||= rep_pc.present? ? rep_addr.sub(/\s*#{rep_pc}\s*$/, "").strip : rep_addr
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
          # Generate appearance stream immediately (web PDF viewers don't respect NeedAppearances)
          field.create_appearances if field.respond_to?(:create_appearances)
          Rails.logger.debug "[PdfOverlayEngine] Filled '#{pdf_field_name}' with '#{value}'"
        end
      end

      # Fallback for viewers that do support NeedAppearances
      doc.acro_form[:NeedAppearances] = true
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

    # Format contact name for contract party field
    # - Person: "First Last"
    # - Company: "Company Name ACN XX XXX XXX" or "Company Name ABN XX XXX XXX XXX"
    # - Trust: "Trust Name as Trustee for [Trustee Name]" or "Trust Name (Trustee: Name)"
    # - Sole Trader: "First Last trading as Business Name"
    def format_contract_party(contact)
      return contact.full_name if contact.blank?

      case contact.entity_type
      when "company"
        name = contact.company_name_or_trust.presence || contact.full_name
        # Prefer ACN for companies, fall back to ABN
        if contact.try(:acn).present?
          "#{name} ACN #{format_acn(contact.acn)}"
        elsif contact.try(:abn).present?
          "#{name} ABN #{format_abn(contact.abn)}"
        else
          name
        end

      when "trust"
        name = contact.company_name_or_trust.presence || contact.full_name
        # Find trustee via incoming relationships (people who are trustees OF this trust)
        trustee = contact.incoming_relationships
          .where(relationship_type: "trustee_of", is_active: true)
          .includes(:contact)
          .first&.contact

        if trustee
          trustee_name = format_contract_party(trustee)  # Recursively format (trustee could be a company)
          "#{trustee_name} as Trustee for #{name}"
        else
          name
        end

      when "sole_trader"
        person_name = [contact.first_name, contact.last_name].compact.join(" ")
        business_name = contact.company_name_or_trust
        if business_name.present? && business_name != person_name
          "#{person_name} trading as #{business_name}"
        else
          person_name.presence || contact.full_name
        end

      else
        # Person or unknown - just use full name
        contact.full_name
      end
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

    def format_acn(acn)
      return "" unless acn
      acn.to_s.gsub(/\D/, "").gsub(/(\d{3})(\d{3})(\d{3})/, '\1 \2 \3')
    end

    # Calculate build period from construction days, accounting for weekends and holidays
    # Returns: { total_weeks:, weekend_holiday_days:, end_date: }
    def calculate_build_period(start_date, construction_days, weather_days)
      return { total_weeks: 0, weekend_holiday_days: 0, end_date: start_date } if construction_days.to_i <= 0

      working_days_needed = construction_days.to_i
      weather = weather_days.to_i
      current_date = start_date.to_date
      working_days_counted = 0
      weekend_days = 0
      holiday_days = 0

      # QLD public holidays (approximate - could be made more accurate with a gem)
      qld_holidays = qld_public_holidays(start_date.year, start_date.year + 2)

      # Count forward from start date until we have enough working days
      while working_days_counted < working_days_needed
        if current_date.saturday? || current_date.sunday?
          weekend_days += 1
        elsif qld_holidays.include?(current_date)
          holiday_days += 1
        else
          working_days_counted += 1
        end
        current_date += 1.day
      end

      # Add weather days to the end date
      total_calendar_days = (current_date - start_date.to_date).to_i + weather
      total_weeks = (total_calendar_days / 7.0).ceil

      {
        total_weeks: total_weeks,
        weekend_holiday_days: weekend_days + holiday_days,
        end_date: current_date + weather.days
      }
    end

    # QLD public holidays (approximate dates)
    def qld_public_holidays(start_year, end_year)
      holidays = []
      (start_year..end_year).each do |year|
        holidays += [
          Date.new(year, 1, 1),   # New Year's Day
          Date.new(year, 1, 26),  # Australia Day
          Date.new(year, 4, 25),  # ANZAC Day
          Date.new(year, 12, 25), # Christmas Day
          Date.new(year, 12, 26), # Boxing Day
          # Easter (approximate - varies each year)
          easter_date(year) - 2,  # Good Friday
          easter_date(year) + 1,  # Easter Monday
          # Queen's Birthday (2nd Monday of June in QLD)
          second_monday_of(year, 6),
          # Ekka (Brisbane only - 2nd Wednesday of August)
          second_wednesday_of(year, 8),
        ]
      end
      holidays.compact
    end

    # Calculate Easter Sunday (Computus algorithm)
    def easter_date(year)
      a = year % 19
      b = year / 100
      c = year % 100
      d = b / 4
      e = b % 4
      f = (b + 8) / 25
      g = (b - f + 1) / 3
      h = (19 * a + b - d - g + 15) % 30
      i = c / 4
      k = c % 4
      l = (32 + 2 * e + 2 * i - h - k) % 7
      m = (a + 11 * h + 22 * l) / 451
      month = (h + l - 7 * m + 114) / 31
      day = ((h + l - 7 * m + 114) % 31) + 1
      Date.new(year, month, day)
    end

    def second_monday_of(year, month)
      first_day = Date.new(year, month, 1)
      days_until_monday = (1 - first_day.wday) % 7
      first_day + days_until_monday + 7
    end

    def second_wednesday_of(year, month)
      first_day = Date.new(year, month, 1)
      days_until_wednesday = (3 - first_day.wday) % 7
      first_day + days_until_wednesday + 7
    end
  end
end
