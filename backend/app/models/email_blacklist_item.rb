class EmailBlacklistItem < ApplicationRecord
  # Pattern types: from_email, subject, domain, sender_name
  PATTERN_TYPES = %w[from_email subject domain sender_name].freeze

  validates :pattern, presence: true, uniqueness: { scope: :pattern_type }
  validates :pattern_type, presence: true, inclusion: { in: PATTERN_TYPES }

  scope :active, -> { where(active: true) }
  scope :by_type, ->(type) { where(pattern_type: type) }

  # Check if an email matches this blacklist item
  def matches?(email_data)
    return false unless active?

    case pattern_type
    when "from_email"
      email_data[:from_email]&.downcase&.include?(pattern.downcase)
    when "subject"
      email_data[:subject]&.downcase&.include?(pattern.downcase)
    when "domain"
      email_data[:from_email]&.downcase&.end_with?("@#{pattern.downcase}")
    when "sender_name"
      email_data[:from_name]&.downcase&.include?(pattern.downcase)
    else
      false
    end
  end

  # Increment match count when this pattern matches
  def record_match!
    increment!(:match_count)
  end

  # Class method to check if email should be filtered
  def self.should_filter?(from_email:, from_name:, subject:)
    email_data = {
      from_email: from_email,
      from_name: from_name,
      subject: subject
    }

    # Use Rails cache to avoid DB query on every email (cache for 5 minutes)
    blacklist_items = Rails.cache.fetch("email_blacklist_items_active", expires_in: 5.minutes) do
      active.to_a
    end

    matched_item = blacklist_items.find { |item| item.matches?(email_data) }

    if matched_item
      # Record match asynchronously (don't block sync)
      matched_item.record_match! rescue nil
      Rails.logger.debug "[EmailBlacklist] Matched pattern: #{matched_item.pattern} (#{matched_item.pattern_type})"
      true
    else
      false
    end
  end

  # Invalidate cache when blacklist is modified
  after_commit :clear_cache

  private

  def clear_cache
    Rails.cache.delete("email_blacklist_items_active")
  end
end
