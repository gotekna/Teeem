# frozen_string_literal: true

# InvoicePdfGenerator renders invoice PDFs from code-driven InvoiceTemplate sections.
#
# Usage:
#   generator = InvoicePdfGenerator.new(template: InvoiceTemplate.default)
#   result = generator.generate(invoice: invoice, job: job, contact: contact, claim_stage: stage)
#   # result[:pdf_content] - PDF binary
#   # result[:filename] - Generated filename
#   # result[:html] - Rendered HTML (for debugging)
#
class InvoicePdfGenerator
  class GenerationError < StandardError; end

  attr_reader :template

  def initialize(template:)
    @template = template || InvoiceTemplate.default
    raise GenerationError, "No invoice template available" unless @template
  end

  # Generate PDF and return result hash
  def generate(invoice:, job: nil, contact: nil, claim_stage: nil)
    context = build_context(
      invoice: invoice,
      job: job || invoice&.job,
      contact: contact || invoice&.contact,
      claim_stage: claim_stage
    )

    html = render_html(context)
    pdf_content = convert_to_pdf(html)

    {
      pdf_content: pdf_content,
      html: html,
      filename: template.generate_filename(invoice: invoice, job: job || invoice&.job),
      generated_at: Time.current,
      template_id: template.id,
      template_name: template.name
    }
  end

  # Preview HTML only (no PDF conversion)
  def preview(invoice:, job: nil, contact: nil, claim_stage: nil)
    context = build_context(
      invoice: invoice,
      job: job || invoice&.job,
      contact: contact || invoice&.contact,
      claim_stage: claim_stage
    )
    render_html(context)
  end

  private

  def build_context(invoice:, job:, contact:, claim_stage:)
    {
      template: template,
      invoice: build_invoice_context(invoice),
      job: build_job_context(job),
      client: build_contact_context(contact),
      claim_stage: build_claim_stage_context(claim_stage),
      company: build_company_context,
      sections: template.visible_sections,
      generated_date: Date.current.strftime("%d/%m/%Y"),
      generated_date_long: Date.current.strftime("%d %B %Y")
    }
  end

  def build_invoice_context(invoice)
    return {} unless invoice

    {
      id: invoice.id,
      invoice_number: invoice.invoice_number || "DRAFT",
      reference: invoice.reference,
      external_id: invoice.external_id,
      status: invoice.status,
      status_display: invoice.status&.titleize,

      # Dates
      invoice_date: invoice.invoice_date,
      invoice_date_formatted: format_date(invoice.invoice_date),
      invoice_date_long: invoice.invoice_date&.strftime("%d %B %Y"),
      due_date: invoice.due_date,
      due_date_formatted: format_date(invoice.due_date),
      due_date_long: invoice.due_date&.strftime("%d %B %Y"),
      fully_paid_date: invoice.fully_paid_date,
      fully_paid_date_formatted: format_date(invoice.fully_paid_date),

      # Amounts
      subtotal: invoice.subtotal,
      subtotal_formatted: format_currency(invoice.subtotal),
      total_tax: invoice.total_tax,
      total_tax_formatted: format_currency(invoice.total_tax),
      total: invoice.total,
      total_formatted: format_currency(invoice.total),
      amount_due: invoice.amount_due,
      amount_due_formatted: format_currency(invoice.amount_due),
      amount_paid: invoice.amount_paid,
      amount_paid_formatted: format_currency(invoice.amount_paid),

      # Status checks
      is_paid: invoice.status == "paid",
      is_draft: invoice.status == "draft",
      is_overdue: invoice.due_date.present? && invoice.due_date < Date.current && invoice.status != "paid",
      has_balance: invoice.amount_due.to_f > 0,

      # Line items
      line_items: build_line_items(invoice),

      # Currency
      currency_code: invoice.currency_code || "AUD",
      currency_symbol: "$"
    }
  end

  def build_line_items(invoice)
    return [] unless invoice&.line_items.present?

    invoice.line_items.map do |item|
      {
        description: item["Description"],
        quantity: item["Quantity"] || 1,
        unit_price: item["UnitAmount"],
        unit_price_formatted: format_currency(item["UnitAmount"]),
        amount: (item["Quantity"] || 1) * (item["UnitAmount"] || 0),
        amount_formatted: format_currency((item["Quantity"] || 1) * (item["UnitAmount"] || 0)),
        account_code: item["AccountCode"],
        tax_type: item["TaxType"]
      }
    end
  end

  def build_job_context(job)
    return {} unless job

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
      address: street_address.presence || job.try(:address),
      suburb: job.try(:suburb),
      state: job.try(:state),
      postcode: job.try(:postcode),
      full_address: [street_address, job.try(:suburb), job.try(:state), job.try(:postcode)].compact.reject(&:blank?).join(", "),

      # Contract details
      # SSoT: contract_price is THE ONE
      contract_value: job.try(:contract_price),
      contract_value_formatted: format_currency(job.try(:contract_price)),

      # Dates
      contract_date: format_date(job.try(:contract_date)),
      site_start_date: format_date(job.try(:site_start_date))
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

      # Contact details
      email: contact.try(:email),
      phone: contact.try(:office_phone) || contact.try(:mobile_phone),

      # Business details
      company_name: contact.try(:company_name_or_trust),
      abn: contact.try(:abn),
      abn_formatted: format_abn(contact.try(:abn)),

      # Address
      address: contact.try(:address),
      suburb: contact.try(:city),
      state: contact.try(:state),
      postcode: contact.try(:postcode),
      full_address: build_full_address(contact)
    }
  end

  def build_claim_stage_context(claim_stage)
    return {} unless claim_stage

    {
      id: claim_stage.id,
      name: claim_stage.name,
      percentage: claim_stage.percentage,
      percentage_formatted: claim_stage.percentage.present? ? "#{claim_stage.percentage}%" : nil,
      expected_amount: claim_stage.expected_amount,
      expected_amount_formatted: format_currency(claim_stage.expected_amount),
      description: claim_stage.description,
      sequence_order: claim_stage.sequence_order
    }
  end

  def build_company_context
    settings = TenantSetting.instance

    {
      name: settings.company_name,
      company_name: settings.company_name,
      abn: settings.abn,
      abn_formatted: format_abn(settings.abn),
      qbcc_license: settings.qbcc_license,

      email: settings.email,
      phone: settings.phone,
      phone_formatted: format_phone(settings.phone),
      website: settings.try(:website),

      address: settings.address,
      full_address: settings.address&.gsub("\n", ", "),

      logo_url: settings.logo_url || template.logo_url
    }
  end

  def render_html(context)
    # Build HTML from template sections
    sections_html = template.visible_sections.map do |section|
      render_section(section, context)
    end.join("\n")

    # Wrap in full HTML document with styles
    <<~HTML
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice #{context.dig(:invoice, :invoice_number)}</title>
        <style>
          #{base_styles}
          #{template_styles(context)}
        </style>
      </head>
      <body>
        <div class="invoice-container">
          #{sections_html}
        </div>
      </body>
      </html>
    HTML
  end

  def render_section(section, context)
    type = section["type"]
    content = section["content"] || {}

    case type
    when "header"
      render_header_section(content, context)
    when "client"
      render_client_section(content, context)
    when "job"
      render_job_section(content, context)
    when "line_items"
      render_line_items_section(content, context)
    when "totals"
      render_totals_section(content, context)
    when "payment"
      render_payment_section(content, context)
    when "footer"
      render_footer_section(content, context)
    when "custom"
      render_custom_section(content, context)
    else
      ""
    end
  end

  def render_header_section(content, context)
    company = context[:company]
    invoice = context[:invoice]

    logo_html = if content["show_logo"] && company[:logo_url].present?
      %(<img src="#{company[:logo_url]}" class="logo" style="max-height: #{content['logo_max_height'] || 80}px" />)
    else
      ""
    end

    company_info = []
    company_info << %(<div class="company-name">#{company[:name]}</div>) if content["show_company_name"]
    company_info << %(<div class="company-address">#{company[:full_address]}</div>) if content["show_company_address"]
    company_info << %(<div class="company-abn">ABN: #{company[:abn_formatted]}</div>) if content["show_company_abn"] && company[:abn].present?

    invoice_info = []
    invoice_info << %(<div class="invoice-number"><strong>Invoice #:</strong> #{invoice[:invoice_number]}</div>) if content["show_invoice_number"]
    invoice_info << %(<div class="invoice-date"><strong>Date:</strong> #{invoice[:invoice_date_formatted]}</div>) if content["show_invoice_date"]
    invoice_info << %(<div class="due-date"><strong>Due:</strong> #{invoice[:due_date_formatted]}</div>) if content["show_due_date"]

    title = content["title"] || "TAX INVOICE"
    title_class = content["title_style"] == "uppercase" ? "title uppercase" : "title"

    <<~HTML
      <div class="section header-section">
        <div class="header-row">
          <div class="header-left">
            #{logo_html}
            <div class="company-info">
              #{company_info.join("\n")}
            </div>
          </div>
          <div class="header-right">
            <div class="#{title_class}">#{title}</div>
            <div class="invoice-details">
              #{invoice_info.join("\n")}
            </div>
          </div>
        </div>
      </div>
    HTML
  end

  def render_client_section(content, context)
    client = context[:client]
    return "" if client.empty?

    label = content["label"] || "Bill To"

    client_info = []
    client_info << %(<div class="client-company">#{client[:company_name]}</div>) if content["show_company"] && client[:company_name].present?
    client_info << %(<div class="client-name">#{client[:display_name]}</div>) if content["show_name"] && !client[:is_company]
    client_info << %(<div class="client-address">#{client[:full_address]}</div>) if content["show_address"] && client[:full_address].present?
    client_info << %(<div class="client-email">#{client[:email]}</div>) if content["show_email"] && client[:email].present?
    client_info << %(<div class="client-phone">#{client[:phone]}</div>) if content["show_phone"] && client[:phone].present?
    client_info << %(<div class="client-abn">ABN: #{client[:abn_formatted]}</div>) if content["show_abn"] && client[:abn].present?

    <<~HTML
      <div class="section client-section">
        <div class="section-label">#{label}</div>
        <div class="client-info">
          #{client_info.join("\n")}
        </div>
      </div>
    HTML
  end

  def render_job_section(content, context)
    job = context[:job]
    claim_stage = context[:claim_stage]
    return "" if job.empty?

    label = content["label"] || "Job Reference"

    job_info = []
    job_info << %(<div class="job-number"><strong>Job #:</strong> #{job[:job_number]}</div>) if content["show_job_number"]
    job_info << %(<div class="job-name"><strong>Project:</strong> #{job[:name]}</div>) if content["show_job_name"]
    job_info << %(<div class="job-address"><strong>Site:</strong> #{job[:full_address]}</div>) if content["show_job_address"]
    job_info << %(<div class="contract-value"><strong>Contract Value:</strong> #{job[:contract_value_formatted]}</div>) if content["show_contract_value"] && job[:contract_value].present?
    job_info << %(<div class="claim-stage"><strong>Claim Stage:</strong> #{claim_stage[:name]} (#{claim_stage[:percentage_formatted]})</div>) if content["show_claim_stage"] && claim_stage[:name].present?

    <<~HTML
      <div class="section job-section">
        <div class="section-label">#{label}</div>
        <div class="job-info">
          #{job_info.join("\n")}
        </div>
      </div>
    HTML
  end

  def render_line_items_section(content, context)
    line_items = context.dig(:invoice, :line_items) || []
    return "" if line_items.empty?

    columns = content["columns"] || %w[description quantity unit_price amount]
    column_labels = content["column_labels"] || {
      "description" => "Description",
      "quantity" => "Qty",
      "unit_price" => "Unit Price",
      "amount" => "Amount"
    }

    # Build header row
    header_cells = columns.map do |col|
      label = column_labels[col] || col.titleize
      align = %w[quantity unit_price amount].include?(col) ? "right" : "left"
      %(<th class="col-#{col}" style="text-align: #{align}">#{label}</th>)
    end.join("\n")

    # Build data rows
    rows_html = line_items.each_with_index.map do |item, idx|
      row_class = content["alternate_rows"] && idx.even? ? "even-row" : "odd-row"
      cells = columns.map do |col|
        align = %w[quantity unit_price amount].include?(col) ? "right" : "left"
        value = case col
                when "description" then item[:description]
                when "quantity" then item[:quantity]
                when "unit_price" then item[:unit_price_formatted]
                when "amount" then item[:amount_formatted]
                else item[col.to_sym]
                end
        %(<td style="text-align: #{align}">#{value}</td>)
      end.join("\n")
      %(<tr class="#{row_class}">#{cells}</tr>)
    end.join("\n")

    header_row = content["show_headers"] != false ? %(<thead><tr>#{header_cells}</tr></thead>) : ""

    <<~HTML
      <div class="section line-items-section">
        <table class="line-items-table">
          #{header_row}
          <tbody>
            #{rows_html}
          </tbody>
        </table>
      </div>
    HTML
  end

  def render_totals_section(content, context)
    invoice = context[:invoice]

    rows = []

    if content["show_subtotal"]
      label = content["subtotal_label"] || "Subtotal"
      rows << %(<tr><td class="total-label">#{label}</td><td class="total-value">#{invoice[:subtotal_formatted]}</td></tr>)
    end

    if content["show_tax"]
      label = content["tax_label"] || "GST (10%)"
      rows << %(<tr><td class="total-label">#{label}</td><td class="total-value">#{invoice[:total_tax_formatted]}</td></tr>)
    end

    if content["show_total"]
      label = content["total_label"] || "Total (inc GST)"
      rows << %(<tr class="total-row"><td class="total-label"><strong>#{label}</strong></td><td class="total-value"><strong>#{invoice[:total_formatted]}</strong></td></tr>)
    end

    if content["show_amount_paid"] && invoice[:amount_paid].to_f > 0
      label = content["paid_label"] || "Amount Paid"
      rows << %(<tr><td class="total-label">#{label}</td><td class="total-value">#{invoice[:amount_paid_formatted]}</td></tr>)
    end

    if content["show_amount_due"] && invoice[:has_balance]
      label = content["due_label"] || "Amount Due"
      highlight_class = content["highlight_due"] ? "highlight" : ""
      rows << %(<tr class="due-row #{highlight_class}"><td class="total-label"><strong>#{label}</strong></td><td class="total-value"><strong>#{invoice[:amount_due_formatted]}</strong></td></tr>)
    end

    <<~HTML
      <div class="section totals-section">
        <table class="totals-table">
          <tbody>
            #{rows.join("\n")}
          </tbody>
        </table>
      </div>
    HTML
  end

  def render_payment_section(content, context)
    return "" unless content["show_bank_details"] && template.bank_details.present?

    bank = template.bank_details
    label = content["label"] || "Payment Details"

    payment_info = []
    payment_info << %(<div><strong>Bank:</strong> #{bank[:bank_name]}</div>) if bank[:bank_name].present?
    payment_info << %(<div><strong>BSB:</strong> #{bank[:bsb]}</div>) if bank[:bsb].present?
    payment_info << %(<div><strong>Account:</strong> #{bank[:account_number]}</div>) if bank[:account_number].present?
    payment_info << %(<div><strong>Name:</strong> #{bank[:account_name]}</div>) if bank[:account_name].present?

    reference_note = if content["show_payment_reference"]
      note = content["payment_reference_note"] || "Please use invoice number as payment reference"
      %(<div class="payment-reference">#{note}</div>)
    else
      ""
    end

    <<~HTML
      <div class="section payment-section">
        <div class="section-label">#{label}</div>
        <div class="payment-info">
          #{payment_info.join("\n")}
        </div>
        #{reference_note}
      </div>
    HTML
  end

  def render_footer_section(content, context)
    parts = []

    if content["show_terms"] && template.default_terms.present?
      label = content["terms_label"] || "Terms & Conditions"
      terms = template.default_terms.gsub("\n", "<br>")
      parts << %(<div class="footer-terms"><strong>#{label}:</strong><br>#{terms}</div>)
    end

    if content["show_notes"] && template.default_notes.present?
      label = content["notes_label"] || "Notes"
      parts << %(<div class="footer-notes"><strong>#{label}:</strong> #{template.default_notes}</div>)
    end

    if content["show_footer_text"] && template.footer_text.present?
      parts << %(<div class="footer-text">#{template.footer_text}</div>)
    end

    return "" if parts.empty?

    <<~HTML
      <div class="section footer-section">
        #{parts.join("\n")}
      </div>
    HTML
  end

  def render_custom_section(content, context)
    return "" unless content["html"].present?

    <<~HTML
      <div class="section custom-section">
        #{content['html']}
      </div>
    HTML
  end

  def base_styles
    <<~CSS
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: #{template.font_family || 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'};
        font-size: 11pt;
        line-height: 1.4;
        color: #1f2937;
      }

      .invoice-container {
        max-width: 210mm;
        margin: 0 auto;
        padding: #{template.margins['top'] || 25}mm #{template.margins['right'] || 20}mm #{template.margins['bottom'] || 25}mm #{template.margins['left'] || 20}mm;
      }

      .section {
        margin-bottom: 20px;
      }

      .section-label {
        font-weight: 600;
        color: #{template.accent_color || '#4f46e5'};
        margin-bottom: 8px;
        font-size: 10pt;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Header Section */
      .header-section {
        border-bottom: 2px solid #{template.primary_color || '#1f2937'};
        padding-bottom: 20px;
        margin-bottom: 25px;
      }

      .header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .header-left {
        display: flex;
        align-items: flex-start;
        gap: 15px;
      }

      .logo {
        max-height: 80px;
        width: auto;
      }

      .company-name {
        font-size: 16pt;
        font-weight: 700;
        color: #{template.primary_color || '#1f2937'};
      }

      .company-address, .company-abn {
        font-size: 9pt;
        color: #6b7280;
      }

      .header-right {
        text-align: right;
      }

      .title {
        font-size: 24pt;
        font-weight: 700;
        color: #{template.primary_color || '#1f2937'};
        margin-bottom: 10px;
      }

      .title.uppercase {
        text-transform: uppercase;
        letter-spacing: 2px;
      }

      .invoice-details {
        font-size: 10pt;
      }

      .invoice-details div {
        margin-bottom: 3px;
      }

      /* Client Section */
      .client-section {
        background: #f9fafb;
        padding: 15px;
        border-radius: 4px;
      }

      .client-company {
        font-weight: 600;
        font-size: 12pt;
      }

      /* Job Section */
      .job-section {
        background: #f0f9ff;
        padding: 15px;
        border-radius: 4px;
        border-left: 3px solid #{template.accent_color || '#4f46e5'};
      }

      .job-info div {
        margin-bottom: 3px;
      }

      /* Line Items Table */
      .line-items-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }

      .line-items-table th {
        background: #{template.primary_color || '#1f2937'};
        color: white;
        padding: 10px 12px;
        font-weight: 600;
        font-size: 9pt;
        text-transform: uppercase;
      }

      .line-items-table td {
        padding: 10px 12px;
        border-bottom: 1px solid #e5e7eb;
      }

      .line-items-table .even-row {
        background: #f9fafb;
      }

      .line-items-table .col-description {
        width: 50%;
      }

      /* Totals Section */
      .totals-section {
        display: flex;
        justify-content: flex-end;
      }

      .totals-table {
        width: 250px;
        border-collapse: collapse;
      }

      .totals-table td {
        padding: 8px 12px;
      }

      .totals-table .total-label {
        text-align: right;
        color: #6b7280;
      }

      .totals-table .total-value {
        text-align: right;
        font-family: 'JetBrains Mono', monospace;
      }

      .totals-table .total-row {
        border-top: 2px solid #{template.primary_color || '#1f2937'};
      }

      .totals-table .due-row.highlight {
        background: #fef3c7;
        font-size: 12pt;
      }

      /* Payment Section */
      .payment-section {
        background: #f9fafb;
        padding: 15px;
        border-radius: 4px;
        margin-top: 20px;
      }

      .payment-info {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 5px;
        font-size: 10pt;
      }

      .payment-reference {
        margin-top: 10px;
        font-style: italic;
        color: #6b7280;
        font-size: 9pt;
      }

      /* Footer Section */
      .footer-section {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
        font-size: 9pt;
        color: #6b7280;
      }

      .footer-terms {
        margin-bottom: 15px;
      }

      .footer-text {
        text-align: center;
        margin-top: 15px;
      }

      /* Print styles */
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }

      @page {
        size: #{template.paper_size || 'A4'} #{template.orientation || 'portrait'};
        margin: 0;
      }
    CSS
  end

  def template_styles(context)
    # Additional template-specific styles can be added here
    ""
  end

  def convert_to_pdf(html)
    Grover.new(html, **grover_options).to_pdf
  end

  def grover_options
    {
      format: template.paper_size || "A4",
      margin: {
        top: "0mm",
        bottom: "0mm",
        left: "0mm",
        right: "0mm"
      },
      print_background: true,
      prefer_css_page_size: true,
      display_header_footer: false,
      launch_args: ["--no-sandbox", "--disable-dev-shm-usage"]
    }
  end

  # Formatting helpers

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
    parts = [contact.try(:address)]
    parts << [contact.try(:city), contact.try(:state), contact.try(:postcode)].compact.reject(&:blank?).join(" ")
    parts.compact.reject(&:blank?).join(", ")
  end
end
