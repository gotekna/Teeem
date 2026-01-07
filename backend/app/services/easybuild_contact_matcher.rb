# frozen_string_literal: true

require "csv"
require "fuzzy_match"

# Service to import EasyBuild contacts and match them to existing TEEEM contacts
# Matching priority:
# 1. xero_id (exact match)
# 2. email (case-insensitive)
# 3. tax_number/ABN
# 4. mobile_phone (normalized)
# 5. display_name (fuzzy match >85%)
class EasybuildContactMatcher
  SIMILARITY_THRESHOLD = 0.85

  attr_reader :stats, :results

  def initialize(csv_path = nil)
    @csv_path = csv_path || Rails.root.join("easybuildapp development Contacts.csv")
    @stats = {
      total: 0,
      matched_by_xero_id: 0,
      matched_by_email: 0,
      matched_by_tax_number: 0,
      matched_by_phone: 0,
      matched_by_name: 0,
      created: 0,
      skipped: 0,
      errors: []
    }
    @results = []
  end

  def import_and_match(dry_run: true)
    Rails.logger.info("Starting EasyBuild contact import (dry_run: #{dry_run})")

    # Load all existing contacts for matching
    @teeem_contacts = Contact.all.to_a
    build_lookup_indexes

    # Parse CSV
    csv_data = CSV.read(@csv_path, headers: true)
    @stats[:total] = csv_data.length

    csv_data.each do |row|
      process_row(row, dry_run: dry_run)
    rescue StandardError => e
      error_msg = "Error processing row #{row['id']}: #{e.message}"
      Rails.logger.error(error_msg)
      @stats[:errors] << error_msg
    end

    Rails.logger.info("EasyBuild import completed: #{@stats.inspect}")

    {
      success: true,
      stats: @stats,
      results: @results
    }
  end

  private

  def build_lookup_indexes
    @by_xero_id = @teeem_contacts.select { |c| c.xero_id.present? }
                                   .index_by(&:xero_id)
    @by_email = @teeem_contacts.select { |c| c.email.present? }
                                 .index_by { |c| c.email.downcase.strip }
    @by_tax_number = @teeem_contacts.select { |c| c.tax_number.present? }
                                      .group_by { |c| normalize_tax_number(c.tax_number) }
    @by_phone = @teeem_contacts.select { |c| c.mobile_phone.present? }
                                 .index_by { |c| normalize_phone(c.mobile_phone) }
  end

  def process_row(row, dry_run:)
    easybuild_id = row["id"]
    xero_id = row["xero_id"].presence
    email = row["email"].presence
    tax_number = row["tax_number"].presence
    mobile_phone = row["mobile_phone"].presence
    display_name = row["display_name"].presence
    first_name = row["first_name"].presence
    last_name = row["last_name"].presence

    # Skip if deleted
    if row["deleted"].to_s.downcase == "true"
      @stats[:skipped] += 1
      return
    end

    # Try to find a match
    match_result = find_match(
      xero_id: xero_id,
      email: email,
      tax_number: tax_number,
      mobile_phone: mobile_phone,
      display_name: display_name
    )

    if match_result[:contact]
      # Found a match - update with easybuild_id
      result = {
        easybuild_id: easybuild_id,
        easybuild_name: display_name,
        match_type: match_result[:match_type],
        teeem_id: match_result[:contact].id,
        teeem_name: match_result[:contact].display_name,
        action: "matched"
      }

      unless dry_run
        match_result[:contact].update!(easybuild_id: easybuild_id) if match_result[:contact].respond_to?(:easybuild_id=)
      end

      @stats["matched_by_#{match_result[:match_type]}".to_sym] += 1
    else
      # No match - create new contact or skip
      result = {
        easybuild_id: easybuild_id,
        easybuild_name: display_name,
        easybuild_email: email,
        easybuild_phone: mobile_phone,
        match_type: "none",
        teeem_id: nil,
        teeem_name: nil,
        action: dry_run ? "would_create" : "created"
      }

      unless dry_run
        # SSoT: Check for existing contact by email/xero_id before creating
        # (catches contacts created after initial index was built)
        existing = nil
        if email.present?
          existing = Contact.find_by("LOWER(email) = ?", email.downcase.strip)
        end
        existing ||= Contact.find_by(xero_id: xero_id) if xero_id.present?

        if existing
          # Found existing - use it instead of creating duplicate
          new_contact = existing
          result[:match_type] = "late_match"
          result[:action] = "matched"
          @stats[:created] -= 1  # Will be incremented below, so pre-decrement
          @stats[:matched_by_late_match] ||= 0
          @stats[:matched_by_late_match] += 1
        else
          new_contact = Contact.create!(
            display_name: display_name,
            first_name: first_name,
            last_name: last_name,
            email: email,
            mobile_phone: mobile_phone,
            tax_number: tax_number,
            xero_id: xero_id,
            contact_types: [ "supplier" ]
          )
        end
        result[:teeem_id] = new_contact.id
        result[:teeem_name] = new_contact.display_name
      end

      @stats[:created] += 1
    end

    @results << result
  end

  def find_match(xero_id:, email:, tax_number:, mobile_phone:, display_name:)
    # Priority 1: Match by xero_id
    if xero_id.present? && @by_xero_id[xero_id]
      return { contact: @by_xero_id[xero_id], match_type: "xero_id" }
    end

    # Priority 2: Match by email
    if email.present?
      normalized_email = email.downcase.strip
      if @by_email[normalized_email]
        return { contact: @by_email[normalized_email], match_type: "email" }
      end
    end

    # Priority 3: Match by tax_number
    if tax_number.present?
      normalized_tax = normalize_tax_number(tax_number)
      matches = @by_tax_number[normalized_tax]
      if matches&.any?
        return { contact: matches.first, match_type: "tax_number" }
      end
    end

    # Priority 4: Match by phone
    if mobile_phone.present?
      normalized_phone = normalize_phone(mobile_phone)
      if @by_phone[normalized_phone]
        return { contact: @by_phone[normalized_phone], match_type: "phone" }
      end
    end

    # Priority 5: Match by fuzzy name
    if display_name.present?
      match = fuzzy_match_by_name(display_name)
      if match
        return { contact: match, match_type: "name" }
      end
    end

    { contact: nil, match_type: nil }
  end

  def fuzzy_match_by_name(name)
    return nil if @teeem_contacts.empty?

    contact_names = @teeem_contacts.map { |c| [ c.display_name, c ] }.to_h
    matcher = FuzzyMatch.new(contact_names.keys)

    matched_name = matcher.find(name, threshold: SIMILARITY_THRESHOLD)
    matched_name ? contact_names[matched_name] : nil
  end

  def normalize_tax_number(tax_number)
    return nil if tax_number.blank?
    tax_number.to_s.gsub(/[\s\-]/, "").upcase
  end

  def normalize_phone(phone)
    return nil if phone.blank?
    # Remove all non-digits, then take last 9 digits (Australian mobile)
    digits = phone.to_s.gsub(/\D/, "")
    digits.length >= 9 ? digits[-9..] : digits
  end
end
