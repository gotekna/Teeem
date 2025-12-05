# Service for classifying emails as marketing, spam, business, or transactional
# Uses heuristic rules (fast) and optional AI classification (accurate but slow)
class EmailClassificationService
  # Marketing indicators in subject/body
  MARKETING_KEYWORDS = [
    # Sales & promotions
    /\b\d+%\s+(off|discount|sale)/i,
    /black\s+friday/i,
    /cyber\s+monday/i,
    /limited\s+time/i,
    /act\s+now/i,
    /free\s+shipping/i,
    /buy\s+now/i,
    /shop\s+now/i,
    /flash\s+sale/i,

    # Newsletter patterns
    /view\s+in\s+browser/i,
    /unsubscribe/i,
    /manage\s+preferences/i,
    /update\s+preferences/i,
    /if\s+you\s+(no\s+longer|don't)\s+wish/i,

    # Marketing language
    /exclusive\s+offer/i,
    /special\s+offer/i,
    /don't\s+miss\s+out/i,
    /ends\s+(soon|today|tonight)/i
  ].freeze

  # Spam indicators
  SPAM_KEYWORDS = [
    /\$\$\$/,
    /!!!+/,
    /click\s+here\s+now/i,
    /congratulations!!/i,
    /you've\s+won/i,
    /claim\s+your\s+prize/i,
    /urgent\s+response\s+required/i
  ].freeze

  # Common marketing/newsletter platforms
  MARKETING_DOMAINS = %w[
    mailchimp.com
    constantcontact.com
    sendgrid.net
    mailgun.org
    sparkpostmail.com
    amazonses.com
    mandrillapp.com
    campaign-archive.com
    newsletters
    marketing
    promo
    noreply
  ].freeze

  # Transactional email indicators
  TRANSACTIONAL_KEYWORDS = [
    /your\s+(order|receipt|invoice|payment)/i,
    /order\s+confirmation/i,
    /payment\s+(received|confirmed)/i,
    /shipping\s+notification/i,
    /account\s+(created|activated|verified)/i,
    /password\s+reset/i
  ].freeze

  def initialize(email_warehouse)
    @email = email_warehouse
  end

  # Main entry point - classify the email and store result
  def classify!
    result = classify_with_heuristics

    # Queue for AI classification if uncertain
    if result[:confidence] < 0.7
      ClassifyEmailWithAIJob.perform_later(@email.id)
    else
      # Store heuristic result immediately
      @email.update_column(:email_classification, result)
    end

    result
  end

  private

  # Fast heuristic classification using rules
  def classify_with_heuristics
    # Check headers first (most reliable)
    return marketing_classification('marketing_headers') if has_marketing_headers?
    return spam_classification('spam_indicators') if has_spam_indicators?
    return transactional_classification('transactional_patterns') if is_transactional?

    # Analyze content patterns
    subject_score = analyze_subject
    body_score = analyze_body
    domain_score = analyze_domain

    # Calculate combined scores
    marketing_score = (subject_score[:marketing] + body_score[:marketing] + domain_score[:marketing]) / 3.0
    spam_score = (subject_score[:spam] + body_score[:spam]) / 2.0
    transactional_score = subject_score[:transactional]

    # Determine type based on highest score
    type, confidence = determine_type_and_confidence(
      marketing_score,
      spam_score,
      transactional_score
    )

    {
      email_type: type,
      confidence: confidence,
      signals: collect_signals(subject_score, body_score, domain_score),
      classified_at: Time.current,
      method: 'heuristic'
    }
  end

  # Check for marketing headers (List-Unsubscribe, Precedence: bulk)
  def has_marketing_headers?
    headers = @email.internet_headers || {}

    headers.key?('List-Unsubscribe') ||
    headers['Precedence']&.downcase == 'bulk' ||
    headers.key?('X-Campaign-Id') ||
    headers.key?('X-Mailgun-Campaign-Id') ||
    headers.key?('X-SG-EID') # SendGrid email ID
  end

  # Check for spam indicators in subject
  def has_spam_indicators?
    subject = @email.subject || ''

    # All caps subject with 10+ chars
    return true if subject.length > 10 && subject == subject.upcase

    # Excessive punctuation
    return true if subject.scan(/[!?]/).length >= 3

    # Spam keywords
    SPAM_KEYWORDS.any? { |pattern| subject.match?(pattern) }
  end

  # Check if email is transactional (receipt, order confirmation, etc.)
  def is_transactional?
    subject = @email.subject || ''
    body = @email.body_text&.first(500) || ''

    TRANSACTIONAL_KEYWORDS.any? do |pattern|
      subject.match?(pattern) || body.match?(pattern)
    end
  end

  # Analyze subject line for marketing/spam patterns
  def analyze_subject
    subject = @email.subject || ''

    {
      marketing: keyword_score(subject, MARKETING_KEYWORDS),
      spam: keyword_score(subject, SPAM_KEYWORDS),
      transactional: keyword_score(subject, TRANSACTIONAL_KEYWORDS)
    }
  end

  # Analyze email body for patterns
  def analyze_body
    body = @email.body_text&.first(2000) || ''
    html = @email.body_html&.first(2000) || ''

    # Check for unsubscribe links
    has_unsub_link = body.match?(/unsubscribe/i) || html.match?(/unsubscribe/i)

    # Check for "view in browser" links
    has_view_link = body.match?(/view.*browser/i) || html.match?(/view.*browser/i)

    {
      marketing: (has_unsub_link || has_view_link ? 0.8 : keyword_score(body, MARKETING_KEYWORDS)),
      spam: keyword_score(body, SPAM_KEYWORDS)
    }
  end

  # Analyze sender domain
  def analyze_domain
    from_email = @email.from_email || ''
    domain = from_email.split('@').last&.downcase || ''

    # Check if from a known marketing platform
    is_marketing_domain = MARKETING_DOMAINS.any? { |md| domain.include?(md) }

    {
      marketing: is_marketing_domain ? 0.9 : 0.0
    }
  end

  # Calculate keyword match score (0.0 - 1.0)
  def keyword_score(text, patterns)
    return 0.0 if text.blank?

    matches = patterns.count { |pattern| text.match?(pattern) }
    return 0.0 if matches.zero?

    # Cap at 1.0
    [matches.to_f / patterns.length, 1.0].min
  end

  # Determine email type based on scores
  def determine_type_and_confidence(marketing_score, spam_score, transactional_score)
    # Spam takes priority if high enough
    return ['spam', spam_score] if spam_score >= 0.5

    # Transactional if clearly identified
    return ['transactional', transactional_score] if transactional_score >= 0.7

    # Marketing if score is significant
    return ['marketing', marketing_score] if marketing_score >= 0.5

    # Default to business with low confidence
    ['business', 0.3]
  end

  # Collect signals that triggered classification
  def collect_signals(subject_score, body_score, domain_score)
    signals = []

    signals << 'marketing_subject' if subject_score[:marketing] > 0.5
    signals << 'marketing_body' if body_score[:marketing] > 0.5
    signals << 'marketing_domain' if domain_score[:marketing] > 0.7
    signals << 'spam_subject' if subject_score[:spam] > 0.5
    signals << 'spam_body' if body_score[:spam] > 0.5
    signals << 'transactional_subject' if subject_score[:transactional] > 0.5

    signals
  end

  # Helper methods for returning classification results
  def marketing_classification(signal)
    {
      email_type: 'marketing',
      confidence: 0.95,
      signals: [signal],
      classified_at: Time.current,
      method: 'heuristic'
    }
  end

  def spam_classification(signal)
    {
      email_type: 'spam',
      confidence: 0.9,
      signals: [signal],
      classified_at: Time.current,
      method: 'heuristic'
    }
  end

  def transactional_classification(signal)
    {
      email_type: 'transactional',
      confidence: 0.85,
      signals: [signal],
      classified_at: Time.current,
      method: 'heuristic'
    }
  end
end
