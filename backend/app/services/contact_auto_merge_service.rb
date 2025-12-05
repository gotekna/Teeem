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
    contacts = Contact.where(deleted: [false, nil])
                     .select(:id, :full_name, :first_name, :last_name, :email, :mobile_phone, :office_phone, :xero_id, :xero_contact_status, :rating, :notes, :roles, :website, :address)

    groups = []
    seen_ids = Set.new

    # Group by normalized full name
    by_name = contacts.group_by { |c| normalize_name(c.full_name) }
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
    name.to_s.downcase.gsub(/\s+/, ' ').strip
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

    Rails.logger.info "[ContactAutoMerge] Group '#{group[:match_value]}': keeping #{target.id} (#{target.full_name}, score=#{scored.first[:score]}), merging #{sources.map(&:id).join(', ')}"

    if target.xero_id.present?
      @stats[:xero_connections_preserved] += 1
    end

    if dry_run
      # Just record what would happen
      @stats[:contacts_merged] += sources.size
      @stats[:contacts_deleted] += sources.size
      @stats[:merged_groups] << {
        target_id: target.id,
        target_name: target.full_name,
        target_xero: target.xero_id.present?,
        source_ids: sources.map(&:id),
        source_names: sources.map(&:full_name)
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
    score += 3 if contact.address.present?
    score += 2 if contact.notes.present?
    score += 2 if contact.rating.to_i > 0
    score += contact.roles.to_a.size * 2 # More roles = more data

    # Prefer active Xero contacts
    score += 20 if contact.xero_contact_status == 'ACTIVE'

    score
  end

  def merge_contacts(target, sources, group_name)
    ActiveRecord::Base.transaction do
      sources.each do |source|
        # Merge roles
        merged_roles = (target.roles.to_a + source.roles.to_a).uniq
        target.update!(roles: merged_roles)

        # Fill in missing contact information from source
        target.update!(email: source.email) if target.email.blank? && source.email.present?
        target.update!(mobile_phone: source.mobile_phone) if target.mobile_phone.blank? && source.mobile_phone.present?
        target.update!(office_phone: source.office_phone) if target.office_phone.blank? && source.office_phone.present?
        target.update!(website: source.website) if target.website.blank? && source.website.present?
        target.update!(address: source.address) if target.address.blank? && source.address.present?

        # Keep Xero connection if target doesn't have one but source does
        if target.xero_id.blank? && source.xero_id.present?
          target.update!(
            xero_id: source.xero_id,
            xero_contact_status: source.xero_contact_status
          )
          @stats[:xero_connections_preserved] += 1
          Rails.logger.info "[ContactAutoMerge] Transferred Xero connection from #{source.id} to #{target.id}"
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

        # Soft delete the source contact
        source.update!(deleted: true)

        @stats[:contacts_merged] += 1
        @stats[:contacts_deleted] += 1
      end

      @stats[:merged_groups] << {
        target_id: target.id,
        target_name: target.full_name,
        target_xero: target.xero_id.present?,
        source_ids: sources.map(&:id),
        source_names: sources.map(&:full_name)
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
