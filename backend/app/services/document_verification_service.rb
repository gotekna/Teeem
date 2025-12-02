require 'anthropic'

class DocumentVerificationService
  MAX_FILE_SIZE = 20.megabytes
  MODEL = "claude-sonnet-4-20250514"

  class VerificationError < StandardError; end
  class FileNotFoundError < VerificationError; end
  class FileTooLargeError < VerificationError; end
  class ExtractionError < VerificationError; end
  class OneDriveError < VerificationError; end

  def initialize(document)
    @document = document
    @company = document.company
  end

  def verify!
    # Mark as processing
    @document.update!(ai_verification_status: 'processing')

    # 1. Validate we have a file to download
    validate_file_available!

    # 2. Download PDF from SharePoint
    content = download_document

    # 3. Extract text from PDF
    text = extract_text(content)

    # 4. Send to Claude for analysis
    analysis = analyze_with_claude(text)

    # 5. Update document with results
    @document.update!(
      ai_verified_at: Time.current,
      ai_verification_status: analysis[:status],
      ai_suggested_name: analysis[:suggested_name],
      ai_suggested_folder: analysis[:suggested_folder],
      ai_suggested_type: analysis[:suggested_type],
      ai_suggested_fy: analysis[:suggested_fy],
      ai_confidence_score: analysis[:confidence],
      ai_analysis_notes: analysis[:notes]
    )

    { success: true, analysis: analysis }

  rescue VerificationError => e
    @document.update!(
      ai_verified_at: Time.current,
      ai_verification_status: 'error',
      ai_analysis_notes: e.message
    )
    { success: false, error: e.message }

  rescue StandardError => e
    Rails.logger.error("DocumentVerification failed: #{e.class} - #{e.message}")
    Rails.logger.error(e.backtrace.first(10).join("\n"))
    @document.update!(
      ai_verified_at: Time.current,
      ai_verification_status: 'error',
      ai_analysis_notes: "Unexpected error: #{e.message}"
    )
    { success: false, error: e.message }
  end

  private

  def validate_file_available!
    unless @document.onedrive_file_id.present?
      raise FileNotFoundError, "No OneDrive file ID available for this document"
    end
  end

  def download_document
    credential = OrganizationOneDriveCredential.active_credential
    raise OneDriveError, "No active OneDrive credential" unless credential

    client = MicrosoftGraphClient.new(credential)
    content = client.download_file(@document.onedrive_file_id)

    raise FileNotFoundError, "Failed to download file content" if content.blank?
    raise FileTooLargeError, "File too large (#{content.bytesize} bytes)" if content.bytesize > MAX_FILE_SIZE

    content
  rescue MicrosoftGraphClient::APIError => e
    raise OneDriveError, "OneDrive API error: #{e.message}"
  end

  def extract_text(content)
    file_extension = File.extname(@document.title || @document.file_name || '').downcase

    case file_extension
    when '.pdf'
      extract_pdf_text(content)
    else
      # For non-PDF files, we can't extract text - just use the filename
      Rails.logger.info("Cannot extract text from #{file_extension} files, using filename only")
      nil
    end
  end

  def extract_pdf_text(content)
    Tempfile.create(['doc', '.pdf']) do |file|
      file.binmode
      file.write(content)
      file.rewind

      begin
        reader = PDF::Reader.new(file.path)
        text = reader.pages.map(&:text).join("\n")
        return text if text.present?
        nil
      rescue PDF::Reader::MalformedPDFError => e
        Rails.logger.warn("Malformed PDF: #{e.message}")
        nil
      rescue StandardError => e
        Rails.logger.warn("PDF extraction error: #{e.message}")
        nil
      end
    end
  end

  def analyze_with_claude(text)
    api_key = ENV['ANTHROPIC_API_KEY']
    raise VerificationError, "ANTHROPIC_API_KEY not configured" unless api_key

    client = Anthropic::Client.new(access_token: api_key)
    prompt = build_prompt(text)

    response = client.messages(
      parameters: {
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }]
      }
    )

    parse_response(response)
  rescue Anthropic::Error => e
    Rails.logger.error("Anthropic API error: #{e.message}")
    raise VerificationError, "Claude API error: #{e.message}"
  end

  def build_prompt(text)
    # Build context about the document
    context_parts = []
    context_parts << "Current filename: #{@document.title}"
    context_parts << "Company: #{@company&.name} (code: #{@company&.code})" if @company
    context_parts << "Current folder: #{@document.folder}" if @document.folder.present?
    context_parts << "Source: #{@document.source}" if @document.source.present?

    document_context = context_parts.join("\n")

    # Only include text if we extracted any
    text_section = if text.present?
      "\n## Document text (first 3000 chars):\n#{text[0..3000]}"
    else
      "\n## Note: Could not extract text from this document. Please analyze based on the filename only."
    end

    # Build document types section from database
    document_types_section = build_document_types_section

    # Build learning examples from past corrections
    learning_section = build_learning_section

    <<~PROMPT
      Analyze this document and suggest the best filename following TEEEM naming conventions.

      ## Document Context:
      #{document_context}

      ## TEEEM Naming Convention:
      - Format: {CompanyCode} {DocType} {FY/Period} {Details}.pdf
      - Company codes: 2-4 letter abbreviation (e.g., TD, THFT, NEV, MAL)
      - Financial year: FY21, FY22, FY23, FY24 etc.
      - Folders: ADVICE, ASIC, ASSETS, ATO, BANK, COMPANY, DIVIDENDS, FINANCIALS, GENERAL, INSURANCE, LOANS, MINUTES, REGISTRY, TRUST

      ## Document Types and Naming Formats:
      #{document_types_section}
      #{learning_section}
      #{text_section}

      ## Respond ONLY with valid JSON in this exact format:
      {
        "suggested_name": "TD FY24 CTR.pdf",
        "suggested_folder": "ATO",
        "suggested_type": "tax_return",
        "suggested_fy": [2024],
        "confidence": 85,
        "notes": "Brief explanation of why this name was suggested",
        "current_name_valid": true
      }

      Notes:
      - suggested_name should follow the TEEEM convention strictly using the naming format for the document type
      - suggested_folder should be one of the valid folders listed above
      - suggested_fy should be an array of financial years (e.g., [2024] or [2023, 2024] for multi-year docs)
      - confidence should be 0-100 based on how certain you are
      - current_name_valid should be true if the current filename already follows TEEEM conventions well
      - If the current name is already good, set current_name_valid to true and suggested_name can match the current
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
    # Get document types from database
    doc_types = DocumentType.active.order(:folder, :name)

    if doc_types.any?
      # Group by folder for better organization
      grouped = doc_types.group_by(&:folder)
      lines = []

      grouped.each do |folder, types|
        lines << "### #{folder || 'GENERAL'}"
        types.each do |dt|
          abbrev = dt.abbreviation.present? ? " (#{dt.abbreviation})" : ""
          format = dt.naming_format.present? ? " - Format: #{dt.naming_format}" : ""
          lines << "- #{dt.name}#{abbrev}#{format}"
        end
        lines << ""
      end

      lines.join("\n")
    else
      # Fallback to hardcoded values if no document types in database
      <<~TYPES
        - CTR = Company Tax Return - Format: {CompanyCode} CTR FY{YY}
        - TTR = Trust Tax Return - Format: {CompanyCode} TTR FY{YY}
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

    {
      status: json["current_name_valid"] ? "verified" : "mismatch",
      suggested_name: json["suggested_name"],
      suggested_folder: json["suggested_folder"],
      suggested_type: json["suggested_type"],
      suggested_fy: json["suggested_fy"] || [],
      confidence: json["confidence"].to_i,
      notes: json["notes"]
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
end
