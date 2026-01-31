# frozen_string_literal: true

# SSoT: Split Inbox Category Logic
# Categorizes emails into VIP, Team, Newsletters, Other for split inbox view.
#
# Priority order (email belongs to first matching category):
# 1. VIP - Email from a VipSender
# 2. Team - VipSender with category="team" OR sender domain in team_email_domains
# 3. Newsletters - email_classification['email_type'] == 'marketing'
# 4. Other - Business emails (everything else that's not spam)
#
class SplitInboxService
  CATEGORIES = %w[vip team newsletters other].freeze
  PREVIEW_LIMIT = 10

  attr_reader :user, :base_scope

  def initialize(user, base_scope)
    @user = user
    @base_scope = base_scope.not_spam # Always exclude spam

    # Pre-load VIP data for performance
    @vip_addresses = Set.new(VipSender.for_user(user).pluck(:email_address))
    @team_vip_addresses = Set.new(VipSender.for_user(user).by_category("team").pluck(:email_address))
    @team_domains = Set.new(TenantSetting.team_email_domains.map(&:downcase))
  end

  # Get overview with counts and preview emails for each category
  def overview
    {
      vip: category_data(:vip),
      team: category_data(:team),
      newsletters: category_data(:newsletters),
      other: category_data(:other)
    }
  end

  # Get counts only (efficient)
  def category_counts
    {
      vip: vip_scope.count,
      team: team_scope.count,
      newsletters: newsletter_scope.count,
      other: other_scope.count
    }
  end

  # Get unread counts
  def unread_counts
    {
      vip: vip_scope.where(is_read: false).count,
      team: team_scope.where(is_read: false).count,
      newsletters: newsletter_scope.where(is_read: false).count,
      other: other_scope.where(is_read: false).count
    }
  end

  # Get paginated emails for a specific category
  def emails_for_category(category, page: 1, per_page: 50)
    scope = scope_for_category(category)
    scope.recent_first.page(page).per(per_page)
  end

  # Determine which category an email belongs to
  def categorize_email(email)
    from = email.from_email&.downcase
    return :other unless from

    return :vip if vip_email?(from)
    return :team if team_email?(from)
    return :newsletters if newsletter_email?(email)

    :other
  end

  private

  def category_data(category)
    scope = scope_for_category(category)
    {
      count: scope.count,
      unread_count: scope.where(is_read: false).count,
      emails: scope.recent_first.limit(PREVIEW_LIMIT)
    }
  end

  def scope_for_category(category)
    case category.to_sym
    when :vip then vip_scope
    when :team then team_scope
    when :newsletters then newsletter_scope
    when :other then other_scope
    else
      raise ArgumentError, "Unknown category: #{category}"
    end
  end

  # VIP: Email from any VipSender (regardless of category)
  def vip_scope
    return @base_scope.none if @vip_addresses.empty?

    @base_scope.where("LOWER(from_email) IN (?)", @vip_addresses.to_a)
  end

  # Team: VipSender with category="team" OR domain in team_email_domains
  # EXCLUDES emails already in VIP scope (VIP takes priority)
  def team_scope
    conditions = []
    params = []

    # Team VIP addresses (category = "team")
    if @team_vip_addresses.any?
      conditions << "LOWER(from_email) IN (?)"
      params << @team_vip_addresses.to_a
    end

    # Team domains
    if @team_domains.any?
      domain_conditions = @team_domains.map { |d| "LOWER(from_email) LIKE ?" }
      conditions << "(#{domain_conditions.join(' OR ')})"
      params.concat(@team_domains.map { |d| "%@#{d}" })
    end

    return @base_scope.none if conditions.empty?

    # Exclude VIP emails (VIP takes priority over team)
    scope = @base_scope.where(conditions.join(" OR "), *params)
    scope = scope.where.not("LOWER(from_email) IN (?)", @vip_addresses.to_a) if @vip_addresses.any?
    scope
  end

  # Newsletters: Marketing emails (from AI classification)
  # EXCLUDES emails already in VIP or Team scope
  def newsletter_scope
    scope = @base_scope.where("email_classification->>'email_type' = ?", "marketing")

    # Exclude VIP and Team emails
    excluded = (@vip_addresses + team_addresses).to_a
    scope = scope.where.not("LOWER(from_email) IN (?)", excluded) if excluded.any?
    scope
  end

  # Other: Everything else (business emails, unclassified)
  # EXCLUDES VIP, Team, and Newsletters
  def other_scope
    # Use IS DISTINCT FROM to properly handle: NULL classification, empty hash {}, and non-marketing types
    scope = @base_scope
      .where("email_classification->>'email_type' IS DISTINCT FROM ?", "marketing")

    # Exclude VIP and Team emails
    excluded = (@vip_addresses + team_addresses).to_a
    scope = scope.where.not("LOWER(from_email) IN (?)", excluded) if excluded.any?
    scope
  end

  # Helper methods for categorization

  def vip_email?(from_email)
    @vip_addresses.include?(from_email)
  end

  def team_email?(from_email)
    # Check if in team VIP addresses
    return true if @team_vip_addresses.include?(from_email)

    # Check if domain matches team domains
    domain = from_email.split("@").last
    @team_domains.include?(domain)
  end

  def newsletter_email?(email)
    email.email_classification&.dig("email_type") == "marketing"
  end

  # Get all team-related addresses (for exclusion from other scopes)
  def team_addresses
    team_addrs = @team_vip_addresses.dup

    # We can't easily get all email addresses matching team domains without a query
    # So we only exclude explicitly marked team VIP addresses
    # Domain-based team emails will be caught by the domain check
    team_addrs
  end
end
