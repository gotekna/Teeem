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
          tax_number: contact.tax_number,
          mobile_phone: contact.mobile_phone,
          office_phone: contact.office_phone,
          created_at: contact.created_at,
          score: score_contact(contact),
          xero_tenants: contact.xero_links.map { |link|
            { tenant_id: link.tenant_id, tenant_name: link.tenant_name }
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
    score += 10 if contact.tax_number.present?
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
  def merge_group(group_id, target_contact_id)
    target = Contact.find(target_contact_id)

    # Find all contacts in this group by matching against target's normalized name
    # This ensures we use the same normalization as find_duplicate_groups
    # Don't try to reverse parameterize - special chars like & get lost
    contacts = Contact.where(is_active: true)
                     .where("LOWER(TRIM(REGEXP_REPLACE(display_name, '\\s+', ' ', 'g'))) = LOWER(TRIM(REGEXP_REPLACE(?, '\\s+', ' ', 'g')))", target.display_name)
                     .where.not(id: target_contact_id)

    deleted_ids = []
    merged_count = 0

    ActiveRecord::Base.transaction do
      contacts.each do |source|
        # 1. Move Xero links to target
        merge_xero_links(target, [ source ])

        # 2. Transfer relationships
        transfer_relationships(target, source)

        # 3. Merge contact data (fill missing fields on target)
        merge_contact_data(target, source)

        # 4. Reload source to clear association caches (critical for destroy!)
        #    After update_all transfers, Rails cache still shows old associations
        #    This prevents dependent: :restrict_with_error from false-triggering
        source.reload

        # 5. Hard-delete source contact
        deleted_ids << source.id
        source.destroy!

        merged_count += 1
      end

      target.save!
    end

    {
      success: true,
      merged_count: merged_count,
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

  private

  # Move external_links from sources to target
  def merge_xero_links(target, sources)
    sources.each do |source|
      ContactExternalLink.where(contact_id: source.id).each do |link|
        # Check if target already has this tenant
        existing = ContactExternalLink.find_by(
          contact_id: target.id,
          tenant_id: link.tenant_id,
          source: link.source
        )

        if existing
          # Target already linked to this tenant - destroy duplicate link
          Rails.logger.info("Skipping link #{link.id} - target already linked to #{link.tenant_id}")
          link.destroy
        else
          # Move link to target
          link.update!(contact_id: target.id)
          Rails.logger.info("Moved link #{link.id} (#{link.tenant_name}) to contact #{target.id}")
        end
      end
    end
  end

  # Transfer relationships from source to target
  def transfer_relationships(target, source)
    # Transfer job contacts
    source.job_contacts.each do |jc|
      existing = target.job_contacts.find_by(job_id: jc.job_id)
      if existing
        jc.destroy
      else
        jc.update!(contact_id: target.id)
      end
    end

    # Transfer case contacts
    source.case_contacts.each do |cc|
      existing = target.case_contacts.find_by(case_id: cc.case_id)
      if existing
        cc.destroy
      else
        cc.update!(contact_id: target.id)
      end
    end

    # Transfer purchase orders
    # Use update_all to avoid association cache issues that prevent destroy
    source.purchase_orders.update_all(supplier_id: target.id)

    # Transfer pricebook items
    source.pricebook_items.each do |item|
      existing = target.pricebook_items.find_by(
        material_id: item.material_id,
        unit: item.unit
      )
      if existing
        # Keep newer price
        if item.updated_at > existing.updated_at
          existing.update!(
            price: item.price,
            updated_at: item.updated_at
          )
        end
        item.destroy
      else
        item.update!(supplier_id: target.id)
      end
    end

    # Transfer contact relationships
    source.outgoing_relationships.each do |rel|
      existing = target.outgoing_relationships.find_by(
        related_contact_id: rel.related_contact_id,
        relationship_type: rel.relationship_type
      )
      if existing
        rel.destroy
      else
        rel.update!(source_contact_id: target.id)
      end
    end

    # Update incoming relationships pointing to source
    ContactRelationship.where(related_contact_id: source.id).each do |rel|
      existing = ContactRelationship.find_by(
        source_contact_id: rel.source_contact_id,
        related_contact_id: target.id,
        relationship_type: rel.relationship_type
      )
      if existing
        rel.destroy
      else
        rel.update!(related_contact_id: target.id)
      end
    end
  end

  # Merge contact data from source to target (fill missing fields)
  def merge_contact_data(target, source)
    # Fill missing email
    target.email = source.email if target.email.blank? && source.email.present?

    # Fill missing phone numbers
    target.mobile_phone = source.mobile_phone if target.mobile_phone.blank? && source.mobile_phone.present?
    target.office_phone = source.office_phone if target.office_phone.blank? && source.office_phone.present?

    # Fill missing tax number (ABN)
    target.tax_number = source.tax_number if target.tax_number.blank? && source.tax_number.present?

    # Fill missing website
    target.website = source.website if target.website.blank? && source.website.present?

    # Fill missing address from contact_addresses (SSoT)
    if target.contact_addresses.empty? && source.contact_addresses.any?
      source.contact_addresses.each do |addr|
        target.contact_addresses.build(
          address_type: addr.address_type,
          line1: addr.line1,
          line2: addr.line2,
          line3: addr.line3,
          line4: addr.line4,
          city: addr.city,
          region: addr.region,
          postal_code: addr.postal_code,
          country: addr.country,
          is_primary: addr.is_primary
        )
      end
    end

    # Merge roles (union)
    # Handle roles stored as JSON strings (e.g., "[]" or "[\"role1\"]")
    source_roles = parse_roles(source.roles)
    target_roles = parse_roles(target.roles)
    if source_roles.any?
      target.roles = (target_roles + source_roles).uniq
    end

    # Don't save here - let merge_group handle it
  end

  # Parse roles that might be stored as JSON string or array
  def parse_roles(roles)
    return [] if roles.blank?
    return roles if roles.is_a?(Array)
    return JSON.parse(roles) if roles.is_a?(String) && roles.start_with?('[')
    []
  rescue JSON::ParserError
    []
  end
end
