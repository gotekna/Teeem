require "anthropic"
require "base64"

class PlanReviewService
  MAX_FILE_SIZE = 20.megabytes
  MAX_PAGES_PER_PDF = 10
  PLAN_FOLDER_PATHS = [ "01 - Plans", "02 - Engineering", "03 - Specifications" ].freeze

  class PDFNotFoundError < StandardError; end
  class FileTooLargeError < StandardError; end
  class NoConstructionError < StandardError; end
  class OneDriveNotConnectedError < StandardError; end

  def initialize(estimate)
    @estimate = estimate
    @review = nil
  end

  def execute
    # Create or get existing review
    @review = @estimate.estimate_reviews.create!(
      status: "processing",
      items_matched: 0,
      items_mismatched: 0,
      items_missing: 0,
      items_extra: 0
    )

    begin
      # Step 1: Validate estimate is matched to a construction/job
      validate_estimate_matched!

      # Step 2: Find and download PDF plans from OneDrive
      pdf_files = fetch_pdf_plans_from_onedrive

      # Step 3: Convert PDFs to base64 for Claude API
      pdf_data = prepare_pdfs_for_analysis(pdf_files)

      # Step 4: Build prompt with estimate data
      prompt = build_analysis_prompt

      # Step 5: Send to Claude API
      analysis_result = send_to_claude_api(pdf_data, prompt)

      # Step 6: Parse Claude's response
      parsed_analysis = parse_claude_response(analysis_result)

      # Step 7: Compare against estimate line items
      discrepancies = identify_discrepancies(parsed_analysis)

      # Step 8: Calculate confidence score
      confidence = calculate_confidence_score(discrepancies)

      # Step 9: Update review with results
      @review.update!(
        status: "completed",
        ai_findings: parsed_analysis,
        discrepancies: discrepancies,
        items_matched: discrepancies[:matched_count],
        items_mismatched: discrepancies[:mismatched_items].length,
        items_missing: discrepancies[:missing_items].length,
        items_extra: discrepancies[:extra_items].length,
        confidence_score: confidence,
        reviewed_at: Time.current
      )

      {
        success: true,
        review: @review,
        message: "AI review completed successfully"
      }

    rescue PDFNotFoundError => e
      handle_error("No plan documents found in OneDrive: #{e.message}")
    rescue FileTooLargeError => e
      handle_error("Plans too large for analysis: #{e.message}")
    rescue NoConstructionError => e
      handle_error("Must be matched to job first: #{e.message}")
    rescue OneDriveNotConnectedError => e
      handle_error("OneDrive not connected: #{e.message}")
    rescue StandardError => e
      handle_error("Analysis failed: #{e.message}")
    end
  end

  private

  def validate_estimate_matched!
    raise NoConstructionError, "Estimate must be matched to a construction" unless @estimate.construction
  end

  def fetch_pdf_plans_from_onedrive
    construction = @estimate.construction

    # Check if OneDrive is connected
    credential = OrganizationOneDriveCredential.active_credential
    raise OneDriveNotConnectedError, "No active OneDrive connection" unless credential

    # Initialize Microsoft Graph client
    client = MicrosoftGraphClient.new(credential)

    # Find the job folder
    job_folder = client.find_job_folder(construction)
    raise PDFNotFoundError, "Job folder not found in OneDrive" unless job_folder

    # Search for PDFs in plan folders
    pdf_files = []

    PLAN_FOLDER_PATHS.each do |folder_path|
      begin
        # Get folder items
        folder = client.get_folder_by_path("#{job_folder['name']}/#{folder_path}")
        next unless folder

        # List all items in folder
        items = client.list_folder_items(folder["id"])

        # Filter for PDF files
        pdfs = items["value"]&.select { |item| item["name"]&.end_with?(".pdf") } || []

        pdfs.each do |pdf|
          # Check file size
          if pdf["size"] > MAX_FILE_SIZE
            Rails.logger.warn "Skipping large PDF: #{pdf['name']} (#{pdf['size']} bytes)"
            next
          end

          # Download file content
          content = client.download_file(pdf["id"])

          pdf_files << {
            name: pdf["name"],
            size: pdf["size"],
            content: content
          }
        end
      rescue MicrosoftGraphClient::APIError => e
        Rails.logger.warn "Could not access folder #{folder_path}: #{e.message}"
        next
      end
    end

    raise PDFNotFoundError, "No PDF plans found in OneDrive folders" if pdf_files.empty?

    pdf_files
  end

  def prepare_pdfs_for_analysis(pdf_files)
    # Convert PDFs to base64 for Claude API
    # Note: Claude API accepts PDFs directly as base64
    pdf_files.map do |pdf|
      {
        name: pdf[:name],
        base64_content: Base64.strict_encode64(pdf[:content]),
        size: pdf[:size]
      }
    end
  end

  def build_analysis_prompt
    # Get estimate line items
    line_items = @estimate.estimate_line_items.map do |item|
      {
        category: item.category || "General",
        item: item.description,
        quantity: item.quantity,
        unit: item.unit || "ea"
      }
    end

    estimate_json = JSON.pretty_generate(line_items)

    <<~PROMPT
      You are a construction estimator analyzing architectural plans. Please extract all material quantities mentioned in these construction plans.

      For each item, provide:
      1. Category (Plumbing, Electrical, Carpentry, Concrete, etc.)
      2. Item description
      3. Quantity
      4. Unit of measure

      Format your response as JSON:
      {
        "items": [
          {"category": "Plumbing", "item": "Water Tank 400L", "quantity": 2, "unit": "ea"},
          {"category": "Electrical", "item": "LED Downlight", "quantity": 45, "unit": "ea"}
        ]
      }

      Compare these extracted quantities against this estimate from Unreal Engine:
      #{estimate_json}

      Identify any discrepancies where:
      - Quantities differ by more than 10%
      - Items are in the plans but missing from the estimate
      - Items are in the estimate but not found in the plans

      Format discrepancies as:
      {
        "discrepancies": [
          {
            "type": "quantity_mismatch",
            "category": "Plumbing",
            "item": "Water Tank",
            "plan_quantity": 3,
            "estimate_quantity": 2,
            "difference_percent": 50,
            "severity": "high",
            "recommendation": "Verify with plans - estimate may be short by 1 unit"
          },
          {
            "type": "missing_from_estimate",
            "category": "Electrical",
            "item": "Smoke Detector",
            "plan_quantity": 8,
            "severity": "medium",
            "recommendation": "Add to estimate - required by building code"
          }
        ]
      }

      Severity levels:
      - high: >20% difference or critical missing items
      - medium: 10-20% difference or important missing items
      - low: <10% difference or minor discrepancies
    PROMPT
  end

  def send_to_claude_api(pdf_data, prompt)
    api_key = ENV["ANTHROPIC_API_KEY"]
    raise StandardError, "ANTHROPIC_API_KEY not configured" unless api_key

    client = Anthropic::Client.new(access_token: api_key)

    # Build content array with PDFs and text
    content = []

    # Add PDFs as documents (Claude 3.5 Sonnet supports PDF)
    # Note: Claude API supports PDF via document type with base64 encoding
    pdf_data.each do |pdf|
      content << {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: pdf[:base64_content]
        }
      }
    end

    # Add text prompt
    content << {
      type: "text",
      text: prompt
    }

    # Call Claude API using the correct method signature for anthropic gem
    response = client.messages(
      parameters: {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: content
          }
        ]
      }
    )

    # Extract text from response
    # The anthropic gem returns a hash with the response structure
    response.dig("content", 0, "text") || response.dig(:content, 0, :text)
  rescue Anthropic::Error => e
    Rails.logger.error "Anthropic API error: #{e.message}"
    raise StandardError, "Claude API error: #{e.message}"
  end

  def parse_claude_response(response_text)
    # Claude should return JSON, but let's be defensive
    begin
      # Try to find JSON in the response
      json_match = response_text.match(/\{.*\}/m)
      return JSON.parse(json_match[0]) if json_match

      # If no JSON found, wrap the response
      { raw_response: response_text, items: [], discrepancies: [] }
    rescue JSON::ParserError => e
      Rails.logger.error "Failed to parse Claude response: #{e.message}"
      { raw_response: response_text, items: [], discrepancies: [], parse_error: e.message }
    end
  end

  def identify_discrepancies(parsed_analysis)
    plan_items = parsed_analysis["items"] || []
    estimate_items = @estimate.estimate_line_items.to_a

    matched = []
    mismatched = []
    missing = [] # In plans but not estimate
    extra = [] # In estimate but not in plans

    # Check each plan item against estimate
    plan_items.each do |plan_item|
      matching_estimate = find_matching_item(plan_item, estimate_items)

      if matching_estimate
        # Check quantity difference
        plan_qty = plan_item["quantity"].to_f
        estimate_qty = matching_estimate.quantity.to_f

        diff_percent = ((plan_qty - estimate_qty).abs / plan_qty * 100).round(2) if plan_qty > 0

        if diff_percent && diff_percent > 10
          severity = diff_percent > 20 ? "high" : "medium"
          mismatched << {
            type: "quantity_mismatch",
            category: plan_item["category"],
            item: plan_item["item"],
            plan_quantity: plan_qty,
            estimate_quantity: estimate_qty,
            difference_percent: diff_percent,
            severity: severity,
            recommendation: "Verify quantities - #{diff_percent.round}% difference detected"
          }
        else
          matched << {
            item: plan_item["item"],
            category: plan_item["category"],
            quantity: plan_qty
          }
        end
      else
        # Missing from estimate
        missing << {
          type: "missing_from_estimate",
          category: plan_item["category"],
          item: plan_item["item"],
          plan_quantity: plan_item["quantity"],
          severity: "medium",
          recommendation: "Consider adding to estimate"
        }
      end
    end

    # Check for items in estimate not found in plans
    estimate_items.each do |estimate_item|
      found_in_plans = plan_items.any? { |pi| items_match?(pi, estimate_item) }

      unless found_in_plans
        extra << {
          type: "extra_in_estimate",
          category: estimate_item.category,
          item: estimate_item.description,
          estimate_quantity: estimate_item.quantity,
          severity: "low",
          recommendation: "Verify if this item is still required"
        }
      end
    end

    {
      matched_items: matched,
      matched_count: matched.length,
      mismatched_items: mismatched,
      missing_items: missing,
      extra_items: extra,
      total_discrepancies: mismatched.length + missing.length + extra.length
    }
  end

  def find_matching_item(plan_item, estimate_items)
    # Simple fuzzy matching by description
    estimate_items.find do |ei|
      items_match?(plan_item, ei)
    end
  end

  def items_match?(plan_item, estimate_item)
    plan_desc = plan_item["item"].downcase.gsub(/[^a-z0-9]/, "")
    estimate_desc = estimate_item.description.downcase.gsub(/[^a-z0-9]/, "")

    # Check if one contains the other or they're very similar
    plan_desc.include?(estimate_desc) || estimate_desc.include?(plan_desc)
  end

  def calculate_confidence_score(discrepancies)
    total_items = @estimate.estimate_line_items.count
    return 0 if total_items.zero?

    matched = discrepancies[:matched_count]
    mismatched = discrepancies[:mismatched_items].length
    missing = discrepancies[:missing_items].length
    extra = discrepancies[:extra_items].length

    # Calculate base score from matched percentage
    base_score = (matched.to_f / total_items * 100).round(2)

    # Penalize for discrepancies
    penalty = (mismatched * 5) + (missing * 3) + (extra * 2)

    # Ensure score is between 0 and 100
    [ base_score - penalty, 0 ].max.round(2)
  end

  def handle_error(message)
    @review&.update!(
      status: "failed",
      ai_findings: { error: message },
      reviewed_at: Time.current
    )

    {
      success: false,
      error: message,
      review: @review
    }
  end
end
