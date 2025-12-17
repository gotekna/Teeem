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

  class CredentialError < StandardError; end

  def initialize(template, graph_client: nil)
    @template = template
    @graph_client = graph_client || create_graph_client
  end

  private

  def create_graph_client
    MicrosoftAppGraphClient.new
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.error("Microsoft credential decryption failed: #{e.message}")
    raise CredentialError, "Microsoft credentials expired or invalid. Please reconnect OneDrive in Admin > System > Connections."
  end

  public

  # Generate document from template with provided data
  # Returns hash with :docx_content, :pdf_content (if applicable), :filename
  def generate(job: nil, contact: nil, invoice: nil, claim_stage: nil, extra_data: {})
    validate_inputs!(job, contact, invoice)

    # Build context data for Sablon
    context = build_context(job: job, contact: contact, invoice: invoice, claim_stage: claim_stage, extra_data: extra_data)

    # Download template from SharePoint
    template_content = download_template

    # Perform mail merge with Sablon
    docx_content = perform_mail_merge(template_content, context)

    # Generate output filename
    filename = template.generate_output_filename(job: job, contact: contact, invoice: invoice)

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

  def validate_inputs!(job, contact, invoice = nil)
    case template.category
    when "job"
      raise GenerationError, "Job is required for this template" unless job
    when "contact"
      raise GenerationError, "Contact is required for this template" unless contact
    when "quote", "contract"
      raise GenerationError, "Job is required for this template" unless job
    when "invoice"
      raise GenerationError, "Invoice is required for this template" unless invoice
      raise GenerationError, "Job is required for invoice templates" unless job
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
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.error("Microsoft credential decryption failed during download: #{e.message}")
    raise CredentialError, "Microsoft credentials expired or invalid. Please reconnect OneDrive in Admin > System > Connections."
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

  def build_context(job: nil, contact: nil, invoice: nil, claim_stage: nil, extra_data: {})
    context = {}

    # Add job data
    if job
      context[:job] = build_job_context(job)
    end

    # Add contact data
    if contact
      context[:contact] = build_contact_context(contact)
    end

    # Add invoice data
    if invoice
      context[:invoice] = build_invoice_context(invoice)
    end

    # Add claim stage data
    if claim_stage
      context[:claim_stage] = build_claim_stage_context(claim_stage)
    end

    # Add job contacts if available
    if job
      context[:client_1] = build_contact_context(job.primary_contact) if job.respond_to?(:primary_contact) && job.primary_contact
      context[:client_2] = build_contact_context(job.secondary_contact) if job.respond_to?(:secondary_contact) && job.secondary_contact
      context[:builder] = build_contact_context(job.builder_contact) if job.respond_to?(:builder_contact) && job.builder_contact

      # Add clients array for looping (all contacts with role: "client")
      client_contacts = job.job_contacts.where(role: "client").includes(:contact).map(&:contact).compact
      context[:clients] = client_contacts.map { |c| build_contact_context(c) }
      context[:has_multiple_clients] = client_contacts.size > 1
      context[:client_count] = client_contacts.size

      # Pre-computed multi-client fields (comma-separated for easy use)
      context[:multi_client] = build_multi_client_context(client_contacts)

      # THE ONE TAGS - handles everything automatically (LETTERS - uses owner names for companies)
      context[:dear] = build_smart_greeting(client_contacts)                    # "Dear John & Jane," or "Dear Keith," (owner)
      context[:client_names] = build_smart_client_names(client_contacts)        # "John Smith" or "ABC Pty Ltd (Keith Miller)"
      context[:client_first_names] = build_smart_field(client_contacts, :first) # "John & Jane" or "Keith" (owner)
      context[:client_last_names] = build_smart_field(client_contacts, :last)   # "Smith & Jones" or "Miller" (owner)
      context[:client_display_names] = build_smart_field(client_contacts, :display) # "John Smith" or "Keith Miller (ABC Pty Ltd)"
      context[:client_emails] = client_contacts.map(&:email).compact.join(", ") # "john@x.com, jane@x.com"
      context[:client_phones] = client_contacts.map { |c| c.mobile_phone || c.office_phone }.compact.join(", ")

      # CONTRACT TAGS - formal company names, NO personal names for companies
      context[:contract_dear] = build_contract_greeting(client_contacts)            # "Dear ABC Pty Ltd," (NOT "Dear Keith,")
      context[:contract_client_names] = build_contract_client_names(client_contacts) # "ABC Pty Ltd" (NOT "ABC Pty Ltd (Keith Miller)")
      context[:contract_parties] = build_contract_parties(client_contacts)          # "ABC Pty Ltd ABN 12 345 678 901"
    end

    # Add extra data
    extra_data.each do |key, value|
      context[key] = value
    end

    # Add company settings
    context[:company] = build_company_context

    # Add common fields
    context[:generated_date] = Date.current.strftime("%d/%m/%Y")
    context[:generated_datetime] = Time.current.strftime("%d/%m/%Y %I:%M %p")
    context[:current_year] = Date.current.year.to_s

    context
  end

  def build_company_context
    settings = CorporateCompanySetting.instance

    # Parse address into components if it contains newlines or commas
    address_parts = parse_address(settings.address)

    {
      # Core company info
      name: settings.company_name,
      company_name: settings.company_name,
      abn: settings.abn,
      abn_formatted: format_abn(settings.abn),
      qbcc: settings.qbcc_license,
      qbcc_license: settings.qbcc_license,
      gst_number: settings.gst_number,

      # Contact details
      email: settings.email,
      phone: settings.phone,
      phone_formatted: format_phone(settings.phone),
      website: settings.website,

      # Address - full and parsed
      address: settings.address,
      address_line_1: address_parts[:line_1],
      address_line_2: address_parts[:line_2],
      street: address_parts[:street],
      suburb: address_parts[:suburb],
      city: address_parts[:suburb], # Alias
      state: address_parts[:state],
      postcode: address_parts[:postcode],
      full_address: settings.address&.gsub("\n", ", "),

      # Logo URLs (for reference - images need special handling in Word)
      logo_url: settings.logo_url,
      logo_mobile: settings.logo_mobile,
      logo_dark: settings.logo_dark,

      # For headers/footers
      header_line: "#{settings.company_name} | ABN #{format_abn(settings.abn)} | QBCC #{settings.qbcc_license}",
      footer_line: "#{settings.phone} | #{settings.email} | #{settings.address&.gsub("\n", ", ")}"
    }
  end

  def build_invoice_context(invoice)
    return {} unless invoice

    {
      # Core fields
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      reference: invoice.reference,
      status: invoice.status&.humanize,
      status_raw: invoice.status,

      # Dates
      invoice_date: format_date(invoice.invoice_date),
      due_date: format_date(invoice.due_date),
      fully_paid_date: format_date(invoice.fully_paid_date),

      # Amounts
      subtotal: format_currency(invoice.subtotal),
      subtotal_raw: invoice.subtotal&.to_f,
      total_tax: format_currency(invoice.total_tax),
      total_tax_raw: invoice.total_tax&.to_f,
      total: format_currency(invoice.total),
      total_raw: invoice.total&.to_f,
      amount_due: format_currency(invoice.amount_due),
      amount_due_raw: invoice.amount_due&.to_f,
      amount_paid: format_currency(invoice.amount_paid),
      amount_paid_raw: invoice.amount_paid&.to_f,

      # Currency
      currency_code: invoice.currency_code || "AUD",

      # Contact info (from invoice)
      contact_name: invoice.contact_name,

      # Line items (for templates that support tables)
      line_items: (invoice.line_items || []).map do |item|
        {
          description: item["Description"],
          quantity: item["Quantity"] || 1,
          unit_amount: format_currency(item["UnitAmount"]),
          unit_amount_raw: item["UnitAmount"]&.to_f,
          line_total: format_currency((item["Quantity"] || 1) * (item["UnitAmount"] || 0)),
          line_total_raw: (item["Quantity"] || 1) * (item["UnitAmount"] || 0),
          account_code: item["AccountCode"],
          tax_type: item["TaxType"]
        }
      end,

      # For single line item invoices, expose first line item directly
      description: invoice.line_items&.first&.dig("Description"),

      # Payment status helpers
      is_paid: invoice.status == "paid",
      is_overdue: invoice.due_date.present? && invoice.due_date < Date.current && invoice.status != "paid",
      days_overdue: invoice.due_date.present? && invoice.due_date < Date.current ? (Date.current - invoice.due_date).to_i : 0
    }
  end

  def build_claim_stage_context(claim_stage)
    return {} unless claim_stage

    {
      id: claim_stage.id,
      name: claim_stage.name,
      description: claim_stage.description,
      percentage: claim_stage.percentage&.to_f,
      percentage_formatted: claim_stage.percentage.present? ? "#{claim_stage.percentage}%" : "",
      expected_amount: format_currency(claim_stage.expected_amount),
      expected_amount_raw: claim_stage.expected_amount&.to_f,
      sequence_order: claim_stage.sequence_order,
      is_custom: claim_stage.is_custom
    }
  end

  def parse_address(address)
    return { line_1: "", line_2: "", street: "", suburb: "", state: "", postcode: "" } unless address.present?

    # Try to parse address like "160 Alperton Road\nBurbank QLD 4156"
    lines = address.split(/[\n,]/).map(&:strip).reject(&:blank?)

    result = {
      line_1: lines[0] || "",
      line_2: lines[1..].join(", "),
      street: lines[0] || "",
      suburb: "",
      state: "",
      postcode: ""
    }

    # Try to parse last line as "Suburb STATE Postcode"
    if lines.length > 1
      last_line = lines.last
      # Match patterns like "Burbank QLD 4156" or "Brisbane, QLD 4000"
      if match = last_line.match(/^(.+?)\s+([A-Z]{2,3})\s+(\d{4})$/)
        result[:suburb] = match[1].strip
        result[:state] = match[2]
        result[:postcode] = match[3]
      elsif match = last_line.match(/^(.+?),?\s+([A-Z]{2,3}),?\s+(\d{4})$/)
        result[:suburb] = match[1].strip
        result[:state] = match[2]
        result[:postcode] = match[3]
      end
    end

    result
  end

  def format_phone(phone)
    return phone unless phone.present?
    digits = phone.to_s.gsub(/\D/, "")
    return phone if digits.length != 10
    # Format as 04XX XXX XXX or 07 XXXX XXXX
    if digits.start_with?("04")
      "#{digits[0..3]} #{digits[4..6]} #{digits[7..9]}"
    else
      "#{digits[0..1]} #{digits[2..5]} #{digits[6..9]}"
    end
  end

  def build_job_context(job)
    # Build street address from components
    street_address = [
      job.street_number,
      job.street_name,
      job.street_type
    ].compact.reject(&:blank?).join(" ")

    {
      # Core fields
      id: job.id,
      job_number: job.try(:job_number) || job.id.to_s,
      name: job.name,
      title: job.try(:title) || job.name,
      address: street_address,
      suburb: job.suburb,
      state: job.state,
      postcode: job.postcode,
      full_address: [ street_address, job.suburb, job.state, job.postcode ].compact.reject(&:blank?).join(", "),
      status: job.try(:job_status)&.name || job.try(:status)&.humanize,

      # Contract details
      contract_price: format_currency(job.try(:contract_price) || job.try(:contract_value)),
      contract_price_raw: job.try(:contract_price) || job.try(:contract_value),
      contract_value: format_currency(job.try(:contract_value)),
      contract_price_ex_gst: format_currency(job.try(:contract_price_ex_gst)),
      deposit: format_currency(job.try(:deposit)),
      deposit_percentage: job.try(:deposit_percentage),
      build_period: job.try(:build_period),
      build_period_weeks: job.try(:build_period_weeks),

      # Dates
      contract_date: format_date(job.try(:contract_date)),
      practical_completion_date: format_date(job.try(:practical_completion_date)),
      site_start_date: format_date(job.try(:site_start_date)),
      start_date: format_date(job.try(:start_date)),
      plan_date: format_date(job.try(:plan_date)),
      spec_date: format_date(job.try(:spec_date)),

      # Property details
      lot_number: job.try(:lot_number),
      lot: job.try(:lot_number), # Alias for Compoza compatibility
      plan_number: job.try(:plan_number),
      plan_sp_number: job.try(:plan_number), # Alias for Compoza compatibility
      council: job.try(:council),
      street_number: job.try(:street_number),
      street_name: job.try(:street_name),
      street_type: job.try(:street_type),

      # Builder info
      builder_brand: job.try(:builder_brand),
      builder_licence: job.try(:builder_licence),
      builder_abn: job.try(:builder_abn),
      site_supervisor_name: job.try(:site_supervisor_name),
      site_supervisor_phone: job.try(:site_supervisor_phone),

      description: job.try(:description)
    }
  end

  def build_contact_context(contact)
    return {} unless contact

    entity_type = contact.try(:entity_type)

    {
      # Name fields
      id: contact.id,
      display_name: contact.display_name,
      full_name: contact.display_name, # Alias for Compoza compatibility
      first_name: contact.try(:first_name),
      last_name: contact.try(:last_name),
      middle_name: contact.try(:middle_name),
      name: contact.display_name, # Short alias

      # Entity type for conditionals
      entity_type: entity_type,
      is_company: entity_type == "company",
      is_person: entity_type == "person",
      is_sole_trader: entity_type == "sole_trader",
      is_trust: entity_type == "trust",
      is_individual: entity_type.in?(%w[person sole_trader]), # Person or sole trader

      # Contact details
      email: contact.try(:email),
      phone: contact.try(:office_phone) || contact.try(:mobile_phone),
      phone_number: contact.try(:office_phone) || contact.try(:mobile_phone),
      home_phone: contact.try(:office_phone),
      mobile: contact.try(:mobile_phone),
      mobile_phone: contact.try(:mobile_phone),
      office_phone: contact.try(:office_phone),
      fax: contact.try(:fax_phone),

      # Business details
      company_name: contact.try(:company_name_or_trust),
      company: contact.try(:company_name_or_trust),
      abn: contact.try(:abn),
      acn: contact.try(:acn),

      # Owner/Employee info (for companies)
      has_owner: contact.try(:employees)&.any?,
      owner: build_owner_context(contact),
      owner_name: contact.try(:employees)&.first&.display_name,
      owner_first_name: contact.try(:employees)&.first&.first_name,
      owner_last_name: contact.try(:employees)&.first&.last_name,
      owner_email: contact.try(:employees)&.first&.email,

      # Address - contact uses single address field + city/state/postcode
      address: contact.try(:address),
      address_line_1: contact.try(:address),
      street_address_line_1: contact.try(:address),
      street: contact.try(:address),
      suburb: contact.try(:city),
      city: contact.try(:city),
      street_city: contact.try(:city),
      state: contact.try(:state),
      street_region: contact.try(:state),
      region: contact.try(:state),
      postcode: contact.try(:postcode),
      street_post_code: contact.try(:postcode),
      postal_code: contact.try(:postcode),
      full_address: build_full_address(contact)
    }
  end

  def build_full_address(contact)
    parts = [ contact.try(:address) ]
    parts << [ contact.try(:city), contact.try(:state), contact.try(:postcode) ].compact.reject(&:blank?).join(" ")
    parts.compact.reject(&:blank?).join(", ")
  end

  def build_owner_context(contact)
    return {} unless contact.try(:employees)&.any?

    owner = contact.employees.first
    {
      display_name: owner.display_name,
      first_name: owner.first_name,
      last_name: owner.last_name,
      email: owner.email,
      phone: owner.office_phone || owner.mobile_phone,
      mobile: owner.mobile_phone
    }
  end

  # Build pre-computed multi-client fields for easy template use
  # Usage: {{multi_client.first_name}} => "John, Jane & Michael"
  def build_multi_client_context(contacts)
    return {} if contacts.empty?

    {
      # Names - smart formatting based on entity type
      first_name: format_multi_list(contacts.map { |c| smart_first_name(c) }),
      display_name: format_multi_list(contacts.map(&:display_name)),
      full_name: format_multi_list(contacts.map(&:display_name)),

      # For companies, show company name; for people, show first name
      greeting_name: format_multi_list(contacts.map { |c| smart_greeting_name(c) }),

      # Contact details (first available for each)
      email: contacts.map(&:email).compact.join(", "),
      phone: contacts.map { |c| c.office_phone || c.mobile_phone }.compact.join(", "),
      mobile: contacts.map(&:mobile_phone).compact.join(", "),

      # Addresses
      full_address: format_multi_list(contacts.map { |c| build_full_address(c) }.compact.uniq),

      # Business
      abn: contacts.map(&:abn).compact.join(", "),
      company_name: format_multi_list(contacts.select { |c| c.entity_type == "company" }.map(&:company_name_or_trust).compact),

      # Counts and flags
      count: contacts.size,
      is_multiple: contacts.size > 1,
      is_single: contacts.size == 1,
      has_company: contacts.any? { |c| c.entity_type == "company" },
      all_companies: contacts.all? { |c| c.entity_type == "company" },
      all_individuals: contacts.all? { |c| c.entity_type.in?(%w[person sole_trader]) }
    }
  end

  # Smart first name: use owner's first name for companies, otherwise contact's first name
  def smart_first_name(contact)
    if contact.entity_type == "company"
      # For companies, try to get owner's first name
      owner = contact.employees.first
      owner&.first_name || contact.company_name_or_trust
    else
      contact.first_name || contact.display_name
    end
  end

  # Smart greeting name: friendly name for "Dear X" salutations
  def smart_greeting_name(contact)
    case contact.entity_type
    when "company"
      owner = contact.employees.first
      if owner&.first_name.present?
        owner.first_name
      else
        contact.company_name_or_trust
      end
    when "trust"
      contact.company_name_or_trust || contact.display_name
    else
      contact.first_name || contact.display_name
    end
  end

  # Format list: "A", "A & B", "A, B & C"
  def format_multi_list(items)
    items = items.compact.reject(&:blank?)
    case items.size
    when 0 then ""
    when 1 then items.first
    when 2 then items.join(" & ")
    else
      "#{items[0..-2].join(', ')} & #{items.last}"
    end
  end

  # THE ONE TAG: {{dear}} - Complete greeting that handles everything
  # Output: "Dear John," or "Dear John & Jane," or "Dear Keith," (for company owner)
  def build_smart_greeting(contacts)
    return "Dear Sir/Madam," if contacts.empty?

    names = contacts.map { |c| smart_greeting_name(c) }
    "Dear #{format_multi_list(names)},"
  end

  # THE ONE TAG: {{client_names}} - Full display names for formal use
  # Output: "John Smith" or "John Smith & Jane Smith" or "ABC Pty Ltd (Keith Miller)"
  def build_smart_client_names(contacts)
    return "" if contacts.empty?

    names = contacts.map { |c| smart_formal_name(c) }
    format_multi_list(names)
  end

  # Smart formal name for contracts/legal docs
  def smart_formal_name(contact)
    case contact.entity_type
    when "company"
      owner = contact.employees.first
      if owner
        "#{contact.company_name_or_trust} (#{owner.display_name})"
      else
        contact.company_name_or_trust || contact.display_name
      end
    when "trust"
      contact.company_name_or_trust || contact.display_name
    else
      contact.display_name
    end
  end

  # Build smart field - uses owner info for companies
  def build_smart_field(contacts, field_type)
    return "" if contacts.empty?

    names = contacts.map do |contact|
      case field_type
      when :first
        smart_first_name(contact)
      when :last
        smart_last_name(contact)
      when :display
        smart_display_name(contact)
      else
        contact.display_name
      end
    end

    format_multi_list(names)
  end

  # Smart last name: use owner's last name for companies
  def smart_last_name(contact)
    if contact.entity_type == "company"
      owner = contact.employees.first
      owner&.last_name || contact.company_name_or_trust
    else
      contact.last_name || contact.display_name
    end
  end

  # Smart display name: use owner's name for companies, with company in brackets
  def smart_display_name(contact)
    if contact.entity_type == "company"
      owner = contact.employees.first
      if owner
        "#{owner.display_name} (#{contact.company_name_or_trust})"
      else
        contact.company_name_or_trust || contact.display_name
      end
    else
      contact.display_name
    end
  end

  # =============================================================================
  # CONTRACT TAGS - Formal company names, NO personal names for companies
  # Use these for contracts where you need "ABC Pty Ltd" not "Keith Miller"
  # =============================================================================

  # CONTRACT TAG: {{contract_dear}} - Formal greeting using company names
  # Output: "Dear ABC Pty Ltd," (NOT "Dear Keith,")
  def build_contract_greeting(contacts)
    return "Dear Sir/Madam," if contacts.empty?

    names = contacts.map { |c| contract_greeting_name(c) }
    "Dear #{format_multi_list(names)},"
  end

  # For contracts: use company name for companies, first name for individuals
  def contract_greeting_name(contact)
    case contact.entity_type
    when "company"
      contact.company_name_or_trust || contact.display_name
    when "trust"
      contact.company_name_or_trust || contact.display_name
    else
      contact.first_name || contact.display_name
    end
  end

  # CONTRACT TAG: {{contract_client_names}} - Formal names for contracts
  # Output: "ABC Pty Ltd" or "John Smith & ABC Pty Ltd" (NO owner names in brackets)
  def build_contract_client_names(contacts)
    return "" if contacts.empty?

    names = contacts.map { |c| contract_formal_name(c) }
    format_multi_list(names)
  end

  # For contracts: company name only (no owner), or display name for individuals
  def contract_formal_name(contact)
    case contact.entity_type
    when "company", "trust"
      contact.company_name_or_trust || contact.display_name
    else
      contact.display_name
    end
  end

  # CONTRACT TAG: {{contract_parties}} - Full party names with ABN for contracts
  # Output: "ABC Pty Ltd ABN 12 345 678 901" or "John Smith"
  def build_contract_parties(contacts)
    return "" if contacts.empty?

    parties = contacts.map { |c| contract_party_name(c) }
    format_multi_list(parties)
  end

  # Build party name with ABN for contracts
  def contract_party_name(contact)
    case contact.entity_type
    when "company", "trust"
      name = contact.company_name_or_trust || contact.display_name
      if contact.abn.present?
        "#{name} ABN #{format_abn(contact.abn)}"
      else
        name
      end
    else
      contact.display_name
    end
  end

  # Format ABN with spaces: "12345678901" => "12 345 678 901"
  def format_abn(abn)
    return abn unless abn.present?
    digits = abn.to_s.gsub(/\D/, "")
    return abn if digits.length != 11
    "#{digits[0..1]} #{digits[2..4]} #{digits[5..7]} #{digits[8..10]}"
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
