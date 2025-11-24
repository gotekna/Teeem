# frozen_string_literal: true

require 'anthropic'
require 'base64'

# SmWorkingDrawingsService - AI-powered construction document categorization
#
# Processes PDF working drawings and uses Claude to categorize each page:
# - Floor Plans
# - Site Plans
# - Elevations (Front, Rear, Side)
# - Sections
# - Details
# - Schedules (Door, Window, Finish)
# - Specifications
# - Cover Sheet
# - Other
#
# See GANTT_ARCHITECTURE_PLAN.md Section 11 (Working Drawings AI System)
#
class SmWorkingDrawingsService
  CATEGORIES = %w[
    floor_plan
    site_plan
    elevation_front
    elevation_rear
    elevation_side
    section
    detail
    schedule_door
    schedule_window
    schedule_finish
    specifications
    cover_sheet
    structural
    electrical
    plumbing
    mechanical
    landscape
    other
  ].freeze

  MAX_FILE_SIZE = 25.megabytes
  MAX_PAGES = 50

  class ProcessingError < StandardError; end
  class FileTooLargeError < StandardError; end
  class APIError < StandardError; end

  attr_reader :task, :errors, :processed_pages

  def initialize(task)
    @task = task
    @errors = []
    @processed_pages = []
  end

  # Process a PDF file and categorize all pages
  # Returns { success: bool, pages: [], errors: [] }
  def process_pdf(pdf_content, filename: 'document.pdf')
    validate_file_size!(pdf_content)

    ActiveRecord::Base.transaction do
      # Clear existing pages for this task
      task.working_drawing_pages.destroy_all

      # Send PDF to Claude for page-by-page analysis
      categorization = analyze_with_claude(pdf_content, filename)

      # Create page records
      categorization[:pages].each do |page_data|
        create_page_record(page_data)
      end

      success_result
    end
  rescue ProcessingError, FileTooLargeError, APIError => e
    @errors << e.message
    failure_result
  rescue StandardError => e
    Rails.logger.error("SmWorkingDrawingsService error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
    @errors << "Processing failed: #{e.message}"
    failure_result
  end

  # Process from a URL (e.g., OneDrive, S3)
  def process_from_url(url)
    require 'open-uri'
    pdf_content = URI.open(url, &:read)
    filename = File.basename(URI.parse(url).path)
    process_pdf(pdf_content, filename: filename)
  rescue OpenURI::HTTPError => e
    @errors << "Failed to download file: #{e.message}"
    failure_result
  end

  # Get categorization summary for a task
  def self.summary_for_task(task)
    pages = task.working_drawing_pages.ordered

    {
      total_pages: pages.count,
      by_category: pages.group(:category).count,
      overridden_count: pages.overridden.count,
      pages: pages.map do |p|
        {
          page_number: p.page_number,
          category: p.effective_category,
          ai_confidence: p.ai_confidence,
          overridden: p.category_overridden?
        }
      end
    }
  end

  private

  def validate_file_size!(content)
    if content.bytesize > MAX_FILE_SIZE
      raise FileTooLargeError, "File too large (#{(content.bytesize / 1.megabyte).round(1)}MB). Max: #{MAX_FILE_SIZE / 1.megabyte}MB"
    end
  end

  def analyze_with_claude(pdf_content, filename)
    api_key = ENV['ANTHROPIC_API_KEY']
    raise APIError, "ANTHROPIC_API_KEY not configured" unless api_key

    client = Anthropic::Client.new(access_token: api_key)

    # Build content with PDF
    content = [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: Base64.strict_encode64(pdf_content)
        }
      },
      {
        type: "text",
        text: build_categorization_prompt(filename)
      }
    ]

    # Call Claude API
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

    # Parse response
    response_text = response.dig("content", 0, "text") || response.dig(:content, 0, :text)
    parse_categorization_response(response_text)
  rescue Anthropic::Error => e
    Rails.logger.error "Anthropic API error: #{e.message}"
    raise APIError, "Claude API error: #{e.message}"
  end

  def build_categorization_prompt(filename)
    <<~PROMPT
      You are analyzing construction working drawings. Please identify and categorize each page of this PDF document: "#{filename}"

      For each page, determine the most appropriate category from this list:
      - floor_plan: Floor plans, layout plans
      - site_plan: Site plans, plot plans, survey plans
      - elevation_front: Front elevation views
      - elevation_rear: Rear elevation views
      - elevation_side: Side elevation views (left or right)
      - section: Building sections, cross-sections
      - detail: Construction details, enlarged views
      - schedule_door: Door schedules
      - schedule_window: Window schedules
      - schedule_finish: Finish schedules, material schedules
      - specifications: Written specifications, notes pages
      - cover_sheet: Title pages, cover sheets, drawing index
      - structural: Structural plans, framing plans, foundation plans
      - electrical: Electrical plans, lighting plans
      - plumbing: Plumbing plans, drainage plans
      - mechanical: HVAC plans, mechanical systems
      - landscape: Landscape plans, external works
      - other: Anything that doesn't fit above categories

      Respond with ONLY a JSON object in this exact format:
      {
        "filename": "#{filename}",
        "total_pages": <number>,
        "pages": [
          {
            "page_number": 1,
            "category": "cover_sheet",
            "confidence": 0.95,
            "description": "Brief description of what's on this page"
          },
          {
            "page_number": 2,
            "category": "floor_plan",
            "confidence": 0.88,
            "description": "Ground floor layout"
          }
        ]
      }

      Important:
      - Analyze EVERY page in the document
      - Use only categories from the list above
      - Confidence should be between 0.0 and 1.0
      - Be specific about which elevation (front/rear/side) or which floor
    PROMPT
  end

  def parse_categorization_response(response_text)
    # Extract JSON from response (Claude might include explanation text)
    json_match = response_text.match(/\{[\s\S]*\}/)
    raise ProcessingError, "Could not parse AI response" unless json_match

    result = JSON.parse(json_match[0], symbolize_names: true)

    # Validate structure
    unless result[:pages].is_a?(Array)
      raise ProcessingError, "Invalid response structure from AI"
    end

    # Validate and normalize categories
    result[:pages].each do |page|
      page[:category] = normalize_category(page[:category])
      page[:confidence] = [[page[:confidence].to_f, 0.0].max, 1.0].min
    end

    result
  rescue JSON::ParserError => e
    Rails.logger.error "JSON parse error: #{e.message}\nResponse: #{response_text}"
    raise ProcessingError, "Failed to parse AI categorization response"
  end

  def normalize_category(category)
    normalized = category.to_s.downcase.strip.gsub(/\s+/, '_')
    CATEGORIES.include?(normalized) ? normalized : 'other'
  end

  def create_page_record(page_data)
    page = SmWorkingDrawingPage.create!(
      task: task,
      page_number: page_data[:page_number],
      image_url: generate_page_image_url(page_data[:page_number]),
      category: page_data[:category],
      ai_confidence: page_data[:confidence]
    )
    @processed_pages << page
  end

  def generate_page_image_url(page_number)
    # Placeholder URL - in production this would be the actual page image URL
    # Page images would be generated by a PDF-to-image conversion process
    "/api/v1/sm_tasks/#{task.id}/working_drawings/pages/#{page_number}.png"
  end

  def success_result
    {
      success: true,
      task_id: task.id,
      pages: @processed_pages.map { |p| page_to_json(p) },
      summary: {
        total_pages: @processed_pages.count,
        by_category: @processed_pages.group_by(&:category).transform_values(&:count)
      },
      errors: []
    }
  end

  def failure_result
    {
      success: false,
      task_id: task.id,
      pages: [],
      summary: {},
      errors: @errors
    }
  end

  def page_to_json(page)
    {
      id: page.id,
      page_number: page.page_number,
      category: page.category,
      effective_category: page.effective_category,
      ai_confidence: page.ai_confidence,
      category_overridden: page.category_overridden?,
      manual_category: page.manual_category,
      image_url: page.image_url
    }
  end
end
