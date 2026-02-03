require "anthropic"

# SSoT: Uses DocumentProviderAware for provider-agnostic storage operations
class DocumentVerificationService
  include DocumentProviderAware

  # SSoT: MAX_FILE_SIZE_FOR_AI defined in DocumentStorageConstants
  MAX_FILE_SIZE = DocumentStorageConstants::MAX_FILE_SIZE_FOR_AI
  MODEL = "claude-sonnet-4-20250514"

  class VerificationError < StandardError; end
  class FileNotFoundError < VerificationError; end
  class FileTooLargeError < VerificationError; end
  class ExtractionError < VerificationError; end
  class StorageError < VerificationError; end

  # ============================================================================
  # Class Method: Detect Signature Fields in PDF
  # Uses Claude Vision to analyze document and find signature positions
  #
  # @param pdf_content [String] Binary PDF content
  # @return [Hash] { success: true, fields: [...] } or { success: false, error: "..." }
  #
  # Field format:
  # {
  #   signatory_type: "director" | "secretary" | "witness" | "authorized_signatory",
  #   signatory_name: "John Smith" | nil,
  #   page_number: 1,
  #   x_percent: 65.5,
  #   y_percent: 82.0,
  #   width_percent: 20.0,
  #   height_percent: 8.0,
  #   has_existing_signature: false
  # }
  # ============================================================================
  def self.detect_signature_fields!(pdf_content)
    api_key = ENV["ANTHROPIC_API_KEY"]
    raise VerificationError, "ANTHROPIC_API_KEY not configured" unless api_key

    # Convert PDF to images
    images = convert_pdf_to_images_static(pdf_content)

    if images.empty?
      return { success: false, error: "Could not convert PDF to images for analysis" }
    end

    # Build vision message with signature detection prompt
    client = Anthropic::Client.new(access_token: api_key)
    content = []

    # Add all page images (limit to 10 for performance)
    images.first(10).each_with_index do |image_data, idx|
      content << {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: image_data
        }
      }
    end

    # Add the signature detection prompt
    content << {
      type: "text",
      text: signature_detection_prompt(images.length)
    }

    response = client.messages(
      parameters: {
        model: MODEL,
        max_tokens: 2048,
        messages: [ { role: "user", content: content } ]
      }
    )

    parse_signature_response(response)

  rescue Anthropic::Error => e
    Rails.logger.error("Signature detection failed: #{e.message}")
    { success: false, error: "Claude API error: #{e.message}" }
  rescue StandardError => e
    Rails.logger.error("Signature detection error: #{e.class} - #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    { success: false, error: e.message }
  end

  # Static version of convert_pdf_to_images for class method use
  def self.convert_pdf_to_images_static(pdf_content)
    images = []

    Tempfile.create([ "doc", ".pdf" ]) do |pdf_file|
      pdf_file.binmode
      pdf_file.write(pdf_content)
      pdf_file.rewind

      begin
        # Get page count
        reader = PDF::Reader.new(pdf_file.path)
        page_count = reader.page_count

        # Convert each page (limit to first 10)
        [ page_count, 10 ].min.times do |page_num|
          Tempfile.create([ "page", ".png" ]) do |img_file|
            MiniMagick::Tool::Convert.new do |convert|
              convert.density(150)
              convert << "#{pdf_file.path}[#{page_num}]"
              convert.resize("1200x1600>")
              convert.quality(85)
              convert << img_file.path
            end

            img_file.rewind
            image_data = img_file.read
            images << Base64.strict_encode64(image_data) if image_data.present?
          end
        end
      rescue StandardError => e
        Rails.logger.error("PDF to image conversion failed: #{e.message}")
      end
    end

    images
  end

  def self.signature_detection_prompt(page_count)
    <<~PROMPT
      Analyze this #{page_count}-page document to detect all signature fields.

      For EACH signature field you find, provide:
      - signatory_type: "director" | "secretary" | "witness" | "authorized_signatory" | "unknown"
      - signatory_name: Name if labeled near the signature line (e.g., "John Smith") or null
      - page_number: Which page (1-indexed, first page = 1)
      - x_percent: Horizontal position of field CENTER as % of page width (0-100)
      - y_percent: Vertical position of field CENTER as % of page height (0-100, 0 = top)
      - width_percent: Field width as % of page width (typically 15-25%)
      - height_percent: Field height as % of page height (typically 5-10%)
      - has_existing_signature: true if already signed (has ink/marks), false if blank line

      WHAT TO LOOK FOR:
      1. Horizontal signature lines (____________________) with labels like:
         - "Signature", "Sign here", "Signed"
         - "Director", "Secretary", "Witness"
         - "Authorised Signatory", "Authorised Officer"
      2. Signature blocks with:
         - "Signed by:", "Executed by:", "Witnessed by:"
         - Company execution clauses
         - Person name labels above/below signature lines
      3. Existing handwritten signatures (mark has_existing_signature: true)

      POSITIONING NOTES:
      - x_percent: 0 = left edge, 50 = center, 100 = right edge
      - y_percent: 0 = top edge, 50 = middle, 100 = bottom edge
      - Position should be the CENTER of where the signature should go
      - Standard signature field is about 20% width, 8% height

      Respond with ONLY valid JSON:
      {
        "fields": [
          {
            "signatory_type": "director",
            "signatory_name": "John Smith",
            "page_number": 1,
            "x_percent": 70,
            "y_percent": 85,
            "width_percent": 20,
            "height_percent": 8,
            "has_existing_signature": false
          }
        ],
        "analysis_notes": "Brief description of what was found"
      }

      If NO signature fields are found, return:
      {
        "fields": [],
        "analysis_notes": "No signature fields detected in document"
      }
    PROMPT
  end

  def self.parse_signature_response(response)
    content = response.dig("content", 0, "text") || response.dig(:content, 0, :text)

    unless content.present?
      return { success: false, error: "Empty response from Claude" }
    end

    # Extract JSON from response
    json_match = content.match(/\{.*\}/m)
    unless json_match
      return { success: false, error: "Could not find JSON in response" }
    end

    json = JSON.parse(json_match[0])
    fields = json["fields"] || []

    # Validate and normalize fields
    normalized_fields = fields.map do |field|
      {
        signatory_type: field["signatory_type"] || "unknown",
        signatory_name: field["signatory_name"],
        page_number: field["page_number"].to_i,
        x_percent: field["x_percent"].to_f.clamp(0, 100),
        y_percent: field["y_percent"].to_f.clamp(0, 100),
        width_percent: field["width_percent"].to_f.clamp(5, 50),
        height_percent: field["height_percent"].to_f.clamp(3, 20),
        has_existing_signature: field["has_existing_signature"] == true
      }
    end

    {
      success: true,
      fields: normalized_fields,
      analysis_notes: json["analysis_notes"]
    }

  rescue JSON::ParserError => e
    Rails.logger.error("Failed to parse signature detection response: #{e.message}")
    { success: false, error: "Failed to parse AI response" }
  end

  def initialize(document)
    @document = document
    @company = document.corporate
  end

  def verify!
    # Mark as processing
    @document.update!(ai_verification_status: "processing")

    # 1. Validate we have a file to download
    validate_file_available!

    # 2. Download PDF from SharePoint
    content = download_document

    # 3. Extract text from PDF and track OCR results
    text = extract_text(content)
    ocr_result = calculate_ocr_confidence(text, content)

    # 4. Send to Claude for analysis (pass PDF content for vision fallback if text extraction failed)
    analysis = analyze_with_claude(text, text.nil? ? content : nil)

    # Check if this is a date-range document (statements, summaries)
    # These use date ranges instead of financial years
    suggested_type_lower = (analysis[:suggested_type] || "").downcase
    is_date_range_doc = suggested_type_lower.include?("statement") ||
                        suggested_type_lower.include?("summary") ||
                        (analysis[:suggested_name] || "").include?(" to ")

    # Don't store suggested_fy for date-range documents
    suggested_fy = is_date_range_doc ? nil : analysis[:suggested_fy]

    # 5. Update document with results (including OCR metrics)
    @document.update!(
      ai_verified_at: Time.current,
      ai_verification_status: analysis[:status],
      ai_suggested_name: analysis[:suggested_name],
      ai_suggested_folder: analysis[:suggested_folder],
      ai_suggested_type: analysis[:suggested_type],
      ai_suggested_fy: suggested_fy,
      ai_confidence_score: analysis[:confidence],
      ai_analysis_notes: analysis[:notes],
      ai_extracted_description: analysis[:extracted_description],
      ai_extracted_date: analysis[:extracted_date],
      ai_source_page: analysis[:source_page],
      ai_source_quote: analysis[:source_quote],
      ai_contains_multiple_documents: analysis[:contains_multiple_documents],
      ai_split_recommendation: analysis[:split_recommendation],
      # OCR metrics
      ocr_confidence: ocr_result[:confidence],
      ocr_method: ocr_result[:method]
    )

    # 6. Auto-apply at 74%+ confidence (skip if multi-document PDF)
    auto_applied = false

    unless analysis[:contains_multiple_documents]
      confidence = analysis[:confidence].to_i

      # At 74%+: Full auto-apply (rename file, set all fields, mark verified)
      if confidence >= 74
        auto_applied = auto_apply_suggestion!(analysis)
      end
    end

    { success: true, analysis: analysis, auto_applied: auto_applied }

  rescue VerificationError => e
    @document.update!(
      ai_verified_at: Time.current,
      ai_verification_status: "error",
      ai_analysis_notes: e.message
    )
    { success: false, error: e.message }

  rescue StandardError => e
    Rails.logger.error("DocumentVerification failed: #{e.class} - #{e.message}")
    Rails.logger.error(e.backtrace.first(10).join("\n"))
    @document.update!(
      ai_verified_at: Time.current,
      ai_verification_status: "error",
      ai_analysis_notes: "Unexpected error: #{e.message}"
    )
    { success: false, error: e.message }
  end

  private

  # Auto-apply AI suggestion when confidence is 74%+
  # - Renames file in storage (provider-agnostic)
  # - Updates document record with suggested values
  # - Marks as verified
  # SSoT: Uses DocumentProviderAware for provider-agnostic file operations
  def auto_apply_suggestion!(analysis)
    return false unless analysis[:suggested_name].present?

    # Rename file in storage if name changed
    if analysis[:suggested_name] != @document.file_name
      # Try provider-agnostic rename - SSoT: use storage_reference
      if @document.storage_reference.present?
        begin
          setup_default_provider!
          file_identifier = @document.storage_reference
          rename_file_in_provider(file_identifier, analysis[:suggested_name])
          Rails.logger.info("Auto-renamed storage file to: #{analysis[:suggested_name]}")
        rescue DocumentProviders::NotConnectedError => e
          Rails.logger.warn("Storage not connected for rename: #{e.message}")
          # Continue with database update even if storage rename fails
        rescue DocumentProviders::Error => e
          Rails.logger.warn("Failed to rename storage file: #{e.message}")
          # Continue with database update even if storage rename fails
        rescue StandardError => e
          Rails.logger.warn("Failed to rename file: #{e.message}")
          # Continue with database update even if rename fails
        end
      end
    end

    # Check if this is a date-range document (statements, summaries)
    # These use date ranges instead of financial years
    suggested_type_lower = (analysis[:suggested_type] || "").downcase
    is_date_range_doc = suggested_type_lower.include?("statement") ||
                        suggested_type_lower.include?("summary") ||
                        (analysis[:suggested_name] || "").include?(" to ")

    # Update document record with AI suggestions
    update_attrs = {
      file_name: analysis[:suggested_name],
      folder: analysis[:suggested_folder] || @document.folder,
      document_type: analysis[:suggested_type] || @document.document_type,
      ref_date: analysis[:extracted_date].presence || @document.ref_date,
      ai_verification_status: "verified",
      user_validated_at: Time.current
    }

    # Only set financial_years if the filename explicitly contains "FY"
    suggested_name = analysis[:suggested_name] || ""
    if suggested_name.match?(/FY\d{2}/i) && !is_date_range_doc
      update_attrs[:financial_years] = analysis[:suggested_fy].presence || @document.financial_years
    else
      # No FY in filename = clear financial_years
      update_attrs[:financial_years] = nil
    end

    @document.update!(update_attrs)

    Rails.logger.info("Auto-applied AI suggestion for document #{@document.id} (confidence: #{analysis[:confidence]}%)")
    true
  rescue StandardError => e
    Rails.logger.error("Failed to auto-apply AI suggestion: #{e.message}")
    false
  end

  def validate_file_available!
    # Check for storage reference - SSoT: use storage_reference
    unless @document.storage_reference.present?
      raise FileNotFoundError, "No storage path or file ID available for this document"
    end
  end

  # Download document using provider-agnostic storage service
  # SSoT: Uses DocumentStorageService for provider-agnostic downloads
  def download_document
    service = DocumentStorageService.new
    result = service.download(@document)

    raise StorageError, "Storage not connected: #{result[:error]}" unless result[:success]
    raise FileNotFoundError, "Failed to download file content" if result[:content].blank?
    raise FileTooLargeError, "File too large (#{result[:content].bytesize} bytes)" if result[:content].bytesize > MAX_FILE_SIZE

    result[:content]
  rescue DocumentProviders::NotConnectedError => e
    raise StorageError, "Storage not connected: #{e.message}"
  rescue DocumentProviders::Error => e
    raise StorageError, "Storage API error: #{e.message}"
  end

  def extract_text(content)
    file_extension = File.extname(@document.file_name || "").downcase

    case file_extension
    when ".pdf"
      extract_pdf_text(content)
    else
      # For non-PDF files, we can't extract text - just use the filename
      Rails.logger.info("Cannot extract text from #{file_extension} files, using filename only")
      nil
    end
  end

  # SSoT: Uses PdfTextExtractionService for all PDF text extraction
  def extract_pdf_text(content)
    result = PdfTextExtractionService.extract(
      content,
      max_chars_per_page: 1500,
      include_page_numbers: true
    )

    return nil unless result[:success]

    # Return in format expected by build_prompt
    { pages: result[:pages], total_pages: result[:page_count] }
  end

  # Calculate OCR confidence based on text extraction quality
  # Returns { confidence: 0-100, method: 'text_extraction' | 'vision' | 'none' }
  def calculate_ocr_confidence(text, content)
    if text.nil?
      # No text extracted - will use vision fallback
      return { confidence: nil, method: "vision" }
    end

    # Calculate confidence based on extracted text quality
    pages = text[:pages] || []
    total_pages = text[:total_pages] || 0

    if pages.empty? || total_pages == 0
      return { confidence: 0, method: "text_extraction" }
    end

    # Calculate average characters per page
    total_chars = pages.sum { |p| p[:text].to_s.length }
    avg_chars_per_page = total_chars.to_f / total_pages

    # Score based on text density:
    # - 500+ chars/page = 100% (well-formatted text PDF)
    # - 200-500 chars/page = 70-99% (decent extraction)
    # - 50-200 chars/page = 40-69% (sparse text, possible scan)
    # - <50 chars/page = 10-39% (mostly images/scanned)
    confidence = case avg_chars_per_page
    when 500.. then 100
    when 200...500 then 70 + ((avg_chars_per_page - 200) / 300.0 * 29).round
    when 50...200 then 40 + ((avg_chars_per_page - 50) / 150.0 * 29).round
    else
      [ 10 + (avg_chars_per_page / 50.0 * 29).round, 39 ].min
    end

    { confidence: confidence, method: "text_extraction" }
  end

  MAX_RETRIES = 3
  INITIAL_RETRY_DELAY = 2 # seconds

  def analyze_with_claude(text, pdf_content = nil)
    api_key = ENV["ANTHROPIC_API_KEY"]
    raise VerificationError, "ANTHROPIC_API_KEY not configured" unless api_key

    client = Anthropic::Client.new(access_token: api_key)
    prompt = build_prompt(text)

    retries = 0
    begin
      # If no text was extracted but we have PDF content, use vision
      if text.nil? && pdf_content.present?
        response = analyze_with_vision(client, prompt, pdf_content)
      else
        response = client.messages(
          parameters: {
            model: MODEL,
            max_tokens: 1024,
            messages: [ { role: "user", content: prompt } ]
          }
        )
      end

      parse_response(response)
    rescue Anthropic::Error => e
      # Check for rate limit (429) errors
      if e.message.include?("429") || e.message.downcase.include?("rate limit")
        retries += 1
        if retries <= MAX_RETRIES
          delay = INITIAL_RETRY_DELAY * (2 ** (retries - 1)) # Exponential backoff: 2, 4, 8 seconds
          Rails.logger.warn("Rate limited by Anthropic API (attempt #{retries}/#{MAX_RETRIES}). Retrying in #{delay}s...")
          sleep(delay)
          retry
        else
          Rails.logger.error("Anthropic API rate limit exceeded after #{MAX_RETRIES} retries")
          raise VerificationError, "Claude API rate limited - please try again later"
        end
      else
        Rails.logger.error("Anthropic API error: #{e.message}")
        raise VerificationError, "Claude API error: #{e.message}"
      end
    end
  end

  def analyze_with_vision(client, prompt, pdf_content)
    # Convert PDF pages to images using MiniMagick
    images = convert_pdf_to_images(pdf_content)

    if images.empty?
      Rails.logger.warn("Could not convert PDF to images, falling back to text-only")
      return client.messages(
        parameters: {
          model: MODEL,
          max_tokens: 1024,
          messages: [ { role: "user", content: prompt } ]
        }
      )
    end

    # Build message content with images
    content = []

    # Add first few pages as images (limit to 5 pages to control costs)
    images.first(5).each_with_index do |image_data, idx|
      content << {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: image_data
        }
      }
    end

    # Add the text prompt
    content << {
      type: "text",
      text: prompt
    }

    client.messages(
      parameters: {
        model: MODEL,
        max_tokens: 1024,
        messages: [ { role: "user", content: content } ]
      }
    )
  end

  def convert_pdf_to_images(pdf_content)
    images = []

    Tempfile.create([ "doc", ".pdf" ]) do |pdf_file|
      pdf_file.binmode
      pdf_file.write(pdf_content)
      pdf_file.rewind

      begin
        # Try MiniMagick first (requires ImageMagick + Ghostscript on system)
        page_count = get_pdf_page_count(pdf_file.path)

        # Convert each page (limit to first 5)
        [ page_count, 5 ].min.times do |page_num|
          Tempfile.create([ "page", ".png" ]) do |img_file|
            MiniMagick::Tool::Convert.new do |convert|
              convert.density(150)
              convert << "#{pdf_file.path}[#{page_num}]"
              convert.resize("1200x1600>")  # Max dimensions
              convert.quality(85)
              convert << img_file.path
            end

            img_file.rewind
            image_data = img_file.read
            images << Base64.strict_encode64(image_data) if image_data.present?
          end
        end
      rescue StandardError => e
        Rails.logger.error("PDF to image conversion failed: #{e.message}")
        Rails.logger.error("Make sure ImageMagick and Ghostscript are installed")
      end
    end

    images
  end

  def get_pdf_page_count(pdf_path)
    # Use PDF::Reader to get page count (more reliable than MiniMagick)
    reader = PDF::Reader.new(pdf_path)
    reader.page_count
  rescue StandardError => e
    Rails.logger.warn("Could not get PDF page count: #{e.message}")
    1
  end

  def build_prompt(text_data)
    # Build context about the document
    context_parts = []
    context_parts << "Current filename: #{@document.file_name}"
    if @company
      context_parts << "Company: #{@company.name} (code: #{@company.code})"
      # Include previous names if any - helps match documents from before company name changes
      if @company.previous_names.present? && @company.previous_names.any?
        context_parts << "Previous company names: #{@company.previous_names.join(', ')}"
      end
    end
    context_parts << "Current folder: #{@document.folder}" if @document.folder.present?
    context_parts << "Source: #{@document.source}" if @document.source.present?

    document_context = context_parts.join("\n")

    # Build text section - now with page-by-page structure
    text_section = if text_data.is_a?(Hash) && text_data[:pages].present?
      pages_content = text_data[:pages].first(10).map do |p|
        "--- PAGE #{p[:page]} ---\n#{p[:text]}"
      end.join("\n\n")
      "\n## Document Content (#{text_data[:total_pages]} pages):\n#{pages_content}"
    elsif text_data.is_a?(String) && text_data.present?
      # Fallback for old string format
      "\n## Document text:\n#{text_data[0..3000]}"
    else
      "\n## Note: Could not extract text from this document. Please analyze based on the filename only."
    end

    # Build document types section from database
    document_types_section = build_document_types_section

    # Build learning examples from past corrections
    learning_section = build_learning_section

    <<~PROMPT
      Analyze this document and suggest the best filename following TEEEM naming conventions.

      IMPORTANT - MULTI-DOCUMENT DETECTION:
      Check if this PDF contains MULTIPLE DIFFERENT documents that should be separate files. Examples:
      - A BAS statement on pages 1-2 and a Company Tax Return on page 3
      - A BAS Statement AND an Income Tax Statement combined in one PDF
      - Any file where the name contains "and" between two document types (e.g., "BAS and Income Tax Statement")

      If the filename or content shows TWO OR MORE distinct document types, set contains_multiple_documents: true and provide split_recommendation.
      Each document type should be its own file - NEVER combine different document types into one suggested name.

      EXCEPTION - DO NOT flag for splitting:
      - Management reports, quarterly summaries, or financial reports that INCLUDE a BAS statement as supporting documentation
      - These are intentionally bundled together as a single management package
      - If the document is primarily a management report with BAS/financial data attached, treat it as ONE document (type: BAS - Business Activity Statement)

      ## Document Context:
      #{document_context}

      ## TEEEM Naming Convention:
      - Format: {CompanyCode} {DocType} {FY/Period} {Details}.pdf
      - Company codes: 2-4 letter abbreviation (e.g., TD, THFT, NEV, MAL)
      - Financial year: FY21, FY22, FY23, FY24 etc.
      - Folders: ADVICE, ASIC, ASSETS, ATO, BANK, COMPANY, DIVIDENDS, FINANCIALS, GENERAL, INSURANCE, LOANS, MINUTES, REGISTRY, TRUST

      ## Signed/Unsigned Tax Returns - CRITICAL:
      For CTR (Company Tax Return) and TTR (Trust Tax Return), you MUST include US or S:
      - ALL CTR and TTR documents MUST have "US" or "S" at the end of the filename (before .pdf)
      - If document does NOT have a signature or says "DRAFT" → use "US" (unsigned)
      - If document HAS a signature or says "SIGNED"/"FINAL" → use "S" (signed)
      - DEFAULT TO "US" if you cannot determine signed status
      - NEVER omit the US/S suffix for CTR or TTR documents

      Examples:
      - "TD CTR FY24 US.pdf" = Unsigned Company Tax Return
      - "TD CTR FY24 S.pdf" = Signed Company Tax Return
      - "TD TTR FY24 US.pdf" = Unsigned Trust Tax Return
      - "TD TTR FY24 S.pdf" = Signed Trust Tax Return

      ## Draft/Signed Loan Documents - CRITICAL:
      For Loan Agreements and Security Deeds, you MUST detect draft vs signed status:
      - LAD = Loan Agreement - Draft (has DRAFT watermark, not signed, or unsigned copy)
      - LAS = Loan Agreement - Signed (has signatures, is the executed/final version)
      - SDD = Security Deed - Draft (has DRAFT watermark, not signed, or unsigned copy)
      - SDS = Security Deed - Signed (has signatures, is the executed/final version)

      Detection rules:
      - If document has "DRAFT" watermark or "DRAFT" in header → use Draft variant (LAD, SDD)
      - If document has signatures or says "EXECUTED"/"SIGNED"/"FINAL" → use Signed variant (LAS, SDS)
      - If document shows signature blocks that are BLANK/UNSIGNED → use Draft variant (LAD, SDD)
      - DEFAULT to Draft variant if status cannot be determined (safer to treat as draft)

      IMPORTANT: When a Signed version (LAS, SDS) exists, the Draft version (LAD, SDD) should be deleted.
      Flag duplicate draft/signed pairs in your notes if you detect them.

      Loan Direction - CRITICAL:
      - "Loan from" = Company is BORROWING money (lender is external party)
      - "Loan to" = Company is LENDING money (borrower is external party)
      Determine direction from the document content - who is the borrower vs lender.

      Format for Loan Agreements: {CompanyCode} {LoanID} {LAD|LAS} {from|to} {OtherPartyCode} {AssetDescription} {Date}.pdf
      Format for Security Deeds: {CompanyCode} {LoanID} {SDD|SDS} {AssetDescription} {Date}.pdf

      Examples:
      - "TD L001 LAD from ANZ 123 Smith St 15-06-2024.pdf" = Draft Loan Agreement (TD borrowing from ANZ)
      - "TD L001 LAS from ANZ 123 Smith St 15-06-2024.pdf" = Signed Loan Agreement (TD borrowing from ANZ)
      - "TD L001 LAD to NEV 123 Smith St 15-06-2024.pdf" = Draft Loan Agreement (TD lending to NEV)
      - "TD L001 LAS to NEV 123 Smith St 15-06-2024.pdf" = Signed Loan Agreement (TD lending to NEV)
      - "TD L001 SDD 123 Smith St 15-06-2024.pdf" = Draft Security Deed
      - "TD L001 SDS 123 Smith St 15-06-2024.pdf" = Signed Security Deed

      ## ATO Documents - IMPORTANT DISTINCTION:
      There are different types of ATO documents:

      1. **BAS (Business Activity Statement)** - The actual quarterly/monthly lodgement showing GST, PAYG, etc.
         - Look for: "Print activity statement", specific period like "Jan 2024 - Mar 2024", GST amounts
         - Format: {CompanyCode} BAS {Period} FY{YY}.pdf
         - Example: "TD BAS Q3 FY24.pdf" or "TD BAS Jan-Mar 2024.pdf"

      2. **ATO BAS Statement** - Transaction history/ledger for the BAS account over a date range
         - Look for: "Activity statement 001", "Transactions", date range like "26 June 2022 to 26 June 2024"
         - Shows: Payments received, interest charges, original activity statements, balances
         - Format: {CompanyCode} BAS Statement {FromDate} to {ToDate} ({PrintDate}).pdf
         - Example: "TD BAS Statement 26-06-2022 to 26-06-2024 (27-08-2024).pdf"

      3. **ATO Income Tax Statement** - Transaction history/ledger for Income Tax account
         - Similar to BAS Statement but for Income Tax account
         - Format: {CompanyCode} Income Tax Statement {FromDate} to {ToDate} ({PrintDate}).pdf
         - Example: "TD Income Tax Statement 01-07-2022 to 30-06-2024 (27-08-2024).pdf"

      Date formats: Use DD-MM-YYYY for dates in filenames.

      ## Document Types and Naming Formats:
      #{document_types_section}
      #{learning_section}
      #{text_section}

      ## Respond ONLY with valid JSON in this exact format:
      {
        "suggested_name": "TD ATO Activity Statement 24-06-2024.pdf",
        "suggested_folder": "ATO",
        "suggested_type": "ATO Documents",
        "suggested_fy": null,
        "confidence": 85,
        "notes": "Brief explanation of why this name was suggested",
        "current_name_valid": true,
        "extracted_description": "Activity Statement",
        "extracted_date": "30-06-2024",
        "source_page": 1,
        "source_quote": "The exact text from the document that helped identify this",
        "contains_multiple_documents": false,
        "split_recommendation": null
      }

      Notes:
      - suggested_name should follow the TEEEM convention strictly using the naming format for the document type
      - suggested_folder should be one of the valid folders listed above
      - suggested_type MUST be the EXACT document type name from the list above (e.g., "ATO Documents", "BAS - Business Activity Statement", etc.)
      - suggested_fy: ONLY populate if the suggested_name explicitly contains "FY" (e.g., "FY24"). If the filename uses date ranges or specific dates instead of FY notation, set to null. Example: "TD BAS Statement 01-07-2023 to 30-06-2024.pdf" → null (no FY in name), "TD CTR FY24 US.pdf" → [2024]
      - IMPORTANT: For FY assignment, if the document date is between July 1-30 (within 30 days after FY end), assign to the PREVIOUS FY. Example: document dated 15-07-2025 should be FY25 (not FY26) because it's a report/summary for the FY just ended.
      - confidence should be 0-100 based on how certain you are
      - current_name_valid should be true if the current filename already follows TEEEM conventions well
      - extracted_description: A brief description of the document content
      - extracted_date: The most relevant date from the document in DD-MM-YYYY format (Australian date format)
      - source_page: Which page number (1-indexed) the key information was found on
      - source_quote: A short quote (max 100 chars) from the document that identifies what it is
      - contains_multiple_documents: Set to TRUE if the PDF contains different document types that should be separate files
      - split_recommendation: If contains_multiple_documents is true, provide an array like:
        [{"pages": "1-2", "type": "BAS - Business Activity Statement", "suggested_name": "TD BAS Q1 FY24.pdf"},
         {"pages": "3", "type": "CTR - Company Tax Return", "suggested_name": "TD CTR FY24 US.pdf"}]
    PROMPT
  end

  def build_learning_section
    return "" unless @company&.code.present?

    # Get learning context from feedback
    learning_context = DocumentVerificationFeedback.build_learning_context(@company.code, limit: 5)

    return "" if learning_context.blank?

    <<~LEARNING

      ## Learning from Past Corrections:
      The following are examples where AI suggestions were corrected by users for this company.
      Use these to understand naming preferences and patterns:
      #{learning_context}
    LEARNING
  end

  def build_document_types_section
    # Get document types from database (folder is computed from primary WarehouseFolder)
    doc_types = DocumentType.active.includes(warehouse_folder_document_types: :warehouse_folder).order(:name)

    if doc_types.any?
      # Group by computed folder for better organization
      grouped = doc_types.group_by(&:folder).sort_by { |folder, _| folder || "" }.to_h
      lines = []

      grouped.each do |folder, types|
        lines << "### #{folder || 'GENERAL'}"
        types.each do |dt|
          abbrev = dt.abbreviation.present? ? " (#{dt.abbreviation})" : ""
          format = dt.download_name.present? ? " - Format: #{dt.download_name}" : ""
          # Include all aliases (database + defaults) so AI knows alternative names
          all_aliases = dt.all_terms - [ dt.name ]
          aliases_info = all_aliases.any? ? " [Also known as: #{all_aliases.first(5).join(', ')}]" : ""
          lines << "- #{dt.name}#{abbrev}#{format}#{aliases_info}"
        end
        lines << ""
      end

      lines.join("\n")
    else
      # Fallback to hardcoded values if no document types in database
      <<~TYPES
        - CTR = Company Tax Return - Format: {CompanyCode} CTR FY{YY} {Signed} (use US or S suffix for unsigned/signed)
        - TTR = Trust Tax Return - Format: {CompanyCode} TTR FY{YY} {Signed} (use US or S suffix for unsigned/signed)
        - BAS = Business Activity Statement - Format: {CompanyCode} BAS {Period} {Year}
        - PPSR = PPSR Registration - Format: {CompanyCode} {LoanID} PPSR {AssetCode} {Date}
        - SD = Security Deed - Format: {CompanyCode} {LoanID} Security Deed {AssetCode} {Date}
        - LA = Loan Agreement - Format: {CompanyCode} {LoanID} Loan from {LenderCode} {AssetCode} {Date}
        - FS = Financial Statements - Format: {CompanyCode} Final Financials FY{YY}
        - AR = Annual Report - Format: {CompanyCode} Annual Report FY{YY}
        - MIN = Minutes - Format: {CompanyCode} Minutes {Date}
        - RES = Resolution - Format: {CompanyCode} Resolution {Date}
        - CON = Constitution - Format: {CompanyCode} Constitution {Date}
        - AA = Accountant Advice - Format: {CompanyCode} AA {Description} {Date}
        - CA = Client Advice - Format: {CompanyCode} CA {Description} {Date}
      TYPES
    end
  end

  def parse_response(response)
    content = response.dig("content", 0, "text") || response.dig(:content, 0, :text)

    unless content.present?
      return {
        status: "error",
        notes: "Empty response from Claude",
        confidence: 0
      }
    end

    # Extract JSON from response
    json_match = content.match(/\{.*\}/m)
    unless json_match
      return {
        status: "error",
        notes: "Could not find JSON in Claude response",
        confidence: 0
      }
    end

    json = JSON.parse(json_match[0])

    # Normalize suggested_type to canonical document type name
    suggested_type = json["suggested_type"]
    if suggested_type.present?
      canonical_type = DocumentType.find_by_name_or_alias(suggested_type)
      suggested_type = canonical_type&.name || suggested_type
    end

    # Determine status - if multiple docs detected, flag for splitting
    status = if json["contains_multiple_documents"]
      "needs_split"
    elsif json["current_name_valid"]
      "verified"
    else
      "mismatch"
    end

    # Only populate FY if the suggested name explicitly contains "FY"
    suggested_name = json["suggested_name"] || ""
    raw_suggested_fy = if suggested_name.match?(/FY(\d{2})/i)
      # Extract FY from filename if Claude didn't provide it or provided nil
      claude_fy = json["suggested_fy"]
      if claude_fy.present? && claude_fy.is_a?(Array) && claude_fy.any?
        claude_fy
      else
        # Extract from filename: "FY24" -> [2024]
        fy_match = suggested_name.match(/FY(\d{2})/i)
        fy_match ? [ 2000 + fy_match[1].to_i ] : []
      end
    else
      [] # No FY in filename = no FY in column
    end

    # Apply smart FY adjustment for July-dated documents
    extracted_date = json["extracted_date"]
    adjusted_fy = adjust_fy_for_july_dates(raw_suggested_fy, extracted_date)

    {
      status: status,
      suggested_name: json["suggested_name"],
      suggested_folder: json["suggested_folder"],
      suggested_type: suggested_type,
      suggested_fy: adjusted_fy,
      confidence: json["confidence"].to_i,
      notes: json["notes"],
      extracted_description: json["extracted_description"],
      extracted_date: extracted_date,
      source_page: json["source_page"],
      source_quote: json["source_quote"],
      contains_multiple_documents: json["contains_multiple_documents"] || false,
      split_recommendation: json["split_recommendation"]
    }

  rescue JSON::ParserError => e
    Rails.logger.error("Failed to parse Claude JSON response: #{e.message}")
    Rails.logger.error("Response content: #{content}")
    {
      status: "error",
      notes: "Failed to parse AI response: #{e.message}",
      confidence: 0
    }
  end

  # Apply smart FY detection: if document is dated within 30 days after June 30,
  # it likely belongs to the previous FY (e.g., a summary printed on July 15, 2025 is for FY25)
  def adjust_fy_for_july_dates(suggested_fy, extracted_date)
    return suggested_fy if suggested_fy.blank? || extracted_date.blank?

    # Parse the extracted date (format: DD-MM-YYYY)
    begin
      date = Date.strptime(extracted_date, "%d-%m-%Y")
    rescue ArgumentError
      # Try other common formats
      begin
        date = Date.parse(extracted_date)
      rescue ArgumentError
        return suggested_fy
      end
    end

    # Check if date is in July (month 7) and within first 30 days
    if date.month == 7 && date.day <= 30
      # This document is likely a summary/report for the FY just ended
      # Adjust each FY in the array
      adjusted_fy = suggested_fy.map do |fy|
        fy_year = fy.to_i
        # The FY ending in July 2025 is FY25, not FY26
        # If Claude suggested FY26 for a July 2025 doc, adjust to FY25
        if fy_year == date.year + 1
          # Claude assigned next FY (FY26 for July 2025), adjust to current FY (FY25)
          fy_year - 1
        else
          fy_year
        end
      end.uniq

      if adjusted_fy != suggested_fy
        Rails.logger.info("Adjusted FY from #{suggested_fy} to #{adjusted_fy} (document dated #{extracted_date} is within 30 days of FY end)")
      end

      adjusted_fy
    else
      suggested_fy
    end
  end
end
