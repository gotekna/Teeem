# frozen_string_literal: true

require "anthropic"

# Service for AI-powered analysis of job documents
# Analyzes filenames and folder paths to suggest document types and standardized names
class JobDocumentAiAnalyzer
  MODEL = "claude-sonnet-4-20250514"
  MAX_RETRIES = 3
  INITIAL_RETRY_DELAY = 2

  class AnalysisError < StandardError; end

  def initialize(document)
    @document = document
    @job = document.job
  end

  # Analyze a single document and update it with AI suggestions
  def analyze!
    return { success: false, error: "Document not found" } unless @document
    return { success: false, error: "Job not found" } unless @job

    analysis = analyze_with_claude

    # Find the matching document type
    suggested_type = nil
    if analysis[:matched_type_id].present?
      suggested_type = DocumentType.find_by(id: analysis[:matched_type_id])
    elsif analysis[:matched_type_name].present?
      suggested_type = DocumentType.find_by_name_or_alias(analysis[:matched_type_name])
    end

    # Generate proposed name using the document type's naming format
    proposed_name = if suggested_type&.download_name.present?
      generate_proposed_name(suggested_type, analysis)
    else
      analysis[:proposed_name]
    end

    # Store the original filename if not already stored
    original_name = @document.original_file_name.presence || @document.file_name

    # Update document with analysis results
    @document.update!(
      ai_suggested_type_id: suggested_type&.id,
      ai_proposed_name: proposed_name,
      ai_confidence: analysis[:confidence],
      ai_reasoning: analysis[:reasoning],
      ai_analyzed_at: Time.current,
      original_file_name: original_name,
      rename_status: "pending"
    )

    {
      success: true,
      analysis: analysis,
      suggested_type: suggested_type&.name,
      proposed_name: proposed_name,
      confidence: analysis[:confidence]
    }

  rescue StandardError => e
    Rails.logger.error("JobDocumentAiAnalyzer failed: #{e.class} - #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    { success: false, error: e.message }
  end

  private

  def analyze_with_claude
    api_key = ENV["ANTHROPIC_API_KEY"]
    raise AnalysisError, "ANTHROPIC_API_KEY not configured" unless api_key

    client = Anthropic::Client.new(access_token: api_key)
    prompt = build_prompt

    retries = 0
    begin
      response = client.messages(
        parameters: {
          model: MODEL,
          max_tokens: 1024,
          messages: [ { role: "user", content: prompt } ]
        }
      )

      parse_response(response)

    rescue Anthropic::Error => e
      if e.message.include?("429") || e.message.downcase.include?("rate limit")
        retries += 1
        if retries <= MAX_RETRIES
          delay = INITIAL_RETRY_DELAY * (2 ** (retries - 1))
          Rails.logger.warn("Rate limited by Anthropic API (attempt #{retries}/#{MAX_RETRIES}). Retrying in #{delay}s...")
          sleep(delay)
          retry
        else
          raise AnalysisError, "Claude API rate limited - please try again later"
        end
      else
        raise AnalysisError, "Claude API error: #{e.message}"
      end
    end
  end

  def build_prompt
    # Build document types section
    document_types = build_document_types_section

    # Job context - SSoT: use database column
    job_code = @job.job_code
    job_title = @job.title.to_s.split(",").first.to_s.strip

    <<~PROMPT
      Analyze this job document and suggest the best document type and standardized filename.

      ## Document Information
      - Current filename: #{@document.file_name}
      - File extension: #{@document.file_extension}
      - File type: #{@document.file_type}
      - Folder path: #{@document.folder_path}
      - Job: #{job_code} - #{job_title}

      ## Available Document Types for Jobs
      #{document_types}

      ## Analysis Instructions
      1. Based on the filename, extension, and folder path, identify the most likely document type
      2. Use folder path hints (e.g., "Photos" folder = Site Photo, "Plans" folder = Working Drawing)
      3. Consider file extension (e.g., .rvt = Revit Project, .dwg = AutoCAD Drawing, .jpg/.png = Site Photo)
      4. Generate a standardized filename using the naming format for that document type

      ## Naming Placeholders
      - {JobCode}: Use "#{@job.job_code}"
      - {JobTitle}: Use first part of job address (e.g., "83 West Ridge")
      - {Date}: Use DD-MM-YYYY format (Australian date format). Extract from filename if present, otherwise use today.
      - {Description}: Brief description extracted from filename
      - {Number}: Sequential number if multiple similar files
      - {CertType}: Certificate type (e.g., "Occupancy", "Final")
      - {Consultant}: Consultant name if identifiable
      - {CompanyCode}: Use "XC" (default company code)

      ## Response Format
      Respond ONLY with valid JSON:
      {
        "matched_type_id": 87,
        "matched_type_name": "Site Photo",
        "confidence": 95,
        "reasoning": "File is a .jpg in the Photos folder, consistent with site photography",
        "proposed_name": "J069 04-12-2024 Front Elevation.jpg",
        "extracted_date": "04-12-2024",
        "extracted_description": "Front Elevation"
      }

      Notes:
      - confidence: 0-100 based on certainty of match
      - If no good match, set matched_type_id to null and confidence low
      - Always preserve the original file extension
      - Use Australian date format (DD-MM-YYYY)
    PROMPT
  end

  def build_document_types_section
    # folder is computed from primary WarehouseFolder - group in Ruby after query
    doc_types = DocumentType.where(scope: %w[job both]).active.includes(warehouse_folder_document_types: :warehouse_folder).order(:name)

    if doc_types.any?
      lines = []
      grouped = doc_types.group_by(&:folder).sort_by { |folder, _| folder || "" }.to_h

      grouped.each do |folder, types|
        lines << "### #{folder || 'GENERAL'}"
        types.each do |dt|
          abbrev = dt.abbreviation.present? ? " (#{dt.abbreviation})" : ""
          format = dt.download_name.present? ? " - Format: #{dt.download_name}" : ""
          extensions = dt.file_extensions.present? ? " [#{dt.file_extensions.join(', ')}]" : ""
          lines << "- ID #{dt.id}: #{dt.name}#{abbrev}#{format}#{extensions}"
        end
        lines << ""
      end

      lines.join("\n")
    else
      "No document types configured for jobs."
    end
  end

  def generate_proposed_name(doc_type, analysis)
    format = doc_type.download_name.dup
    return analysis[:proposed_name] if format.blank?

    # Australian date format
    au_date = analysis[:extracted_date].presence || Date.current.strftime("%d-%m-%Y")

    # Job placeholders - SSoT: use database column
    job_code = @job.job_code
    job_title = @job.title.to_s.split(",").first.to_s.strip.gsub(/[^\w\s-]/, "").strip[0..30]

    format.gsub!("{JobCode}", job_code)
    format.gsub!("{JobTitle}", job_title)
    format.gsub!("{Date}", au_date)
    format.gsub!("{Description}", analysis[:extracted_description].presence || "Document")
    format.gsub!("{Number}", "01")
    format.gsub!("{CertType}", analysis[:extracted_description].presence || "Certificate")
    format.gsub!("{Consultant}", analysis[:extracted_description].presence || "Consultant")
    format.gsub!("{CompanyCode}", "XC")

    result = format.strip
    result += ".#{@document.file_extension}" if @document.file_extension.present? && !result.downcase.end_with?(".#{@document.file_extension.downcase}")

    result
  end

  def parse_response(response)
    content = response.dig("content", 0, "text") || response.dig(:content, 0, :text)

    unless content.present?
      return {
        matched_type_id: nil,
        matched_type_name: nil,
        confidence: 0,
        reasoning: "Empty response from Claude",
        proposed_name: @document.file_name
      }
    end

    # Extract JSON from response
    json_match = content.match(/\{.*\}/m)
    unless json_match
      return {
        matched_type_id: nil,
        matched_type_name: nil,
        confidence: 0,
        reasoning: "Could not parse AI response",
        proposed_name: @document.file_name
      }
    end

    json = JSON.parse(json_match[0])

    {
      matched_type_id: json["matched_type_id"],
      matched_type_name: json["matched_type_name"],
      confidence: json["confidence"].to_i,
      reasoning: json["reasoning"],
      proposed_name: json["proposed_name"],
      extracted_date: json["extracted_date"],
      extracted_description: json["extracted_description"]
    }

  rescue JSON::ParserError => e
    Rails.logger.error("Failed to parse Claude JSON response: #{e.message}")
    {
      matched_type_id: nil,
      matched_type_name: nil,
      confidence: 0,
      reasoning: "Failed to parse AI response: #{e.message}",
      proposed_name: @document.file_name
    }
  end
end
