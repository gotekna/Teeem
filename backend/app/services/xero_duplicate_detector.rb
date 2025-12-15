# frozen_string_literal: true

require "fuzzy_match"
require "digest"

# XeroDuplicateDetector service for detecting duplicate Xero contacts
# Detects duplicates based on:
# 1. Exact ABN match (100% confidence)
# 2. Fuzzy display name match for companies/trusts (85-100% confidence)
# 3. ATO/ASIC references (70-85% confidence)
class XeroDuplicateDetector
  CONFIDENCE_ABN_MATCH = 100
  CONFIDENCE_NAME_THRESHOLD = 85
  CONFIDENCE_ATO_ASIC = 75

  ATO_ASIC_PATTERNS = [
    /\b(ATO|Australian Tax(?:ation)? Office)\b/i,
    /\b(ASIC|Australian Securities (?:and )?Investments Commission)\b/i,
    /\bTax Office\b/i,
    /\bAustralian Securities\b/i
  ].freeze

  def initialize
    @groups_created = 0
    @groups_updated = 0
    @skipped = 0
  end

  # Main detection method
  # Returns summary hash with counts
  def detect_duplicates
    Rails.logger.info "[XeroDuplicateDetector] Starting duplicate detection..."

    # Fetch active contacts with Xero links
    contacts = fetch_xero_contacts

    # Detect duplicates by ABN
    abn_groups = group_by_abn(contacts)

    # Detect duplicates by display name
    name_groups = group_by_display_name(contacts)

    # Detect duplicates by ATO/ASIC references
    ato_asic_groups = group_by_ato_asic(contacts)

    # Create duplicate group records
    create_duplicate_groups(abn_groups, "abn")
    create_duplicate_groups(name_groups, "display_name")
    create_duplicate_groups(ato_asic_groups, "ato_asic")

    summary = {
      total_groups: XeroDuplicateGroup.count,
      pending: XeroDuplicateGroup.pending.count,
      high_confidence: XeroDuplicateGroup.high_confidence.count,
      medium_confidence: XeroDuplicateGroup.medium_confidence.count,
      low_confidence: XeroDuplicateGroup.low_confidence.count,
      groups_created: @groups_created,
      groups_updated: @groups_updated,
      skipped: @skipped
    }

    Rails.logger.info "[XeroDuplicateDetector] Detection complete: #{summary}"
    summary
  end

  private

  def fetch_xero_contacts
    # Get all contacts that have Xero external links and are not archived
    Contact
      .joins(:contact_external_links)
      .where(contact_external_links: { source: "xero", sync_enabled: true })
      .where.not(xero_contact_status: "ARCHIVED")
      .where(deleted_at: nil)
      .distinct
      .includes(:contact_external_links)
  end

  def group_by_abn(contacts)
    # Group contacts by exact ABN/ACN match
    groups = {}

    contacts.each do |contact|
      next if contact.tax_number.blank?

      # Normalize ABN (remove spaces and non-digits)
      abn = contact.tax_number.to_s.gsub(/\D/, "")
      next if abn.blank?

      groups[abn] ||= []
      groups[abn] << contact
    end

    # Filter to groups with 2+ contacts
    groups.select { |_abn, group_contacts| group_contacts.size >= 2 }
  end

  def group_by_display_name(contacts)
    # Filter to companies and trusts only
    eligible_contacts = contacts.select do |c|
      %w[company trust].include?(c.contact_type&.downcase)
    end

    groups = {}
    fuzzy_matcher = FuzzyMatch.new(eligible_contacts, read: :display_name)
    processed = Set.new

    eligible_contacts.each do |contact|
      next if processed.include?(contact.id)
      next if contact.display_name.blank?

      # Find similar contacts
      similar = eligible_contacts.select do |other|
        next false if contact.id == other.id
        next false if processed.include?(other.id)
        next false if other.display_name.blank?

        # Calculate similarity
        similarity = calculate_name_similarity(contact.display_name, other.display_name)
        similarity >= CONFIDENCE_NAME_THRESHOLD
      end

      if similar.any?
        group_key = [contact.id, *similar.map(&:id)].sort.join("-")
        groups[group_key] = {
          contacts: [contact, *similar],
          confidence: similar.map { |s| calculate_name_similarity(contact.display_name, s.display_name) }.max
        }

        # Mark all as processed
        processed.add(contact.id)
        similar.each { |s| processed.add(s.id) }
      end
    end

    groups
  end

  def group_by_ato_asic(contacts)
    groups = {}

    # Find contacts with ATO or ASIC in display name
    ato_asic_contacts = contacts.select do |contact|
      has_ato_asic_reference?(contact.display_name) || has_ato_asic_reference?(contact.notes)
    end

    # Group by ABN if available, otherwise by normalized name
    ato_asic_contacts.each do |contact|
      group_key = if contact.tax_number.present?
        "abn_#{contact.tax_number.gsub(/\D/, '')}"
      else
        "name_#{normalize_name(contact.display_name)}"
      end

      groups[group_key] ||= []
      groups[group_key] << contact
    end

    # Filter to groups with 2+ contacts
    groups.select { |_key, group_contacts| group_contacts.size >= 2 }
  end

  def create_duplicate_groups(groups, match_type)
    groups.each do |key, data|
      # Handle different data structures
      group_contacts = data.is_a?(Hash) ? data[:contacts] : data
      confidence = data.is_a?(Hash) ? data[:confidence] : (match_type == "abn" ? CONFIDENCE_ABN_MATCH : CONFIDENCE_ATO_ASIC)

      # Generate unique group key
      contact_ids = group_contacts.map(&:id).sort
      group_key = Digest::SHA256.hexdigest("#{match_type}:#{contact_ids.join(',')}")

      # Check if group already exists
      existing_group = XeroDuplicateGroup.find_by(group_key: group_key)

      if existing_group
        # Skip if already processed
        if existing_group.status != "pending"
          @skipped += 1
          next
        end

        # Update existing group
        existing_group.update!(
          confidence_score: confidence,
          updated_at: Time.current
        )
        @groups_updated += 1
      else
        # Create new group
        group = XeroDuplicateGroup.create!(
          group_key: group_key,
          match_type: match_type,
          confidence_score: confidence,
          status: "pending"
        )

        # Create items
        group_contacts.each_with_index do |contact, index|
          XeroDuplicateItem.create!(
            duplicate_group: group,
            contact: contact,
            is_merge_target: index == 0 # First contact is default target
          )
        end

        @groups_created += 1
      end
    rescue StandardError => e
      Rails.logger.error "[XeroDuplicateDetector] Error creating group: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      @skipped += 1
    end
  end

  def calculate_name_similarity(name1, name2)
    return 0 if name1.blank? || name2.blank?

    # Normalize names
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)

    return 100 if n1 == n2

    # Use Levenshtein distance ratio
    distance = levenshtein_distance(n1, n2)
    max_length = [n1.length, n2.length].max

    ((1 - (distance.to_f / max_length)) * 100).round(2)
  end

  def normalize_name(name)
    return "" if name.blank?

    name.to_s
        .downcase
        .gsub(/\bpty\s*ltd\b/, "")
        .gsub(/\bltd\b/, "")
        .gsub(/\binc\b/, "")
        .gsub(/\bllc\b/, "")
        .gsub(/\btrust\b/, "")
        .gsub(/[^a-z0-9\s]/, "")
        .gsub(/\s+/, " ")
        .strip
  end

  def has_ato_asic_reference?(text)
    return false if text.blank?

    ATO_ASIC_PATTERNS.any? { |pattern| text.match?(pattern) }
  end

  def levenshtein_distance(s1, s2)
    # Implementation of Levenshtein distance algorithm
    return s2.length if s1.empty?
    return s1.length if s2.empty?

    matrix = Array.new(s1.length + 1) { Array.new(s2.length + 1) }

    (0..s1.length).each { |i| matrix[i][0] = i }
    (0..s2.length).each { |j| matrix[0][j] = j }

    (1..s1.length).each do |i|
      (1..s2.length).each do |j|
        cost = s1[i - 1] == s2[j - 1] ? 0 : 1
        matrix[i][j] = [
          matrix[i - 1][j] + 1,      # deletion
          matrix[i][j - 1] + 1,      # insertion
          matrix[i - 1][j - 1] + cost # substitution
        ].min
      end
    end

    matrix[s1.length][s2.length]
  end
end
