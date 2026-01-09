# ContactAutoMergeService - Automatically merge duplicate contacts with matching names
#
# This service finds contacts with duplicate names (normalized) and merges them automatically.
# Priority is given to contacts with Xero connections, then those with the most data filled.
#
# Usage:
#   service = ContactAutoMergeService.new(dry_run: true)  # Preview mode
#   service = ContactAutoMergeService.new(dry_run: false) # Actually merge
#   result = service.run
#
class ContactAutoMergeService
  attr_reader :stats, :dry_run

  def initialize(dry_run: true)
    @dry_run = dry_run
    @stats = {
      groups_found: 0,
      contacts_merged: 0,
      contacts_deleted: 0,
      xero_connections_preserved: 0,
      errors: [],
      merged_groups: []
    }
  end

  def run
    Rails.logger.info "[ContactAutoMerge] Starting #{dry_run ? 'DRY RUN' : 'LIVE'} auto-merge at #{Time.current}"

    duplicate_groups = find_duplicate_groups
    @stats[:groups_found] = duplicate_groups.size

    Rails.logger.info "[ContactAutoMerge] Found #{duplicate_groups.size} duplicate groups"

    duplicate_groups.each do |group|
      process_duplicate_group(group)
    end

    Rails.logger.info "[ContactAutoMerge] Completed. Stats: #{@stats.except(:merged_groups, :errors).inspect}"
    Rails.logger.info "[ContactAutoMerge] Errors: #{@stats[:errors]}" if @stats[:errors].any?

    @stats
  end

  private

  def find_duplicate_groups
    contacts = Contact.where(deleted: [ false, nil ])
                     .select(:id, :display_name, :first_name, :last_name, :email, :mobile_phone, :office_phone, :xero_id, :xero_contact_status, :rating, :notes, :roles, :website, :address)

    groups = []
    seen_ids = Set.new

    # Group by normalized full name
    by_name = contacts.group_by { |c| normalize_name(c.display_name) }
    by_name.each do |normalized, group|
      next if normalized.blank? || group.size < 2
      next if group.all? { |c| seen_ids.include?(c.id) }

      # Mark all as seen
      group.each { |c| seen_ids << c.id }

      groups << {
        match_value: normalized,
        contacts: group.map(&:id)
      }
    end

    groups
  end

  def normalize_name(name)
    return nil if name.blank?
    name.to_s.downcase.gsub(/\s+/, " ").strip
  end

  def process_duplicate_group(group)
    contact_ids = group[:contacts]
    contacts = Contact.where(id: contact_ids).to_a

    return if contacts.size < 2

    # Score each contact to find the best one to keep
    scored = contacts.map { |c| { contact: c, score: score_contact(c) } }
    scored.sort_by! { |s| -s[:score] } # Highest score first

    target = scored.first[:contact]
    sources = scored[1..-1].map { |s| s[:contact] }

    Rails.logger.info "[ContactAutoMerge] Group '#{group[:match_value]}': keeping #{target.id} (#{target.display_name}, score=#{scored.first[:score]}), merging #{sources.map(&:id).join(', ')}"

    if target.xero_id.present?
      @stats[:xero_connections_preserved] += 1
    end

    if dry_run
      # Just record what would happen
      @stats[:contacts_merged] += sources.size
      @stats[:contacts_deleted] += sources.size
      @stats[:merged_groups] << {
        target_id: target.id,
        target_name: target.display_name,
        target_xero: target.xero_id.present?,
        source_ids: sources.map(&:id),
        source_names: sources.map(&:display_name)
      }
    else
      # Actually perform the merge
      merge_contacts(target, sources, group[:match_value])
    end
  rescue => e
    error_msg = "Error processing group '#{group[:match_value]}': #{e.message}"
    Rails.logger.error "[ContactAutoMerge] #{error_msg}"
    @stats[:errors] << error_msg
  end

  def score_contact(contact)
    score = 0

    # Xero connection is most important
    score += 100 if contact.xero_id.present?

    # Data completeness
    score += 10 if contact.email.present?
    score += 5 if contact.mobile_phone.present?
    score += 5 if contact.office_phone.present?
    score += 3 if contact.website.present?
    score += 3 if contact.contact_addresses.any?
    score += 2 if contact.notes.present?
    score += 2 if contact.rating.to_i > 0
    score += contact.roles.to_a.size * 2 # More roles = more data

    # Prefer active Xero contacts
    score += 20 if contact.xero_contact_status == "ACTIVE"

    score
  end

  def merge_contacts(target, sources, group_name)
    ActiveRecord::Base.transaction do
      sources.each do |source|
        # Merge roles
        merged_roles = (target.roles.to_a + source.roles.to_a).uniq
        target.update!(roles: merged_roles)

        # Fill in missing legacy contact information from source
        target.update!(email: source.email) if target.email.blank? && source.email.present?
        target.update!(mobile_phone: source.mobile_phone) if target.mobile_phone.blank? && source.mobile_phone.present?
        target.update!(office_phone: source.office_phone) if target.office_phone.blank? && source.office_phone.present?
        target.update!(website: source.website) if target.website.blank? && source.website.present?

        # Merge contact_emails (SSoT) - transfer unique emails, skip duplicates
        source.contact_emails.each do |src_email|
          next if target.contact_emails.exists?(email: src_email.email)
          next if target.email == src_email.email

          has_primary = target.contact_emails.exists?(is_primary: true)
          target.contact_emails.create!(
            email: src_email.email,
            is_primary: src_email.is_primary && !has_primary,
            label: src_email.label,
            position: target.contact_emails.count
          )
        end

        # Merge contact_phones (SSoT) - transfer unique phones, skip duplicates
        source.contact_phones.each do |src_phone|
          normalized = src_phone.phone_number.to_s.gsub(/\D/, '')
          existing_phones = target.contact_phones.pluck(:phone_number).map { |p| p.to_s.gsub(/\D/, '') }
          next if existing_phones.include?(normalized)

          has_primary = target.contact_phones.exists?(is_primary: true)
          target.contact_phones.create!(
            phone_number: src_phone.phone_number,
            phone_type: src_phone.phone_type,
            is_primary: src_phone.is_primary && !has_primary,
            label: src_phone.label,
            position: target.contact_phones.count
          )
        end

        # Merge contact_addresses (SSoT) - transfer by address_type, skip duplicates
        source.contact_addresses.each do |src_addr|
          next if target.contact_addresses.exists?(address_type: src_addr.address_type)

          has_primary = target.contact_addresses.exists?(is_primary: true)
          target.contact_addresses.create!(
            address_type: src_addr.address_type,
            line1: src_addr.line1,
            line2: src_addr.line2,
            line3: src_addr.line3,
            line4: src_addr.line4,
            city: src_addr.city,
            region: src_addr.region,
            postal_code: src_addr.postal_code,
            country: src_addr.country,
            is_primary: src_addr.is_primary && !has_primary
          )
        end

        # Keep Xero connection if target doesn't have one but source does
        # SSoT: Use contact_external_links (xero_links) not legacy xero_id column
        if target.xero_links.empty? && source.xero_links.any?
          links_count = source.xero_links.count
          source.xero_links.update_all(contact_id: target.id)
          @stats[:xero_connections_preserved] += links_count
          Rails.logger.info "[ContactAutoMerge] Transferred #{links_count} Xero link(s) from #{source.id} to #{target.id}"
        end

        # Merge supplier-specific fields (if both are suppliers)
        if source.is_supplier? && target.is_supplier?
          # Keep the better rating
          if source.rating.to_i > target.rating.to_i
            target.update!(rating: source.rating)
          end
          # Combine notes if both have them
          if source.notes.present? && target.notes.present?
            target.update!(notes: "#{target.notes}\n\n--- Auto-merged from contact ##{source.id} ---\n#{source.notes}")
          elsif source.notes.present?
            target.update!(notes: source.notes)
          end
        end

        # Update foreign keys from source to target
        PricebookItem.where(supplier_id: source.id).update_all(supplier_id: target.id)
        PricebookItem.where(default_supplier_id: source.id).update_all(default_supplier_id: target.id)
        PurchaseOrder.where(supplier_id: source.id).update_all(supplier_id: target.id)
        PriceHistory.where(supplier_id: source.id).update_all(supplier_id: target.id)

        # Transfer ContactRelationships (company/employee relationships) with validation
        # Outgoing relationships (source is the person, related_contact is the company)
        source.outgoing_relationships.each do |relationship|
          # Check if target already has this relationship
          existing = target.outgoing_relationships.find_by(
            related_contact_id: relationship.related_contact_id,
            relationship_type: relationship.relationship_type
          )

          if existing
            # Relationship already exists, destroy the duplicate
            relationship.destroy
          else
            # Validate entity types for employee_of relationships
            if relationship.relationship_type == "employee_of"
              unless %w[person sole_trader].include?(target.entity_type)
                Rails.logger.warn "[ContactAutoMerge] Skipping invalid employee_of: #{target.display_name} (#{target.entity_type}) cannot be employee"
                relationship.destroy
                next
              end
            end

            # Transfer relationship to target (check return value)
            unless relationship.update(source_contact_id: target.id)
              Rails.logger.warn "[ContactAutoMerge] Failed to transfer relationship #{relationship.id}: #{relationship.errors.full_messages.join(', ')}"
              relationship.destroy
            end
          end
        end

        # Incoming relationships (source is the company, related_contact is the person)
        source.incoming_relationships.each do |relationship|
          # Check if target already has this relationship
          existing = target.incoming_relationships.find_by(
            source_contact_id: relationship.source_contact_id,
            relationship_type: relationship.relationship_type
          )

          if existing
            # Relationship already exists, destroy the duplicate
            relationship.destroy
          else
            # Validate entity types for employee_of relationships
            if relationship.relationship_type == "employee_of"
              unless %w[company trust].include?(target.entity_type)
                Rails.logger.warn "[ContactAutoMerge] Skipping invalid employee_of: #{target.display_name} (#{target.entity_type}) cannot be employer"
                relationship.destroy
                next
              end
            end

            # Transfer relationship to target (check return value)
            unless relationship.update(related_contact_id: target.id)
              Rails.logger.warn "[ContactAutoMerge] Failed to transfer relationship #{relationship.id}: #{relationship.errors.full_messages.join(', ')}"
              relationship.destroy
            end
          end
        end

        # Transfer primary_company_id if source has one and target doesn't
        if source.primary_company_id.present? && target.primary_company_id.blank?
          target.update!(primary_company_id: source.primary_company_id)
        end

        # Transfer Xero links (contact_external_links)
        source.xero_links.each do |xero_link|
          # Check if target already has a link to this Xero tenant
          existing = target.xero_links.find_by(
            tenant_id: xero_link.tenant_id,
            source: xero_link.source
          )

          if existing
            # Target already linked to this Xero tenant, keep target's link and delete source's
            Rails.logger.info "[ContactAutoMerge] Target already linked to #{xero_link.tenant_name}, keeping target's link"
            xero_link.destroy
          else
            # Transfer this Xero link to target
            xero_link.update(contact_id: target.id)
            Rails.logger.info "[ContactAutoMerge] Transferred Xero link to #{xero_link.tenant_name}"
          end
        end

        # Transfer job associations
        source.job_contacts.each do |job_contact|
          # Check if target already has this job association
          existing = target.job_contacts.find_by(job_id: job_contact.job_id)

          if existing
            job_contact.destroy
          else
            job_contact.update(contact_id: target.id)
          end
        end

        # Transfer case associations
        source.case_contacts.each do |case_contact|
          # Check if target already has this case association
          existing = target.case_contacts.find_by(case_record_id: case_contact.case_record_id)

          if existing
            case_contact.destroy
          else
            case_contact.update(contact_id: target.id)
          end
        end

        # Soft delete the source contact
        source.update!(deleted: true)

        @stats[:contacts_merged] += 1
        @stats[:contacts_deleted] += 1
      end

      @stats[:merged_groups] << {
        target_id: target.id,
        target_name: target.display_name,
        target_xero: target.xero_id.present?,
        source_ids: sources.map(&:id),
        source_names: sources.map(&:display_name)
      }
    end

    Rails.logger.info "[ContactAutoMerge] Successfully merged group '#{group_name}'"
  rescue => e
    error_msg = "Failed to merge group '#{group_name}': #{e.message}"
    Rails.logger.error "[ContactAutoMerge] #{error_msg}"
    @stats[:errors] << error_msg
    raise ActiveRecord::Rollback
  end
end
