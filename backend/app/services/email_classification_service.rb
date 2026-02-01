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

  # Social media domains - notifications and marketing
  SOCIAL_MEDIA_DOMAINS = %w[
    facebookmail.com
    facebook.com
    instagram.com
    twitter.com
    x.com
    linkedin.com
    tiktok.com
    pinterest.com
    snapchat.com
    reddit.com
    youtube.com
    whatsapp.com
    telegram.org
    discord.com
    twitch.tv
    threads.net
  ].freeze

  # Trusted external business partner domains - NEVER classify as spam
  # SSoT: Internal domains come from TenantSetting.internal_email_domains
  EXTERNAL_TRUSTED_DOMAINS = %w[
    bunnings.com.au
    harveynorman.com.au
    joii.org
    bartleylaw.com
    moorelawyers.com.au
    heartwoodind.com.au
    a1servicesgroup.com.au
    australianqc.com.au
    titusplus.com
  ].freeze

  # All trusted domains: internal + external partners
  def self.trusted_domains
    TenantSetting.internal_email_domains + EXTERNAL_TRUSTED_DOMAINS
  end

  # Automated/ephemeral emails - short retention period (7 days)
  # These are useful briefly but become noise quickly
  EPHEMERAL_PATTERNS = {
    github_notifications: {
      from_pattern: /notifications@github\.com|noreply@github\.com/i,
      subject_patterns: [
        /\[.*\]\s*(Run failed|Run succeeded|Run cancelled)/i,  # GitHub Actions
        /\[.*\]\s*Build/i,
        /\[.*\]\s*Deploy/i,
        /\[.*\]\s*CI/i
      ],
      retention_days: 7
    },
    calendar_notifications: {
      from_pattern: /calendar-notification@google\.com|noreply@calendar\.google\.com/i,
      subject_patterns: [ /reminder:/i, /invitation:/i, /updated invitation/i ],
      retention_days: 7
    },
    system_alerts: {
      from_pattern: /heroku|sentry|datadog|pingdom|uptime/i,
      subject_patterns: [ /alert/i, /down/i, /recovered/i, /warning/i ],
      retention_days: 14
    },
    shipping_tracking: {
      from_pattern: /auspost|startrack|dhl|fedex|ups|tracking/i,
      subject_patterns: [ /tracking|shipped|delivered|in transit/i ],
      retention_days: 30
    },
    social_media_notifications: {
      from_pattern: /facebookmail\.com|@facebook\.com|@instagram\.com|@twitter\.com|@x\.com|@linkedin\.com|@tiktok\.com|@pinterest\.com|@snapchat\.com|@reddit\.com|@youtube\.com|@discord\.com|@twitch\.tv|@threads\.net/i,
      subject_patterns: [
        # Facebook/Instagram
        /commented on|tagged you|mentioned you|replied to|reacted to/i,
        /sent you a message|new friend request|people you may know/i,
        /posted in|new post in|activity on your|new memory/i,
        /started following you|new follower/i,
        /birthday|suggested for you/i,
        # LinkedIn
        /new connection|endorsed you|viewed your profile|new job/i,
        /is hiring|who's viewed|invitation to connect/i,
        /commented on your post|liked your/i,
        # Twitter/X
        /new tweet|retweeted|liked your tweet|new direct message/i,
        /is now following you|trending/i,
        # YouTube
        /uploaded a video|new video from|subscribed to/i,
        /commented on your video|new subscriber/i,
        # TikTok
        /new video|liked your video|new duet/i,
        # Discord
        /missed a call|new message in|server invite/i,
        # Reddit
        /upvoted|new comment on|trending on/i,
        # Generic social patterns
        /notification from|weekly digest|daily digest/i
      ],
      retention_days: 7
    }
  }.freeze

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

    # Queue for AI classification if uncertain AND AI is enabled
    if result[:confidence] < 0.7 && ClassifyEmailWithAiJob.enabled?
      ClassifyEmailWithAiJob.perform_later(@email.id)
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
    return marketing_classification("marketing_headers") if has_marketing_headers?
    return spam_classification("spam_indicators") if has_spam_indicators?
    return transactional_classification("transactional_patterns") if is_transactional?

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

    result = {
      email_type: type,
      confidence: confidence,
      signals: collect_signals(subject_score, body_score, domain_score),
      classified_at: Time.current,
      method: "heuristic"
    }

    # Check if this is an ephemeral email with short retention
    ephemeral_info = detect_ephemeral
    if ephemeral_info
      result[:ephemeral] = true
      result[:ephemeral_type] = ephemeral_info[:type]
      result[:retention_days] = ephemeral_info[:retention_days]
      result[:expires_at] = (@email.received_at || Time.current) + ephemeral_info[:retention_days].days
    end

    result
  end

  # Detect if email is ephemeral (automated notifications with short retention)
  def detect_ephemeral
    from_email = @email.from_email || ""
    subject = @email.subject || ""

    EPHEMERAL_PATTERNS.each do |type, config|
      next unless from_email.match?(config[:from_pattern])

      # Check if subject matches any pattern for this type
      if config[:subject_patterns].any? { |pattern| subject.match?(pattern) }
        return { type: type, retention_days: config[:retention_days] }
      end
    end

    nil
  end

  # Check for marketing headers (List-Unsubscribe, Precedence: bulk)
  def has_marketing_headers?
    headers = @email.internet_headers || {}

    headers.key?("List-Unsubscribe") ||
    headers["Precedence"]&.downcase == "bulk" ||
    headers.key?("X-Campaign-Id") ||
    headers.key?("X-Mailgun-Campaign-Id") ||
    headers.key?("X-SG-EID") # SendGrid email ID
  end

  # Check for spam indicators in subject
  def has_spam_indicators?
    subject = @email.subject || ""

    # Never classify trusted domains as spam
    # SSoT: Use trusted_domains method which includes internal + external partners
    from_domain = (@email.from_email || "").split("@").last&.downcase
    return false if from_domain && self.class.trusted_domains.any? { |td| from_domain.include?(td) }

    # All caps with 10+ chars - BUT exclude business patterns
    # (job addresses, legal matters, company names are often caps)
    if subject.length > 10 && subject == subject.upcase
      # Skip ALL CAPS check if it looks like a business email
      # These patterns are common in construction/legal:
      # - RE:/FW: prefixes
      # - Contains lot/address numbers
      # - Contains company suffixes (PTY LTD, etc.)
      # - Contains legal case references
      business_patterns = [
        /^(RE|FW|FWD):/i,                    # Reply/Forward
        /LOT\s+\d+/i,                         # Lot numbers
        /PTY\s+LTD/i,                         # Company suffix
        /\d+\s+[A-Z]+\s+(ST|RD|AVE|DR|CT)/i,  # Street addresses
        /INV[-\s]?\d+/i,                      # Invoice numbers
        /ORDER\s+#?\d+/i,                     # Order numbers (with number)
        /ACCOUNT\s+\d+/i,                     # Account numbers
        /QUD\d+|BS\d+/i,                      # Court case numbers
        /LIQUIDAT/i                           # Legal proceedings
      ]

      is_business_caps = business_patterns.any? { |p| subject.match?(p) }
      return true unless is_business_caps
    end

    # Excessive punctuation (3+ !) - BUT only if no business context
    if subject.scan(/[!]/).length >= 3
      # "ORDER!!!" from Bunnings is legitimate, check for business context
      return false if subject.match?(/ORDER|INVOICE|ACCOUNT/i)
      return true
    end

    # Spam keywords
    SPAM_KEYWORDS.any? { |pattern| subject.match?(pattern) }
  end

  # Check if email is transactional (receipt, order confirmation, etc.)
  def is_transactional?
    subject = @email.subject || ""
    body = @email.body_text&.first(500) || ""

    TRANSACTIONAL_KEYWORDS.any? do |pattern|
      subject.match?(pattern) || body.match?(pattern)
    end
  end

  # Analyze subject line for marketing/spam patterns
  def analyze_subject
    subject = @email.subject || ""

    {
      marketing: keyword_score(subject, MARKETING_KEYWORDS),
      spam: keyword_score(subject, SPAM_KEYWORDS),
      transactional: keyword_score(subject, TRANSACTIONAL_KEYWORDS)
    }
  end

  # Analyze email body for patterns
  def analyze_body
    body = @email.body_text&.first(2000) || ""
    html = @email.body_html&.first(2000) || ""

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
    from_email = @email.from_email || ""
    domain = from_email.split("@").last&.downcase || ""

    # Check if from a known marketing platform
    is_marketing_domain = MARKETING_DOMAINS.any? { |md| domain.include?(md) }

    # Check if from a social media platform (treat as marketing)
    is_social_media_domain = SOCIAL_MEDIA_DOMAINS.any? { |sd| domain.include?(sd) }

    {
      marketing: (is_marketing_domain || is_social_media_domain) ? 0.9 : 0.0,
      social_media: is_social_media_domain
    }
  end

  # Calculate keyword match score (0.0 - 1.0)
  def keyword_score(text, patterns)
    return 0.0 if text.blank?

    matches = patterns.count { |pattern| text.match?(pattern) }
    return 0.0 if matches.zero?

    # Cap at 1.0
    [ matches.to_f / patterns.length, 1.0 ].min
  end

  # Determine email type based on scores
  def determine_type_and_confidence(marketing_score, spam_score, transactional_score)
    # Spam takes priority if high enough
    return [ "spam", spam_score ] if spam_score >= 0.5

    # Transactional if clearly identified
    return [ "transactional", transactional_score ] if transactional_score >= 0.7

    # Marketing if score is significant
    return [ "marketing", marketing_score ] if marketing_score >= 0.5

    # Default to business with low confidence
    [ "business", 0.3 ]
  end

  # Collect signals that triggered classification
  def collect_signals(subject_score, body_score, domain_score)
    signals = []

    signals << "marketing_subject" if subject_score[:marketing] > 0.5
    signals << "marketing_body" if body_score[:marketing] > 0.5
    signals << "marketing_domain" if domain_score[:marketing] > 0.7
    signals << "social_media_domain" if domain_score[:social_media]
    signals << "spam_subject" if subject_score[:spam] > 0.5
    signals << "spam_body" if body_score[:spam] > 0.5
    signals << "transactional_subject" if subject_score[:transactional] > 0.5

    signals
  end

  # Helper methods for returning classification results
  def marketing_classification(signal)
    {
      email_type: "marketing",
      confidence: 0.95,
      signals: [ signal ],
      classified_at: Time.current,
      method: "heuristic"
    }
  end

  def spam_classification(signal)
    {
      email_type: "spam",
      confidence: 0.9,
      signals: [ signal ],
      classified_at: Time.current,
      method: "heuristic"
    }
  end

  def transactional_classification(signal)
    {
      email_type: "transactional",
      confidence: 0.85,
      signals: [ signal ],
      classified_at: Time.current,
      method: "heuristic"
    }
  end
end
