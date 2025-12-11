# frozen_string_literal: true

# Parses invoice PDFs using AI to extract structured data
# Uses Claude to analyze the document and extract:
# - Supplier details (name, ABN)
# - Invoice details (number, dates, amounts)
# - Line items
# - Bill-to company (for multi-tenant matching)
#
class InvoiceParsingService
  CLAUDE_MODEL = "claude-sonnet-4-5-20250929"

  def initialize(bill_inbox)
    @bill = bill_inbox
  end

  def extract!
    return {} unless @bill.invoice_file.attached?

    Rails.logger.info "[InvoiceParsing] Starting extraction for BillInbox ##{@bill.id}"

    # Extract text from PDF
    pdf_text = extract_pdf_text

    # Use Claude to parse the invoice
    result = call_ai(pdf_text)

    # Update bill with extracted data
    update_bill_with_result(result)

    # Try to match supplier by ABN
    match_supplier!

    # Try to detect Bill To company from ABN
    detect_company!

    Rails.logger.info "[InvoiceParsing] Completed extraction for BillInbox ##{@bill.id}"
    result
  rescue StandardError => e
    Rails.logger.error "[InvoiceParsing] Error extracting BillInbox ##{@bill.id}: #{e.message}"
    @bill.update!(status: "error", notes: "Extraction failed: #{e.message}")
    raise
  end

  private

  def extract_pdf_text
    # Download raw bytes directly - bypasses ActiveStorage integrity check
    # which can fail when checksums don't match (common with SharePoint storage)
    content = @bill.invoice_file.download

    if @bill.content_type == "application/pdf"
      # Write to temp file for PDF::Reader
      Tempfile.create(["invoice", ".pdf"], binmode: true) do |temp_file|
        temp_file.write(content)
        temp_file.rewind
        reader = PDF::Reader.new(temp_file.path)
        reader.pages.map(&:text).join("\n")
      end
    else
      # For images, we'll rely on Claude's vision capability
      ""
    end
  end

  def call_ai(pdf_text)
    api_key = ENV["ANTHROPIC_API_KEY"]
    raise "ANTHROPIC_API_KEY not configured" if api_key.blank?

    client = Anthropic::Client.new(access_token: api_key)
    messages = build_messages(pdf_text)

    response = client.messages(
      parameters: {
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        messages: messages
      }
    )

    parse_response(response.dig("content", 0, "text"))
  end

  def build_messages(pdf_text)
    if @bill.content_type == "application/pdf" && pdf_text.present?
      # Text-based extraction
      [{ role: "user", content: build_text_prompt(pdf_text) }]
    else
      # Vision-based extraction for images
      build_vision_messages
    end
  end

  def build_text_prompt(pdf_text)
    <<~PROMPT
      Extract invoice details from this PDF text. Return ONLY valid JSON with no additional text.

      PDF Content:
      #{pdf_text.truncate(8000)}

      Extract and return this exact JSON structure:
      {
        "supplier_name": "company name issuing the invoice",
        "supplier_abn": "11 digit ABN without spaces if present, null otherwise",
        "bill_to_name": "company name being billed",
        "bill_to_abn": "ABN of company being billed if present, null otherwise",
        "invoice_number": "invoice/reference number",
        "invoice_date": "YYYY-MM-DD format or null",
        "due_date": "YYYY-MM-DD format or null",
        "subtotal": numeric_value_without_gst_or_null,
        "tax_amount": gst_amount_or_null,
        "total_amount": total_inc_gst,
        "currency": "AUD",
        "line_items": [
          {"description": "...", "quantity": 1, "unit_price": 100.00, "amount": 100.00, "gst": 10.00}
        ],
        "po_number": "purchase order number if referenced, null otherwise",
        "payment_terms": "e.g., Net 30, null if not specified",
        "bank_details": {
          "bsb": "BSB if provided",
          "account_number": "account number if provided",
          "account_name": "account name if provided"
        },
        "confidence": 0.0 to 1.0
      }

      Important:
      - ABN is always 11 digits (remove spaces)
      - Dates must be YYYY-MM-DD format
      - All amounts should be numbers, not strings
      - Return null for fields you cannot find, not empty strings
      - confidence should reflect how certain you are about the extracted data
    PROMPT
  end

  def build_vision_messages
    # For image-based invoices, use Claude's vision capability
    # Download raw bytes directly - bypasses ActiveStorage integrity check
    content = @bill.invoice_file.download
    image_data = Base64.strict_encode64(content)
    media_type = @bill.content_type

    [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: media_type,
              data: image_data
            }
          },
          {
            type: "text",
            text: build_vision_prompt
          }
        ]
      }
    ]
  end

  def build_vision_prompt
    <<~PROMPT
      This is an invoice image. Extract all invoice details and return ONLY valid JSON.

      Extract and return this exact JSON structure:
      {
        "supplier_name": "company name issuing the invoice",
        "supplier_abn": "11 digit ABN without spaces if present, null otherwise",
        "bill_to_name": "company name being billed",
        "bill_to_abn": "ABN of company being billed if present, null otherwise",
        "invoice_number": "invoice/reference number",
        "invoice_date": "YYYY-MM-DD format or null",
        "due_date": "YYYY-MM-DD format or null",
        "subtotal": numeric_value_without_gst_or_null,
        "tax_amount": gst_amount_or_null,
        "total_amount": total_inc_gst,
        "currency": "AUD",
        "line_items": [
          {"description": "...", "quantity": 1, "unit_price": 100.00, "amount": 100.00, "gst": 10.00}
        ],
        "po_number": "purchase order number if referenced, null otherwise",
        "payment_terms": "e.g., Net 30, null if not specified",
        "bank_details": {
          "bsb": "BSB if provided",
          "account_number": "account number if provided",
          "account_name": "account name if provided"
        },
        "confidence": 0.0 to 1.0
      }

      Return ONLY the JSON, no explanations.
    PROMPT
  end

  def parse_response(text)
    return {} if text.blank?

    # Extract JSON from response
    json_match = text.match(/\{[\s\S]*\}/)
    return {} unless json_match

    JSON.parse(json_match[0]).with_indifferent_access
  rescue JSON::ParserError => e
    Rails.logger.error "[InvoiceParsing] JSON parse error: #{e.message}"
    {}
  end

  def update_bill_with_result(result)
    @bill.update!(
      supplier_name_raw: result[:supplier_name],
      supplier_abn_raw: clean_abn(result[:supplier_abn]),
      invoice_number: result[:invoice_number],
      invoice_date: parse_date(result[:invoice_date]),
      due_date: parse_date(result[:due_date]),
      subtotal: result[:subtotal],
      tax_amount: result[:tax_amount],
      total_amount: result[:total_amount],
      currency: result[:currency] || "AUD",
      line_items: result[:line_items] || [],
      ai_confidence: result[:confidence],
      ai_extraction_result: result,
      extracted_at: Time.current,
      status: "extracted"
    )
  end

  def match_supplier!
    return if @bill.supplier_abn_raw.blank?

    # Clean ABN
    abn = clean_abn(@bill.supplier_abn_raw)
    return if abn.blank?

    # Find contact by ABN
    contact = Contact.find_by(tax_number: abn)
    contact ||= Contact.where("REPLACE(tax_number, ' ', '') = ?", abn).first

    if contact
      @bill.update!(supplier: contact)
      Rails.logger.info "[InvoiceParsing] Matched supplier: #{contact.display_name} (ABN: #{abn})"
    else
      Rails.logger.info "[InvoiceParsing] No supplier found for ABN: #{abn}"
    end
  end

  def detect_company!
    result = @bill.ai_extraction_result
    bill_to_abn = clean_abn(result["bill_to_abn"])

    return if bill_to_abn.blank?

    company = CorporateCompany.find_by(abn: bill_to_abn)
    company ||= CorporateCompany.where("REPLACE(abn, ' ', '') = ?", bill_to_abn).first

    if company
      @bill.update!(detected_company: company, corporate_company: company)
      Rails.logger.info "[InvoiceParsing] Detected bill-to company: #{company.name}"
    end
  end

  def clean_abn(abn)
    return nil if abn.blank?

    abn.to_s.gsub(/\s/, "")
  end

  def parse_date(date_str)
    return nil if date_str.blank?

    Date.parse(date_str)
  rescue ArgumentError
    nil
  end
end
