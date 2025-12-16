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

    # Run OCR extraction (Tesseract) for exact coordinates
    Rails.logger.info "[InvoiceParsing] Running OCR extraction..."
    ocr_result = OcrExtractionService.new(@bill).extract!

    # Extract text from PDF
    pdf_text = extract_pdf_text

    # Use Claude to parse the invoice (with vision for field locations)
    Rails.logger.info "[InvoiceParsing] Running AI extraction..."
    ai_result = call_ai(pdf_text)

    # Compare OCR and AI results to match fields with exact coordinates
    Rails.logger.info "[InvoiceParsing] Comparing OCR and AI results..."
    comparison = compare_ocr_and_ai(ocr_result, ai_result)

    # Update bill with all extraction data
    update_bill_with_results(ai_result, ocr_result, comparison)

    # Try to match supplier by ABN
    match_supplier!

    # Try to detect Bill To company from ABN
    detect_company!

    Rails.logger.info "[InvoiceParsing] Completed extraction for BillInbox ##{@bill.id}"
    ai_result
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
      Tempfile.create([ "invoice", ".pdf" ], binmode: true) do |temp_file|
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

  # Convert PDF to PNG image for vision-based extraction
  def pdf_to_image
    content = @bill.invoice_file.download

    Tempfile.create([ "invoice", ".pdf" ], binmode: true) do |pdf_file|
      pdf_file.write(content)
      pdf_file.rewind

      # Use MiniMagick to convert PDF to PNG (first page only for now)
      # Higher density = better quality for text recognition
      image = MiniMagick::Image.open(pdf_file.path)
      image.format "png"
      image.density 150  # DPI - balance between quality and size

      # Read the converted image
      image.to_blob
    end
  rescue StandardError => e
    Rails.logger.error "[InvoiceParsing] PDF to image conversion failed: #{e.message}"
    nil
  end

  def call_ai(pdf_text)
    api_key = ENV["ANTHROPIC_API_KEY"]
    raise "ANTHROPIC_API_KEY not configured" if api_key.blank?

    client = Anthropic::Client.new(access_token: api_key)
    messages = build_messages(pdf_text)

    response = client.messages(
      parameters: {
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        messages: messages
      }
    )

    parse_response(response.dig("content", 0, "text"))
  end

  def build_messages(pdf_text)
    # Always use vision for accurate field_locations
    # PDFs are converted to images first
    build_vision_messages
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
        "billing_company_name": "company name being billed (look for 'Bill To', 'Attention', address block)",
        "billing_company_abn": "ABN of company being billed if present, null otherwise",
        "invoice_number": "invoice/reference number",
        "invoice_date": "YYYY-MM-DD format or null",
        "due_date": "YYYY-MM-DD format or null",
        "subtotal": numeric_value_without_gst_or_null,
        "tax_amount": gst_amount_or_null,
        "total_amount": total_inc_gst,
        "balance_due": amount_actually_payable_after_deductions_or_null,
        "trust_deduction": amount_deducted_from_trust_account_or_null,
        "currency": "AUD",
        "line_items": [
          {"description": "...", "quantity": 1, "unit_price": 100.00, "amount": 100.00, "gst": 10.00}
        ],
        "po_number": "purchase order number if referenced, null otherwise",
        "payment_reference": "matter reference, file ref, or payment ref (e.g., 'AM:200261', 'Ref: 12345')",
        "case_reference": "case/matter number if from lawyer/accountant invoice",
        "matter_description": "brief matter/case description if present",
        "payment_terms": "e.g., Net 30, null if not specified",
        "supplier_bank_bsb": "BSB number (6 digits, may have dash) if provided",
        "supplier_bank_account": "bank account number if provided",
        "supplier_bank_name": "account name if provided",
        "confidence": 0.0 to 1.0,
        "field_locations": {
          "supplier_name": {"x": 0.0, "y": 0.0, "width": 0.2, "height": 0.03, "page": 1},
          "invoice_number": {"x": 0.0, "y": 0.0, "width": 0.1, "height": 0.02, "page": 1},
          "total_amount": {"x": 0.0, "y": 0.0, "width": 0.1, "height": 0.02, "page": 1},
          "balance_due": {"x": 0.0, "y": 0.0, "width": 0.1, "height": 0.02, "page": 1},
          "trust_deduction": {"x": 0.0, "y": 0.0, "width": 0.1, "height": 0.02, "page": 1}
        }
      }

      For field_locations: Estimate the position (0.0 to 1.0 as fraction of page) where each field appears:
      - x: left edge position (0=left margin, 1=right margin)
      - y: top edge position (0=top of page, 1=bottom of page)
      - width/height: approximate size of the text
      - Typical positions: letterhead/supplier at top (y=0.05-0.15), invoice details mid-right (y=0.1-0.3), amounts near bottom (y=0.6-0.9)

      Important:
      - ABN is always 11 digits (remove spaces)
      - Dates must be YYYY-MM-DD format
      - All amounts should be numbers, not strings
      - Return null for fields you cannot find, not empty strings
      - confidence should reflect how certain you are about the extracted data

      CRITICAL - billing_company_name extraction:
      - This is the company/person the invoice is addressed TO (the recipient who must pay)
      - Look for: address block near top of invoice, usually with street address, city, postcode
      - For LAWYER/ACCOUNTANT invoices: The billing company is the address block ABOVE the case/matter description
        Example: "W2G Assets Pty Ltd, 160 Alperton Road, BURBANK QLD 4156" is the billing company
        The case description like "[W2G] Caspaney as liquidator..." is NOT the billing company
      - Extract the company name only (e.g., "W2G Assets Pty Ltd"), not the full address

      Other notes:
      - For lawyers/accountants: Look for "Less funds in Trust" or similar for trust_deduction
      - balance_due is the actual amount to pay (total_amount minus trust_deduction if applicable)
      - payment_reference is often near bank details or at top (file ref, matter ref, etc.)
    PROMPT
  end

  def build_vision_messages
    # Use Claude's vision capability for accurate field location detection
    # PDFs are converted to PNG first, images are used directly

    if @bill.content_type == "application/pdf"
      # Convert PDF to image for vision processing
      image_content = pdf_to_image
      raise "Failed to convert PDF to image" if image_content.nil?
      image_data = Base64.strict_encode64(image_content)
      media_type = "image/png"
    else
      # Use image directly
      content = @bill.invoice_file.download
      image_data = Base64.strict_encode64(content)
      media_type = @bill.content_type
    end

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
        "billing_company_name": "company name being billed (look for 'Bill To', 'Attention', address block)",
        "billing_company_abn": "ABN of company being billed if present, null otherwise",
        "invoice_number": "invoice/reference number",
        "invoice_date": "YYYY-MM-DD format or null",
        "due_date": "YYYY-MM-DD format or null",
        "subtotal": numeric_value_without_gst_or_null,
        "tax_amount": gst_amount_or_null,
        "total_amount": total_inc_gst,
        "balance_due": amount_actually_payable_after_deductions_or_null,
        "trust_deduction": amount_deducted_from_trust_account_or_null,
        "currency": "AUD",
        "line_items": [
          {"description": "...", "quantity": 1, "unit_price": 100.00, "amount": 100.00, "gst": 10.00}
        ],
        "po_number": "purchase order number if referenced, null otherwise",
        "payment_reference": "matter reference, file ref, or payment ref (e.g., 'AM:200261', 'Ref: 12345')",
        "case_reference": "case/matter number if from lawyer/accountant invoice",
        "matter_description": "brief matter/case description if present",
        "payment_terms": "e.g., Net 30, null if not specified",
        "supplier_bank_bsb": "BSB number (6 digits, may have dash) if provided",
        "supplier_bank_account": "bank account number if provided",
        "supplier_bank_name": "account name if provided",
        "confidence": 0.0 to 1.0,
        "field_locations": {
          "supplier_name": {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "page": 1},
          "supplier_abn": {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "page": 1},
          "invoice_number": {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "page": 1},
          "invoice_date": {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "page": 1},
          "due_date": {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "page": 1},
          "total_amount": {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "page": 1},
          "balance_due": {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "page": 1},
          "trust_deduction": {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "page": 1},
          "payment_reference": {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "page": 1},
          "billing_company_name": {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "page": 1}
        }
      }

      IMPORTANT for field_locations: Provide bounding box coordinates as percentages (0.0 to 1.0) of the image dimensions.
      - x: left edge as percentage of image width
      - y: top edge as percentage of image height
      - width: box width as percentage of image width
      - height: box height as percentage of image height
      - page: page number (1-indexed)

      CRITICAL - billing_company_name extraction:
      - This is the company/person the invoice is addressed TO (the recipient who must pay)
      - Look for: address block near top of invoice, usually with street address, city, postcode
      - Common patterns: "To:", "Bill To:", "Tax Invoice To:", "Attention:", or just a company name above an address
      - For LAWYER/ACCOUNTANT invoices: The billing company is the address block ABOVE the case/matter description
        Example: "W2G Assets Pty Ltd, 160 Alperton Road, BURBANK QLD 4156" is the billing company
        The case description like "[W2G] Caspaney as liquidator..." is NOT the billing company
      - Extract the company name only (e.g., "W2G Assets Pty Ltd"), not the full address
      - If you see "Pty Ltd", "Ltd", "Inc" - that's likely a company name

      Other important notes:
      - For lawyers/accountants: Look for "Less funds in Trust" or similar for trust_deduction
      - balance_due is the actual amount to pay (total_amount minus trust_deduction if applicable)
      - payment_reference is often near bank details or at top (file ref, matter ref, etc.)
      - Only include field_locations for fields you actually found in the document.

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

  def update_bill_with_results(ai_result, ocr_result, comparison)
    @bill.update!(
      supplier_name_raw: ai_result[:supplier_name],
      supplier_abn_raw: clean_abn(ai_result[:supplier_abn]),
      invoice_number: ai_result[:invoice_number],
      invoice_date: parse_date(ai_result[:invoice_date]),
      due_date: parse_date(ai_result[:due_date]),
      subtotal: ai_result[:subtotal],
      tax_amount: ai_result[:tax_amount],
      total_amount: ai_result[:total_amount],
      currency: ai_result[:currency] || "AUD",
      line_items: ai_result[:line_items] || [],
      ai_confidence: ai_result[:confidence],
      ai_extraction_result: ai_result,
      ocr_extraction_result: ocr_result,
      comparison_data: comparison,
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

  def compare_ocr_and_ai(ocr_result, ai_result)
    return {} if ocr_result.blank? || ai_result.blank?
    return {} if ocr_result[:error].present?

    InvoiceFieldMatcherService.new(ocr_result, ai_result).compare!
  end

  def detect_company!
    result = @bill.ai_extraction_result
    company = nil
    match_strategy = nil

    # Strategy 1: Match by ABN (most reliable)
    bill_to_abn = clean_abn(result["billing_company_abn"] || result["bill_to_abn"])
    if bill_to_abn.present?
      company = CorporateCompany.find_by(abn: bill_to_abn)
      company ||= CorporateCompany.where("REPLACE(abn, ' ', '') = ?", bill_to_abn).first
      match_strategy = "ABN" if company
    end

    # Strategy 2: Match by company name (if ABN match failed)
    # Support both old and new field names
    if company.nil?
      billing_name = result["billing_company_name"] || result["bill_to_name"]
      if billing_name.present?
        # Normalize: remove "Pty Ltd", "Ltd", extra spaces
        normalized_name = normalize_company_name(billing_name)

        # Try exact normalized match first
        company = CorporateCompany.all.find do |c|
          normalize_company_name(c.name) == normalized_name
        end
        match_strategy = "exact_name" if company

        # Try partial match (first 2 significant words)
        if company.nil?
          name_prefix = normalized_name.split.first(2).join(" ")
          if name_prefix.length >= 3
            company = CorporateCompany.where("LOWER(name) LIKE ?", "#{name_prefix.downcase}%").first
            match_strategy = "prefix_name" if company
          end
        end
      end
    end

    if company
      @bill.update!(detected_company: company, corporate_company: company)
      Rails.logger.info "[InvoiceParsing] Detected bill-to company: #{company.name} (strategy: #{match_strategy})"
    else
      Rails.logger.info "[InvoiceParsing] Could not detect bill-to company. ABN: #{bill_to_abn.presence || 'none'}, Name: #{result['billing_company_name'].presence || 'none'}"
    end
  end

  def normalize_company_name(name)
    return "" if name.blank?

    name.to_s
        .gsub(/\b(pty|ltd|limited|inc|incorporated|company|co|the)\b/i, "")
        .gsub(/[^a-zA-Z0-9\s]/, "")
        .squeeze(" ")
        .strip
        .downcase
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
