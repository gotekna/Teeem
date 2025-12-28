# Background job for AI-based email classification using Claude Haiku
# Only runs for emails with uncertain heuristic classification (confidence < 0.7)
class ClassifyEmailWithAiJob < ApplicationJob
  queue_as :default

  # Rate limiting to control AI costs: max 100 classifications per hour
  # At $0.0001 per email, this caps costs at $0.01/hour or $7.20/month max
  RATE_LIMIT_THRESHOLD = 100
  RATE_LIMIT_PERIOD = 1.hour

  # Skip this job if Anthropic API key is not configured
  def self.enabled?
    ENV["ANTHROPIC_API_KEY"].present?
  end

  def perform(email_warehouse_id)
    email = EmailWarehouse.find_by(id: email_warehouse_id)
    return unless email

    # Skip if already confidently classified
    current = email.email_classification || {}
    return if current["confidence"].to_f >= 0.8

    # Check rate limit
    if rate_limit_exceeded?
      # Re-queue for later
      self.class.set(wait: 1.hour).perform_later(email_warehouse_id)
      return
    end

    # Call Anthropic API for classification
    result = classify_with_ai(email)

    # Update email with AI result
    email.update_column(
      :email_classification,
      result.merge(
        method: "ai",
        model: "claude-3-haiku-20240307"
      )
    )

    # Track rate limit counter for next check
    increment_rate_limit_counter

    Rails.logger.info "[EmailClassification] AI classified email #{email.id} as #{result[:email_type]} (confidence: #{result[:confidence]})"
  rescue StandardError => e
    Rails.logger.error "[EmailClassification] AI classification failed for email #{email_warehouse_id}: #{e.message}"
    # Don't re-raise - we don't want to retry indefinitely
  end

  private

  def classify_with_ai(email)
    client = Anthropic::Client.new

    prompt = <<~PROMPT
      Classify this email as one of: business, marketing, spam, or transactional.

      From: #{email.from_email}
      Subject: #{email.subject}
      Body preview: #{email.body_text&.first(500)}

      Return ONLY valid JSON in this exact format:
      {
        "email_type": "marketing",
        "confidence": 0.95,
        "reasoning": "Contains unsubscribe link and promotional language"
      }

      email_type must be one of: business, marketing, spam, transactional
      confidence must be a number between 0 and 1
    PROMPT

    response = client.messages(
      parameters: {
        model: "claude-3-haiku-20240307",
        max_tokens: 200,
        messages: [ { role: "user", content: prompt } ]
      }
    )

    # Parse JSON response
    text = response.dig("content", 0, "text")
    result = JSON.parse(text)

    # Validate response format
    unless %w[business marketing spam transactional].include?(result["email_type"])
      raise "Invalid email_type: #{result['email_type']}"
    end

    unless result["confidence"].is_a?(Numeric) && result["confidence"].between?(0, 1)
      raise "Invalid confidence: #{result['confidence']}"
    end

    {
      email_type: result["email_type"],
      confidence: result["confidence"],
      reasoning: result["reasoning"] || "",
      classified_at: Time.current
    }
  rescue JSON::ParserError => e
    Rails.logger.error "[EmailClassification] Failed to parse AI response: #{e.message}"
    # Fallback to low-confidence business classification
    {
      email_type: "business",
      confidence: 0.3,
      reasoning: "AI classification failed, defaulting to business",
      classified_at: Time.current
    }
  end

  def rate_limit_exceeded?
    # Performance: Use cache-based counter instead of expensive database query
    # Old approach: COUNT query on 680MB email_warehouse table (132ms avg)
    # New approach: Atomic increment in Rails.cache (~1ms)
    cache_key = "ai_classification_rate_limit:#{Time.current.beginning_of_hour.to_i}"

    current_count = Rails.cache.read(cache_key).to_i
    current_count >= RATE_LIMIT_THRESHOLD
  end

  def increment_rate_limit_counter
    cache_key = "ai_classification_rate_limit:#{Time.current.beginning_of_hour.to_i}"
    Rails.cache.increment(cache_key, 1, expires_in: 2.hours)
  end
end
