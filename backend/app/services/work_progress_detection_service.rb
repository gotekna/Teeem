# frozen_string_literal: true

# WorkProgressDetectionService - Claude Vision analysis of work progress photos
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Analyzes check-in/check-out photos to:
# - Detect work completed between photos
# - Identify trade category (framing, electrical, plumbing, etc.)
# - Estimate completion percentage
# - Detect safety hazards
# - Generate progress summary for daily reports
#
class WorkProgressDetectionService
  include AnthropicClient

  # Use Sonnet for vision tasks (better at image analysis)
  self.default_claude_model = CLAUDE_SONNET
  self.default_max_tokens = 2048

  attr_reader :errors

  # Trade categories we detect
  TRADE_CATEGORIES = %w[
    demolition
    excavation
    concrete
    framing
    roofing
    plumbing
    electrical
    hvac
    insulation
    drywall
    painting
    flooring
    tiling
    landscaping
    general
    cleanup
    inspection
  ].freeze

  def initialize
    @errors = []
  end

  # Analyze progress between two photos (check-in and check-out)
  def analyze_progress(checkin_photo:, checkout_photo:)
    @errors = []

    unless checkin_photo&.photo_url.present? && checkout_photo&.photo_url.present?
      @errors << "Both check-in and check-out photos are required"
      return nil
    end

    begin
      checkin_image = fetch_and_encode_image(checkin_photo.photo_url)
      checkout_image = fetch_and_encode_image(checkout_photo.photo_url)

      return nil if @errors.any?

      analyze_photo_pair(checkin_image, checkout_image, checkin_photo, checkout_photo)
    rescue StandardError => e
      @errors << "Analysis failed: #{e.message}"
      Rails.logger.error "[WorkProgressDetection] Error: #{e.class} - #{e.message}"
      nil
    end
  end

  # Analyze a single photo for safety hazards
  def analyze_safety(photo)
    @errors = []

    unless photo&.photo_url.present?
      @errors << "Photo is required"
      return nil
    end

    begin
      image_data = fetch_and_encode_image(photo.photo_url)
      return nil if @errors.any?

      analyze_for_safety(image_data)
    rescue StandardError => e
      @errors << "Safety analysis failed: #{e.message}"
      Rails.logger.error "[WorkProgressDetection] Safety error: #{e.class} - #{e.message}"
      nil
    end
  end

  # Detect what trade work is visible in a photo
  def detect_trade(photo)
    @errors = []

    unless photo&.photo_url.present?
      @errors << "Photo is required"
      return nil
    end

    begin
      image_data = fetch_and_encode_image(photo.photo_url)
      return nil if @errors.any?

      detect_trade_from_image(image_data)
    rescue StandardError => e
      @errors << "Trade detection failed: #{e.message}"
      nil
    end
  end

  # Generate daily progress report from all photos taken that day
  def generate_daily_report(job:, date:)
    @errors = []

    photos = SmTaskPhoto.where(job_id: job.id)
                        .for_date(date)
                        .order(:taken_at)

    if photos.empty?
      return {
        job_id: job.id,
        date: date,
        summary: "No photos captured for this day",
        photos_analyzed: 0
      }
    end

    # Analyze photos in pairs (morning vs afternoon, etc.)
    analyses = []
    photos.each_slice(2) do |pair|
      if pair.length == 2
        analysis = analyze_progress(checkin_photo: pair[0], checkout_photo: pair[1])
        analyses << analysis if analysis
      end
    end

    # Generate summary report
    generate_summary_report(job, date, photos, analyses)
  end

  private

  def fetch_and_encode_image(url)
    require "open-uri"
    require "base64"

    # Determine media type
    media_type = case url.downcase
                 when /\.png/ then "image/png"
                 when /\.gif/ then "image/gif"
                 when /\.webp/ then "image/webp"
                 else "image/jpeg"
    end

    # Download and encode
    image_data = URI.open(url, read_timeout: 15) { |f| f.read }

    {
      type: "image",
      source: {
        type: "base64",
        media_type: media_type,
        data: Base64.strict_encode64(image_data)
      }
    }
  rescue StandardError => e
    @errors << "Failed to fetch image: #{e.message}"
    nil
  end

  def analyze_photo_pair(checkin_image, checkout_image, checkin_photo, checkout_photo)
    system_prompt = <<~SYSTEM
      You are a construction site progress analyst. You will be shown two photos from a construction site:
      1. A "before" photo (check-in, start of work)
      2. An "after" photo (check-out, end of work)

      Analyze the differences between the photos and provide a structured assessment of work completed.
      Be specific about what changed between the photos.
      If the photos appear to be from different locations or angles, note this uncertainty.
    SYSTEM

    user_prompt = <<~PROMPT
      Analyze these two construction site photos and describe the work progress.

      Photo 1 (CHECK-IN - Start of Day):
      - Taken at: #{checkin_photo.taken_at}
      - GPS: #{checkin_photo.effective_latitude}, #{checkin_photo.effective_longitude}

      Photo 2 (CHECK-OUT - End of Day):
      - Taken at: #{checkout_photo.taken_at}
      - GPS: #{checkout_photo.effective_latitude}, #{checkout_photo.effective_longitude}

      Respond in JSON format with this exact structure:
      {
        "work_detected": true/false,
        "confidence": 0-100,
        "trade_category": "one of: #{TRADE_CATEGORIES.join(', ')}",
        "completion_estimate": 0-100,
        "work_summary": "2-3 sentence description of work completed",
        "specific_changes": ["list", "of", "visible", "changes"],
        "materials_visible": ["list", "of", "materials", "seen"],
        "safety_observations": {
          "ppe_visible": true/false,
          "hazards_detected": ["list of hazards if any"],
          "site_condition": "clean/messy/hazardous"
        },
        "same_location": true/false,
        "notes": "any additional observations"
      }
    PROMPT

    content = [
      checkin_image,
      checkout_image,
      { type: "text", text: user_prompt }
    ]

    response = call_claude_with_content(
      content: content,
      system: system_prompt,
      max_tokens: 2048
    )

    result = parse_claude_json(response)

    # Add metadata
    result[:checkin_photo_id] = checkin_photo.id
    result[:checkout_photo_id] = checkout_photo.id
    result[:analyzed_at] = Time.current

    result
  end

  def analyze_for_safety(image_data)
    system_prompt = <<~SYSTEM
      You are a construction site safety inspector. Analyze the photo for:
      - PPE compliance (hard hats, hi-vis, boots, gloves, safety glasses)
      - Hazards (fall risks, electrical, chemical, structural)
      - Site organization and housekeeping
      - Emergency access and egress

      Be specific about locations of issues in the image.
    SYSTEM

    user_prompt = <<~PROMPT
      Analyze this construction site photo for safety compliance and hazards.

      Respond in JSON format:
      {
        "overall_rating": "safe/concerns/hazardous",
        "ppe_compliance": {
          "hard_hats": "compliant/non_compliant/not_visible",
          "hi_vis": "compliant/non_compliant/not_visible",
          "safety_boots": "compliant/non_compliant/not_visible",
          "other": ["list of other PPE observed"]
        },
        "hazards": [
          {
            "type": "fall/electrical/chemical/structural/trip/other",
            "severity": "low/medium/high/critical",
            "description": "specific description",
            "location": "where in the image"
          }
        ],
        "housekeeping": "excellent/acceptable/poor",
        "recommendations": ["list of safety improvements needed"],
        "requires_immediate_action": true/false,
        "notes": "additional safety observations"
      }
    PROMPT

    content = [
      image_data,
      { type: "text", text: user_prompt }
    ]

    response = call_claude_with_content(
      content: content,
      system: system_prompt,
      max_tokens: 1500
    )

    result = parse_claude_json(response)
    result[:analyzed_at] = Time.current
    result
  end

  def detect_trade_from_image(image_data)
    user_prompt = <<~PROMPT
      Look at this construction site photo and identify what type of trade work is being performed or is visible.

      Respond in JSON format:
      {
        "primary_trade": "one of: #{TRADE_CATEGORIES.join(', ')}",
        "secondary_trades": ["other trades visible"],
        "confidence": 0-100,
        "visible_work": "description of work visible",
        "stage": "rough/finish/unknown"
      }
    PROMPT

    content = [
      image_data,
      { type: "text", text: user_prompt }
    ]

    response = call_claude_with_content(
      content: content,
      max_tokens: 500
    )

    parse_claude_json(response)
  end

  def generate_summary_report(job, date, photos, analyses)
    # Aggregate findings
    trades_detected = analyses.map { |a| a[:trade_category] }.compact.uniq
    total_completion = analyses.map { |a| a[:completion_estimate] || 0 }.sum / [analyses.length, 1].max
    work_summaries = analyses.map { |a| a[:work_summary] }.compact
    all_changes = analyses.flat_map { |a| a[:specific_changes] || [] }.uniq

    # Safety aggregation
    safety_issues = analyses.flat_map { |a| a.dig(:safety_observations, :hazards_detected) || [] }.uniq

    {
      job_id: job.id,
      job_name: job.name,
      date: date,
      photos_analyzed: photos.count,
      analysis_count: analyses.count,
      trades_detected: trades_detected,
      average_completion: total_completion.round(0),
      work_summary: work_summaries.join(" "),
      key_changes: all_changes.first(10),
      safety_issues: safety_issues,
      photos: photos.map { |p| { id: p.id, type: p.photo_type, taken_at: p.taken_at } },
      generated_at: Time.current
    }
  end
end
