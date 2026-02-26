# Service to find and merge duplicate contacts created from Xero multi-tenant sync
# One real-world contact (e.g., "Tekna Admin Pty Ltd") may exist in multiple Xero organizations
# This creates duplicate TEEEM contacts. This service consolidates them into ONE SSoT contact.
class XeroDuplicateFixService
  # Find all duplicate contact groups
  # Returns array of groups with contacts, scores, and recommended SSoT
  def find_duplicate_groups
    groups = []

    # Only check contacts that have Xero links (duplicates from Xero sync)
    # This dramatically reduces the search space
    xero_contact_ids = ContactExternalLink.where(source: "xero").distinct.pluck(:contact_id)

    # Find contacts with duplicate display names (normalized)
    # Exclude contacts with " - " pattern (e.g., "Accounts Team - Survey Mark Pty Ltd")
    # These are intentionally separate team/department contacts for different companies
    duplicate_names = Contact.where(is_active: true)
                             .where(id: xero_contact_ids)
                             .where("display_name NOT LIKE '% - %'")  # Exclude "Team - Company" pattern
                             .select("LOWER(TRIM(REGEXP_REPLACE(display_name, '\\s+', ' ', 'g'))) as normalized_name, COUNT(*) as count")
                             .group("LOWER(TRIM(REGEXP_REPLACE(display_name, '\\s+', ' ', 'g')))")
                             .having("COUNT(*) > 1")
                             .where.not(display_name: [ nil, "" ])

    duplicate_names.each do |dup|
      normalized = dup.normalized_name

      # Get all contacts with this normalized name
      # Also exclude "Team - Company" pattern contacts
      contacts = Contact.where(is_active: true)
                       .where("LOWER(TRIM(REGEXP_REPLACE(display_name, '\\s+', ' ', 'g'))) = ?", normalized)
                       .where("display_name NOT LIKE '% - %'")
                       .includes(:xero_links, :jobs, :purchase_orders, :case_contacts)

      next if contacts.count < 2

      # Score each contact
      scored_contacts = contacts.map do |contact|
        {
          id: contact.id,
          display_name: contact.display_name,
          email: contact.email,
          tax_number: contact.abn,
          mobile_phone: contact.mobile_phone,
          office_phone: contact.office_phone,
          created_at: contact.created_at,
          score: score_contact(contact),
          # FRC (Feb 2026): Renamed tenant_id to xero_org_id for consistency
          xero_tenants: contact.xero_links.map { |link|
            { xero_org_id: link.xero_org_id, tenant_name: link.tenant_name }
          },
          relationships: {
            jobs: contact.jobs.size,
            purchase_orders: contact.purchase_orders.size,
            cases: contact.case_contacts.size
          }
        }
      end

      # Sort by score (highest first)
      scored_contacts.sort_by! { |c| -c[:score] }

      # Recommended SSoT is the highest scored contact
      recommended_ssot_id = scored_contacts.first[:id]

      groups << {
        id: normalized.parameterize,
        normalized_name: normalized,
        contacts: scored_contacts,
        recommended_ssot_id: recommended_ssot_id,
        total_xero_tenants: scored_contacts.sum { |c| c[:xero_tenants].count },
        can_auto_merge: true
      }
    end

    groups
  end

  # Calculate quality score for a contact
  # Higher score = better candidate for SSoT
  def score_contact(contact)
    score = 0

    # Older contacts are more likely to be the original (created first)
    score += 20 if contact.created_at < 1.year.ago

    # Xero connection is valuable (use size > 0 to leverage preloaded association)
    score += 100 if contact.xero_links.size > 0

    # Contact info completeness
    score += 10 if contact.email.present?
    score += 10 if contact.abn.present?
    score += 5 if contact.mobile_phone.present?
    score += 5 if contact.office_phone.present?
    score += 3 if contact.website.present?

    # Relationships indicate this is the "main" contact (use size > 0 to leverage preloaded associations)
    score += 15 if contact.jobs.size > 0
    score += 10 if contact.purchase_orders.size > 0
    score += 5 if contact.case_contacts.size > 0

    score
  end

  # Execute merge for one duplicate group
  # @param group_id [String] Normalized name (parameterized)
  # @param target_contact_id [Integer] The SSoT contact to merge into
  # @return [Hash] Result with merged_count and deleted_ids
  #
  # FRC (Feb 2026): Previous manual merge only handled 5 FK types but contacts have 60+ DB FK
  # constraints (gl_invoices, bill_inboxes, meeting_participants, etc.). source.destroy! failed
  # with FK violation errors. Now delegates to GenericMergeService which handles ALL FKs via
  # Rails reflection + database schema queries.
  def merge_group(group_id, target_contact_id)
    target = Contact.find(target_contact_id)

    # Find all contacts in this group by matching against target's normalized name
    # This ensures we use the same normalization as find_duplicate_groups
    # Don't try to reverse parameterize - special chars like & get lost
    sources = Contact.where(is_active: true)
                     .where("LOWER(TRIM(REGEXP_REPLACE(display_name, '\\s+', ' ', 'g'))) = LOWER(TRIM(REGEXP_REPLACE(?, '\\s+', ' ', 'g')))", target.display_name)
                     .where.not(id: target_contact_id)
                     .to_a

    if sources.empty?
      return {
        success: true,
        merged_count: 0,
        deleted_ids: [],
        target_id: target.id
      }
    end

    deleted_ids = sources.map(&:id)

    # GenericMergeService handles ALL FK references:
    # - Rails associations (has_many/has_one with any dependent option)
    # - Database FK constraints (catches undeclared associations)
    # - Unique constraint conflicts (deletes duplicates)
    # - Fills blank fields from sources
    merger = GenericMergeService.new(target, sources, Contact)
    merger.merge!

    {
      success: true,
      merged_count: merger.merged_count,
      deleted_ids: deleted_ids,
      target_id: target.id
    }
  rescue => e
    Rails.logger.error("XeroDuplicateFixService#merge_group failed: #{e.message}")
    Rails.logger.error(e.backtrace.join("\n"))

    {
      success: false,
      error: e.message,
      merged_count: 0,
      deleted_ids: []
    }
  end

end
