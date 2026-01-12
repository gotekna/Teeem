# frozen_string_literal: true

# TeknaDocumentGenerator generates branded PDF documents from HTML/ERB templates.
#
# Usage:
#   generator = TeknaDocumentGenerator.new(:welcome_letter)
#   result = generator.generate(job: job)
#   # result[:html] - Rendered HTML
#   # result[:pdf_content] - PDF binary
#   # result[:filename] - Generated filename
#
#   # Preview only (no PDF)
#   html = generator.preview(job: job)
#
class TeknaDocumentGenerator
  class GenerationError < StandardError; end
  class TemplateNotFoundError < StandardError; end

  # Template definitions
  # layout: "tekna" = Tekna branded header/footer
  # layout: "qbcc_official" = Plain layout matching official QBCC format
  TEMPLATES = {
    # Tekna branded documents
    welcome_letter: {
      path: "templates/welcome_letter",
      category: "letter",
      requires: [ :job ],
      layout: "tekna",
      title: "Welcome Letter",
      output_filename: "{date}_welcome_letter_{job_name}"
    },
    specifications: {
      path: "templates/specifications",
      category: "contract",
      requires: [ :job ],
      layout: "tekna",
      title: "Specifications",
      output_filename: "{date}_specifications_{job_name}"
    },
    colour_selections: {
      path: "templates/colour_selections",
      category: "contract",
      requires: [ :job ],
      layout: "tekna",
      title: "Colour Selections",
      output_filename: "{date}_colour_selections_{job_name}"
    },
    owners_authority: {
      path: "templates/owners_authority",
      category: "contract",
      requires: [ :job ],
      layout: "tekna",
      title: "Owner's Authority to Obtain Information",
      output_filename: "{date}_owners_authority_{job_name}"
    },
    spec_acknowledgement: {
      path: "templates/spec_acknowledgement",
      category: "contract",
      requires: [ :job ],
      layout: "tekna",
      title: "Specification of Works Acknowledgement",
      output_filename: "{date}_spec_acknowledgement_{job_name}"
    },
    termite_protection: {
      path: "templates/termite_protection",
      category: "contract",
      requires: [ :job ],
      layout: "tekna",
      title: "Termite Protection System",
      output_filename: "{date}_termite_protection_{job_name}"
    },
    variation: {
      path: "templates/variation",
      category: "contract",
      requires: [ :job ],
      layout: "tekna",
      title: "Contract Variation",
      output_filename: "{date}_variation_{variation_number}_{job_name}"
    },
    practical_completion: {
      path: "templates/practical_completion",
      category: "certificate",
      requires: [ :job ],
      layout: "tekna",
      title: "Practical Completion Certificate",
      output_filename: "{date}_practical_completion_{job_name}"
    },
    purchase_order: {
      path: "templates/purchase_order",
      category: "operations",
      requires: [ :purchase_order ],
      layout: "tekna",
      title: "Purchase Order",
      output_filename: "{date}_PO_{po_number}_{job_name}"
    },

    # QBCC Official documents (PDF overlay - uses official QBCC PDFs)
    # These use the actual QBCC PDF templates with form filling/text overlay
    # SSoT: PDF templates stored in app/views/tekna_documents/templates/qbcc/
    qbcc_contract: {
      source: :pdf_overlay,
      pdf_template: "qbcc_contract.pdf",
      category: "contract",
      requires: [ :job ],
      layout: "none",
      title: "QBCC Building Contract",
      output_filename: "{date}_qbcc_contract_{job_name}",
      qbcc_required: true
    },
    qbcc_consumer_guide: {
      source: :pdf_overlay,
      pdf_template: "qbcc_consumer_guide.pdf",
      category: "contract",
      requires: [ :job ],
      layout: "none",
      title: "QBCC Consumer Building Guide",
      output_filename: "{date}_qbcc_consumer_guide_{job_name}",
      qbcc_required: true
    },
    qbcc_general_conditions: {
      source: :pdf_overlay,
      pdf_template: "qbcc_general_conditions.pdf",
      category: "contract",
      requires: [ :job ],
      layout: "none",
      title: "QBCC General Conditions of Contract",
      output_filename: "{date}_qbcc_general_conditions_{job_name}",
      qbcc_required: true
    },

    # SharePoint-sourced documents (fetched from job folder, not generated)
    all_plans: {
      source: :sharepoint,
      sharepoint_path: "04 Plans/All Plans.pdf",
      sharepoint_path_alt: "04 Plans/All+Plans.pdf", # Alternative filename (URL encoded)
      category: "contract",
      requires: [ :job ],
      layout: "none",
      title: "All Plans",
      output_filename: "All_Plans_{job_name}"
    },

    # Invoice documents
    deposit_claim_invoice: {
      path: "templates/deposit_claim_invoice",
      category: "invoice",
      requires: [ :job ],
      layout: "tekna",
      title: "Deposit Claim Invoice",
      output_filename: "{date}_deposit_invoice_{job_name}"
    }
  }.freeze

  attr_reader :template_key, :template_config

  def initialize(template_key)
    @template_key = template_key.to_sym
    @template_config = TEMPLATES[@template_key]
    raise TemplateNotFoundError, "Unknown template: #{template_key}. Available: #{TEMPLATES.keys.join(', ')}" unless @template_config
  end

  # List all available templates
  def self.available_templates
    TEMPLATES.map do |key, config|
      {
        key: key,
        title: config[:title],
        category: config[:category],
        requires: config[:requires],
        layout: config[:layout],
        qbcc_required: config[:qbcc_required] || false
      }
    end
  end

  # Generate document and return hash with html and pdf_content
  def generate(job: nil, contact: nil, purchase_order: nil, extra_data: {})
    validate_requirements!(job: job, contact: contact, purchase_order: purchase_order, extra_data: extra_data)

    # Handle SharePoint-sourced documents (fetch existing file, don't generate)
    if template_config[:source] == :sharepoint
      return fetch_from_sharepoint(job: job)
    end

    # Handle PDF overlay documents (QBCC official PDFs with form filling)
    if template_config[:source] == :pdf_overlay
      return generate_pdf_overlay(job: job, contact: contact, extra_data: extra_data)
    end

    context = build_context(job: job, contact: contact, purchase_order: purchase_order, extra_data: extra_data)
    html = render_template(context)
    pdf_content = convert_to_pdf(html)

    {
      html: html,
      pdf_content: pdf_content,
      filename: generate_filename(job: job, purchase_order: purchase_order, extra_data: extra_data),
      generated_at: Time.current,
      template: template_key,
      title: template_config[:title]
    }
  end

  # Generate HTML only (for preview)
  # When no job is provided, uses the first available job as sample data
  def preview(job: nil, contact: nil, extra_data: {})
    # Use first job as sample if none provided
    job ||= Job.includes(:job_contacts => :contact).first
    context = build_context(job: job, contact: contact, extra_data: extra_data, preview_mode: true)
    render_template(context)
  end

  private

  def validate_requirements!(job:, contact:, purchase_order:, extra_data:)
    template_config[:requires].each do |requirement|
      case requirement
      when :job
        raise GenerationError, "Job is required for #{template_config[:title]}" unless job
      when :contact
        raise GenerationError, "Contact is required for #{template_config[:title]}" unless contact
      when :purchase_order
        raise GenerationError, "Purchase order is required for #{template_config[:title]}" unless purchase_order
      when :variation_data
        raise GenerationError, "Variation data is required for #{template_config[:title]}" unless extra_data[:variation]
      end
    end
  end

  def build_context(job:, contact:, purchase_order: nil, extra_data:, preview_mode: false)
    context = {}

    # Build job context
    if job
      context[:job] = build_job_context(job)

      # Build client contexts from job
      if job.respond_to?(:job_contacts)
        client_contacts = job.job_contacts.where(role: "client").includes(:contact).map(&:contact).compact
        context[:clients] = client_contacts.map { |c| build_contact_context(c) }
        context[:client_1] = context[:clients][0] if context[:clients].any?
        context[:client_2] = context[:clients][1] if context[:clients].length > 1
        context[:has_multiple_clients] = client_contacts.size > 1
        context[:client_count] = client_contacts.size

        # Smart client fields
        context[:dear] = build_smart_greeting(client_contacts)
        context[:client_names] = build_smart_client_names(client_contacts)
        context[:client_first_names] = build_smart_field(client_contacts, :first)
        context[:contract_parties] = build_contract_parties(client_contacts)
      end

      # Build colour selections (SSoT)
      if job.respond_to?(:job_colour_selections)
        context[:colour_selections] = build_colour_selections_context(job)
      end

      # Build specifications (SSoT)
      if job.respond_to?(:job_specifications)
        context[:specifications] = build_specifications_context(job)
      end
    end

    # Build purchase order context
    if purchase_order
      context[:purchase_order] = build_purchase_order_context(purchase_order)
      # Also include job context from PO if not already set
      if purchase_order.job && !job
        context[:job] = build_job_context(purchase_order.job)
        # Add colour selections from the PO's job
        if purchase_order.job.respond_to?(:job_colour_selections)
          context[:colour_selections] = build_colour_selections_context(purchase_order.job)
        end
      end
    end

    # Build standalone contact context
    if contact
      context[:contact] = build_contact_context(contact)
    end

    # Add company settings
    context[:company] = build_company_context

    # Add extra data
    extra_data.each do |key, value|
      context[key] = value
    end

    # Add common fields
    context[:generated_date] = Date.current.strftime("%d/%m/%Y")
    context[:generated_date_long] = Date.current.strftime("%d %B %Y")
    context[:generated_datetime] = Time.current.strftime("%d/%m/%Y %I:%M %p")
    context[:current_year] = Date.current.year.to_s

    # Add template info
    context[:document_title] = template_config[:title]
    context[:is_qbcc_document] = template_config[:qbcc_required] || false

    context
  end

  def build_job_context(job)
    street_address = [
      job.try(:street_number),
      job.try(:street_name),
      job.try(:street_type)
    ].compact.reject(&:blank?).join(" ")

    {
      id: job.id,
      job_number: job.try(:job_number) || job.id.to_s,
      name: job.name,
      title: job.try(:title) || job.name,

      # Address
      address: street_address,
      street_address: street_address,
      suburb: job.try(:suburb),
      state: job.try(:state),
      postcode: job.try(:postcode),
      full_address: [ street_address, job.try(:suburb), job.try(:state), job.try(:postcode) ].compact.reject(&:blank?).join(", "),

      # Property details
      lot_number: job.try(:lot_number),
      plan_number: job.try(:plan_number),
      council: job.try(:council),

      # Contract details
      # SSoT: contract_price is THE ONE
      contract_price: format_currency(job.try(:contract_price)),
      contract_price_raw: job.try(:contract_price),
      contract_price_ex_gst: format_currency(job.try(:contract_price_ex_gst)),
      gst_amount: format_currency(job.try(:gst_amount)),
      deposit: format_currency(job.try(:deposit)),
      deposit_percentage: job.try(:deposit_percentage),
      build_period: job.try(:build_period),
      build_period_weeks: job.try(:build_period_weeks),

      # Dates
      contract_date: format_date(job.try(:contract_date)),
      contract_date_long: job.try(:contract_date)&.strftime("%d %B %Y"),
      site_start_date: format_date(job.try(:site_start_date)),
      practical_completion_date: format_date(job.try(:practical_completion_date)),

      # Builder info
      site_supervisor_name: job.try(:site_supervisor_name),
      site_supervisor_phone: job.try(:site_supervisor_phone),

      # Status
      status: job.try(:job_status)&.name || job.try(:status)&.humanize
    }
  end

  def build_contact_context(contact)
    return {} unless contact

    {
      id: contact.id,
      display_name: contact.display_name,
      full_name: contact.display_name,
      first_name: contact.try(:first_name),
      last_name: contact.try(:last_name),

      # Entity type
      entity_type: contact.try(:entity_type),
      is_company: contact.try(:entity_type) == "company",
      is_person: contact.try(:entity_type) == "person",

      # Contact details
      email: contact.try(:email),
      phone: contact.try(:office_phone) || contact.try(:mobile_phone),
      mobile: contact.try(:mobile_phone),

      # Business details
      company_name: contact.try(:company_name_or_trust),
      abn: contact.try(:abn),
      abn_formatted: format_abn(contact.try(:abn)),

      # Address
      address: contact.try(:address),
      suburb: contact.try(:city),
      state: contact.try(:state),
      postcode: contact.try(:postcode),
      full_address: build_full_address(contact),

      # Owner (for companies)
      owner_name: contact.try(:employees)&.first&.display_name,
      owner_first_name: contact.try(:employees)&.first&.first_name
    }
  end

  def build_company_context
    settings = CorporateCompanySetting.instance
    address_parts = parse_address(settings.address)

    {
      name: settings.company_name,
      company_name: settings.company_name,
      abn: settings.abn,
      abn_formatted: format_abn(settings.abn),
      qbcc: settings.qbcc_license,
      qbcc_license: settings.qbcc_license,

      email: settings.email,
      phone: settings.phone,
      phone_formatted: format_phone(settings.phone),
      website: settings.try(:website),

      address: settings.address,
      address_line_1: address_parts[:line_1],
      address_line_2: address_parts[:line_2],
      suburb: address_parts[:suburb],
      state: address_parts[:state],
      postcode: address_parts[:postcode],
      full_address: settings.address&.gsub("\n", ", "),

      logo_url: settings.logo_url,

      header_line: "#{settings.company_name} | ABN #{format_abn(settings.abn)} | QBCC #{settings.qbcc_license}",
      footer_line: "#{format_phone(settings.phone)} | #{settings.email}"
    }
  end

  def build_purchase_order_context(po)
    return {} unless po

    # Get supplier info
    supplier = po.supplier
    supplier_info = if supplier
      {
        id: supplier.id,
        name: supplier.display_name,
        email: supplier.try(:email),
        phone: supplier.try(:office_phone) || supplier.try(:mobile_phone),
        address: supplier.try(:address)
      }
    else
      {}
    end

    # Get site supervisor info from job
    job = po.job
    site_supervisor = if job
      {
        name: job.try(:site_supervisor_name),
        email: job.try(:site_supervisor_email),
        phone: job.try(:site_supervisor_phone)
      }
    else
      {}
    end

    # Build line items with colour from pricebook (SSoT)
    line_items = po.line_items.includes(:pricebook_item).map do |item|
      {
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: (item.quantity || 0) * (item.unit_price || 0),
        total_formatted: format_currency((item.quantity || 0) * (item.unit_price || 0)),
        unit_price_formatted: format_currency(item.unit_price),
        gst_code: item.gst_code || "GST",
        notes: item.notes,
        # SSoT: colour comes from pricebook item or line item override
        colour: item.try(:colour) || item.pricebook_item&.try(:colour),
        colour_code: item.try(:colour_code) || item.pricebook_item&.try(:colour_code),
        colour_brand: item.try(:colour_brand) || item.pricebook_item&.try(:colour_brand),
        pricebook_code: item.pricebook_item&.item_code
      }
    end

    # Calculate totals
    subtotal = line_items.sum { |i| i[:total] }
    gst = subtotal * 0.1
    total = subtotal + gst

    {
      id: po.id,
      purchase_order_number: po.purchase_order_number,
      status: po.status,
      description: po.description,

      # Dates
      required_date: format_date(po.required_date),
      required_on_site_date: format_date(po.required_on_site_date),
      ordered_date: format_date(po.ordered_date),
      expected_delivery_date: format_date(po.expected_delivery_date),
      created_at: format_date(po.created_at),

      # Delivery
      delivery_address: po.delivery_address || job&.try(:full_address),
      special_instructions: po.special_instructions,

      # Financial
      subtotal: format_currency(subtotal),
      subtotal_raw: subtotal,
      gst: format_currency(gst),
      gst_raw: gst,
      total: format_currency(total),
      total_raw: total,
      budget: format_currency(po.budget),

      # Related
      supplier: supplier_info,
      site_supervisor: site_supervisor,
      line_items: line_items,
      line_items_count: line_items.size,

      # Task reference (SSoT: from linked SmTask)
      ted_task: po.sm_task&.name
    }
  end

  def build_colour_selections_context(job)
    return {} unless job.respond_to?(:job_colour_selections)

    selections = job.job_colour_selections.includes(:pricebook_item).order(:category_key, :position)

    # Group by category
    grouped = selections.group_by(&:category_key).transform_values do |items|
      items.map do |item|
        {
          item_key: item.item_key,
          colour_name: item.display_colour,
          colour_code: item.display_code,
          colour_brand: item.display_brand,
          notes: item.notes,
          pricebook_item_name: item.pricebook_item&.item_name,
          pricebook_item_code: item.pricebook_item&.item_code
        }
      end
    end

    # Also create a formatted string for simple display (for PO COLOUR field)
    colour_summary = selections.map do |s|
      "#{s.item_key.titleize}: #{s.display_colour}"
    end.join("\n")

    {
      grouped: grouped,
      flat_list: selections.map do |item|
        {
          category: item.category_key,
          item: item.item_key,
          colour: item.display_colour,
          code: item.display_code,
          brand: item.display_brand
        }
      end,
      summary: colour_summary,
      has_selections: selections.any?
    }
  end

  def build_specifications_context(job)
    return {} unless job.respond_to?(:job_specifications)

    specs = job.job_specifications.includes(:pricebook_item).order(:section_key, :position)

    # Group by section
    grouped = specs.group_by(&:section_key).transform_values do |items|
      items.map do |item|
        {
          item_key: item.item_key,
          value: item.display_value,
          price: format_currency(item.price),
          price_raw: item.price,
          colour: item.colour,
          notes: item.notes,
          pricebook_item_code: item.pricebook_item&.item_code
        }
      end
    end

    {
      grouped: grouped,
      flat_list: specs.map do |item|
        {
          section: item.section_key,
          item: item.item_key,
          value: item.display_value,
          price: item.price,
          colour: item.colour
        }
      end,
      has_specifications: specs.any?
    }
  end

  def render_template(context)
    renderer = TeknaTemplateRenderer.new
    layout = "layouts/#{template_config[:layout]}"

    renderer.render(
      template_path: template_config[:path],
      layout: layout,
      locals: context
    )
  end

  def convert_to_pdf(html)
    Grover.new(html, **grover_options).to_pdf
  end

  def grover_options
    {
      format: "A4",
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
      print_background: true,
      prefer_css_page_size: true,
      display_header_footer: false,
      launch_args: [ "--no-sandbox", "--disable-dev-shm-usage" ]
    }
  end

  def generate_filename(job:, purchase_order: nil, extra_data:)
    pattern = template_config[:output_filename]
    filename = pattern.dup

    filename.gsub!("{date}", Date.current.strftime("%Y%m%d"))
    filename.gsub!("{job_name}", job&.name.to_s.parameterize.presence || purchase_order&.job&.name.to_s.parameterize.presence || "draft")
    filename.gsub!("{job_number}", job&.try(:job_number).to_s)
    filename.gsub!("{variation_number}", extra_data.dig(:variation, :number).to_s)
    filename.gsub!("{po_number}", purchase_order&.purchase_order_number.to_s)

    "#{filename}.pdf"
  end

  # ===== Smart Field Builders =====

  def build_smart_greeting(contacts)
    return "Dear Sir/Madam," if contacts.empty?
    names = contacts.map { |c| smart_greeting_name(c) }
    "Dear #{format_multi_list(names)},"
  end

  def build_smart_client_names(contacts)
    return "" if contacts.empty?
    names = contacts.map { |c| smart_formal_name(c) }
    format_multi_list(names)
  end

  def build_smart_field(contacts, field_type)
    return "" if contacts.empty?
    names = contacts.map do |contact|
      case field_type
      when :first
        smart_first_name(contact)
      when :last
        smart_last_name(contact)
      else
        contact.display_name
      end
    end
    format_multi_list(names)
  end

  def build_contract_parties(contacts)
    return "" if contacts.empty?
    parties = contacts.map { |c| contract_party_name(c) }
    format_multi_list(parties)
  end

  def smart_greeting_name(contact)
    if contact.entity_type == "company"
      owner = contact.employees.first
      owner&.first_name.presence || contact.company_name_or_trust
    else
      contact.first_name.presence || contact.display_name
    end
  end

  def smart_formal_name(contact)
    if contact.entity_type == "company"
      owner = contact.employees.first
      owner ? "#{contact.company_name_or_trust} (#{owner.display_name})" : contact.company_name_or_trust
    else
      contact.display_name
    end
  end

  def smart_first_name(contact)
    if contact.entity_type == "company"
      contact.employees.first&.first_name || contact.company_name_or_trust
    else
      contact.first_name || contact.display_name
    end
  end

  def smart_last_name(contact)
    if contact.entity_type == "company"
      contact.employees.first&.last_name || contact.company_name_or_trust
    else
      contact.last_name || contact.display_name
    end
  end

  def contract_party_name(contact)
    if contact.entity_type.in?(%w[company trust])
      name = contact.company_name_or_trust || contact.display_name
      contact.abn.present? ? "#{name} ABN #{format_abn(contact.abn)}" : name
    else
      contact.display_name
    end
  end

  def format_multi_list(items)
    items = items.compact.reject(&:blank?)
    case items.size
    when 0 then ""
    when 1 then items.first
    when 2 then items.join(" & ")
    else "#{items[0..-2].join(', ')} & #{items.last}"
    end
  end

  # ===== Formatting Helpers =====

  def format_currency(amount)
    return "" unless amount
    "$#{'%.2f' % amount}"
  end

  def format_date(date)
    return "" unless date
    date.strftime("%d/%m/%Y")
  end

  def format_abn(abn)
    return abn unless abn.present?
    digits = abn.to_s.gsub(/\D/, "")
    return abn if digits.length != 11
    "#{digits[0..1]} #{digits[2..4]} #{digits[5..7]} #{digits[8..10]}"
  end

  def format_phone(phone)
    return phone unless phone.present?
    digits = phone.to_s.gsub(/\D/, "")
    return phone if digits.length != 10
    if digits.start_with?("04")
      "#{digits[0..3]} #{digits[4..6]} #{digits[7..9]}"
    else
      "#{digits[0..1]} #{digits[2..5]} #{digits[6..9]}"
    end
  end

  def build_full_address(contact)
    parts = [ contact.try(:address) ]
    parts << [ contact.try(:city), contact.try(:state), contact.try(:postcode) ].compact.reject(&:blank?).join(" ")
    parts.compact.reject(&:blank?).join(", ")
  end

  def parse_address(address)
    return { line_1: "", line_2: "", suburb: "", state: "", postcode: "" } unless address.present?

    lines = address.split(/[\n,]/).map(&:strip).reject(&:blank?)

    result = {
      line_1: lines[0] || "",
      line_2: lines[1..].join(", "),
      suburb: "",
      state: "",
      postcode: ""
    }

    if lines.length > 1
      last_line = lines.last
      if (match = last_line.match(/^(.+?)\s+([A-Z]{2,3})\s+(\d{4})$/))
        result[:suburb] = match[1].strip
        result[:state] = match[2]
        result[:postcode] = match[3]
      end
    end

    result
  end

  # Fetch an existing PDF from SharePoint instead of generating
  # Used for documents like "All Plans" that are uploaded separately
  # Generate PDF using overlay engine (for QBCC official documents)
  # Uses HexaPDF to fill form fields and overlay text on official PDF templates
  def generate_pdf_overlay(job:, contact:, extra_data:)
    engine = Engines::PdfOverlayEngine.new(template_key)
    pdf_content = engine.generate(job: job, contact: contact, extra_data: extra_data)

    {
      html: nil, # No HTML for PDF overlay documents
      pdf_content: pdf_content,
      filename: generate_filename(job: job, extra_data: extra_data),
      generated_at: Time.current,
      template: template_key,
      title: template_config[:title],
      source: :pdf_overlay
    }
  rescue Engines::PdfOverlayEngine::TemplateNotFoundError => e
    raise GenerationError, "PDF template not found: #{e.message}"
  rescue Engines::PdfOverlayEngine::OverlayError => e
    raise GenerationError, "PDF overlay failed: #{e.message}"
  end

  def fetch_from_sharepoint(job:)
    sharepoint_path = template_config[:sharepoint_path]
    raise GenerationError, "SharePoint path not configured for #{template_key}" unless sharepoint_path

    credential = MicrosoftCredential.sharepoint_credential
    raise GenerationError, "No active OneDrive credential" unless credential

    client = MicrosoftGraphClient.new(credential)

    # Find the job folder
    job_folder = client.find_job_folder(job)
    raise GenerationError, "Job folder not found in SharePoint for #{job.name}" unless job_folder

    # Navigate to the file path
    path_parts = sharepoint_path.split("/")
    filename = path_parts.pop
    current_folder_id = job_folder["id"]

    # Navigate through subfolders (SSoT: resolve folder names from EntityTab)
    path_parts.each do |folder_name|
      # SSoT: If folder matches a known tab pattern, resolve from EntityTab
      resolved_folder_name = resolve_folder_name(folder_name)

      response = client.list_folder_items(current_folder_id)
      items = response["value"] || []
      folder = items.find { |item| item["name"] == resolved_folder_name && item["folder"].present? }
      raise GenerationError, "Folder '#{resolved_folder_name}' not found in job folder" unless folder
      current_folder_id = folder["id"]
    end

    # Find and download the file - try primary filename first, then alternative
    response = client.list_folder_items(current_folder_id)
    items = response["value"] || []
    file = items.find { |item| item["name"] == filename && item["file"].present? }

    # Try alternative filename if primary not found (handles URL encoding variations)
    if file.nil? && template_config[:sharepoint_path_alt]
      alt_filename = template_config[:sharepoint_path_alt].split("/").last
      file = items.find { |item| item["name"] == alt_filename && item["file"].present? }
    end

    raise GenerationError, "File '#{filename}' not found in #{path_parts.join('/')}" unless file

    pdf_content = client.download_file(file["id"])
    raise GenerationError, "Failed to download file from SharePoint" unless pdf_content

    {
      html: nil, # No HTML for SharePoint-sourced files
      pdf_content: pdf_content,
      filename: generate_filename(job: job),
      generated_at: Time.current,
      template: template_key,
      title: template_config[:title],
      source: :sharepoint,
      sharepoint_file_id: file["id"],
      sharepoint_web_url: file["webUrl"]
    }
  rescue MicrosoftGraphClient::ClientError, MicrosoftGraphClient::AuthenticationError => e
    raise GenerationError, "SharePoint error: #{e.message}"
  end

  # SSoT: Resolve folder names from EntityTab
  # Maps template folder names to actual folder names from EntityTab
  # Falls back to original name if no mapping exists
  FOLDER_NAME_MAPPINGS = {
    "04 Plans" => ["job", "plans"],
    "Documents" => ["job", "documents"],
    "Photos" => ["job", "photos"]
  }.freeze

  def resolve_folder_name(folder_name)
    mapping = FOLDER_NAME_MAPPINGS[folder_name]
    return folder_name unless mapping

    scope, tab_key = mapping
    EntityTab.folder_name_for(scope, tab_key, folder_name)
  end
end
