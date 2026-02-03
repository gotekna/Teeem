# frozen_string_literal: true

# ContactMatcher: O(1) contact matching for ultra-scale Xero sync
#
# Part of the Ultra-Scale Xero Sync Architecture (Feb 2026)
#
# Problem: Old sync used O(n²) matching with .find in loops
#   20K Xero contacts × 20K TEEEM contacts = 400M comparisons
#
# Solution: Build hash indices ONCE, then O(1) lookups
#   20K contacts = 20K index operations + 20K lookups = O(n)
#
# Match Priority:
#   1. Existing link (contact_external_links) - O(1)
#   2. ABN match - O(1)
#   3. Email match (from contact_emails table) - O(1)
#   4. Fuzzy name (PostgreSQL trigram, DB-indexed) - O(log n)
#
# Usage:
#   matcher = ContactMatcher.new(teeem_tenant_id)
#   result = matcher.find_match(xero_contact_hash)
#   # => { found: true, contact: Contact, match_type: :abn, needs_review: false }
#
class ContactMatcher
  SIMILARITY_THRESHOLD = 0.85
  HIGH_CONFIDENCE_THRESHOLD = 0.95

  attr_reader :teeem_tenant_id, :xero_org_id, :stats

  def initialize(teeem_tenant_id, xero_org_id: nil)
    @teeem_tenant_id = teeem_tenant_id
    @xero_org_id = xero_org_id
    @stats = { linked: 0, abn: 0, email: 0, fuzzy: 0, not_found: 0 }
    build_indices
  end

  # Build hash indices for O(1) lookups
  # Called once per batch - amortized O(1) per contact
  def build_indices
    scope = Contact.where(tenant_id: @teeem_tenant_id, is_active: true)

    # Index by existing Xero link (external_contact_id -> contact_id)
    @by_external_id = if @xero_org_id
      ContactExternalLink.xero
        .for_xero_org(@xero_org_id)
        .includes(:contact)
        .where(contacts: { tenant_id: @teeem_tenant_id, is_active: true })
        .index_by(&:external_contact_id)
    else
      {}
    end

    # Index by normalized ABN (spaces/dashes removed)
    @by_abn = scope.where.not(abn: [nil, ''])
                   .pluck(:id, :abn)
                   .each_with_object({}) do |(id, abn), hash|
      normalized = normalize_abn(abn)
      hash[normalized] = id if normalized.present?
    end

    # Index by lowercase email (from contact_emails table - SSoT)
    @by_email = ContactEmail.joins(:contact)
                            .where(contacts: { tenant_id: @teeem_tenant_id, is_active: true })
                            .pluck('LOWER(contact_emails.email)', :contact_id)
                            .to_h

    Rails.logger.info("[ContactMatcher] Built indices: #{@by_external_id.size} links, #{@by_abn.size} ABNs, #{@by_email.size} emails")
  end

  # Find matching TEEEM contact for a Xero contact
  # @param xero_contact [Hash] Xero contact data
  # @return [Hash] { found: bool, contact: Contact|nil, match_type: Symbol, needs_review: bool }
  def find_match(xero_contact)
    xero_id = xero_contact['ContactID']

    # Priority 1: Existing link (O(1))
    if link = @by_external_id[xero_id]
      @stats[:linked] += 1
      return {
        found: true,
        contact: link.contact,
        match_type: :linked,
        link: link,
        needs_review: false,
        match_confidence: 1.0
      }
    end

    # Priority 2: ABN match (O(1))
    if abn = normalize_abn(xero_contact['TaxNumber'])
      if contact_id = @by_abn[abn]
        @stats[:abn] += 1
        return {
          found: true,
          contact_id: contact_id,
          match_type: :abn,
          needs_review: false,
          match_confidence: 1.0
        }
      end
    end

    # Priority 3: Email match (O(1))
    if email = extract_email(xero_contact)&.downcase&.strip
      if email.present? && (contact_id = @by_email[email])
        @stats[:email] += 1
        return {
          found: true,
          contact_id: contact_id,
          match_type: :email,
          needs_review: false,
          match_confidence: 1.0
        }
      end
    end

    # Priority 4: Fuzzy name match (PostgreSQL trigram - indexed O(log n))
    if name = xero_contact['Name']&.strip
      if name.present? && name.length >= 3
        match = fuzzy_name_match(name)
        if match
          @stats[:fuzzy] += 1
          return {
            found: true,
            contact_id: match[:contact_id],
            match_type: :fuzzy,
            needs_review: match[:score] < HIGH_CONFIDENCE_THRESHOLD,
            match_confidence: match[:score]
          }
        end
      end
    end

    @stats[:not_found] += 1
    { found: false }
  end

  # Batch match: process multiple contacts, return results
  def batch_match(xero_contacts)
    xero_contacts.map do |xc|
      {
        xero_contact: xc,
        match: find_match(xc)
      }
    end
  end

  # Summary stats for logging
  def match_stats
    total = @stats.values.sum
    {
      total: total,
      found: total - @stats[:not_found],
      not_found: @stats[:not_found],
      by_type: @stats.except(:not_found)
    }
  end

  private

  def normalize_abn(abn)
    return nil if abn.blank?
    abn.to_s.gsub(/[\s\-]/, '').upcase.presence
  end

  def extract_email(xero_contact)
    # Primary email location
    return xero_contact['EmailAddress'] if xero_contact['EmailAddress'].present?

    # Fallback: check addresses
    xero_contact['Addresses']&.each do |addr|
      return addr['EmailAddress'] if addr['EmailAddress'].present?
    end

    nil
  end

  # PostgreSQL trigram similarity search
  # Uses pg_trgm extension for indexed fuzzy matching
  def fuzzy_name_match(xero_name)
    return nil if xero_name.blank?

    # Use pg_trgm similarity() function for DB-side fuzzy matching
    # This is indexed if pg_trgm extension is installed with appropriate index
    result = Contact.where(tenant_id: @teeem_tenant_id, is_active: true)
                    .where("entity_type IN (?) OR entity_type IS NULL OR display_name ~* ?",
                           %w[company trust sole_trader],
                           '(pty|ltd|limited|inc|corp|trust|trading|holdings|group|services|solutions|industries|enterprises)\\b')
                    .where("similarity(display_name, ?) > ?", xero_name, SIMILARITY_THRESHOLD)
                    .order(Arel.sql("similarity(display_name, #{Contact.connection.quote(xero_name)}) DESC"))
                    .limit(1)
                    .pluck(:id, Arel.sql("similarity(display_name, #{Contact.connection.quote(xero_name)})"))
                    .first

    return nil unless result

    contact_id, score = result
    { contact_id: contact_id, score: score.to_f }
  rescue ActiveRecord::StatementInvalid => e
    # pg_trgm extension might not be installed - fall back to no fuzzy matching
    Rails.logger.warn("[ContactMatcher] Fuzzy matching unavailable: #{e.message}")
    nil
  end
end
