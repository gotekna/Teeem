# frozen_string_literal: true

# BulkContactUpsertService: Bulk database operations for ultra-scale sync
#
# Part of the Ultra-Scale Xero Sync Architecture (Feb 2026)
#
# Problem: Old sync did individual INSERT/UPDATE per contact
#   20K contacts × 1 DB round-trip each = 20K queries
#
# Solution: Bulk operations with insert_all/upsert_all
#   20K contacts / 100 per batch = 200 queries
#
# Usage:
#   upserter = BulkContactUpsertService.new(teeem_tenant_id)
#   result = upserter.bulk_upsert(operations)
#   # => { created: 50, updated: 45, links_created: 95 }
#
class BulkContactUpsertService
  attr_reader :teeem_tenant_id, :stats

  def initialize(teeem_tenant_id)
    @teeem_tenant_id = teeem_tenant_id
    @stats = { created: 0, updated: 0, links_created: 0, links_updated: 0 }
  end

  # Process a batch of operations
  # @param operations [Array<Hash>] Array of:
  #   - { action: :create, attrs: Hash, xero_contact: Hash }
  #   - { action: :update, contact_id: Integer, attrs: Hash, xero_contact: Hash }
  # @return [Hash] { created: count, updated: count }
  def bulk_upsert(operations)
    return @stats if operations.empty?

    creates = operations.select { |op| op[:action] == :create }
    updates = operations.select { |op| op[:action] == :update }

    # Process updates first (don't need IDs back)
    @stats[:updated] = bulk_update(updates) if updates.any?

    # Process creates (need IDs back for link creation)
    created_contacts = bulk_create(creates) if creates.any?
    @stats[:created] = created_contacts&.size || 0

    # Create links for all operations
    link_operations = build_link_operations(operations, created_contacts)
    @stats[:links_created] = bulk_create_links(link_operations) if link_operations.any?

    @stats
  end

  # Bulk create contacts
  # Returns array of { xero_id:, contact_id: } for link creation
  def bulk_create(operations)
    return [] if operations.empty?

    now = Time.current

    # Build insert records
    records = operations.map do |op|
      op[:attrs].merge(
        tenant_id: @teeem_tenant_id,
        is_active: true,
        created_at: now,
        updated_at: now
      ).compact
    end

    # Use insert_all! with returning to get IDs
    # Note: insert_all doesn't run validations - we validate in the processor job
    result = Contact.insert_all!(records, returning: [:id])

    # Map back to xero_contact_id for link creation
    result.rows.zip(operations).map do |row, op|
      {
        contact_id: row[0],
        xero_contact_id: op[:xero_contact]['ContactID'],
        xero_contact_name: op[:xero_contact]['Name']
      }
    end
  rescue ActiveRecord::RecordNotUnique => e
    # Handle race condition: another process created same contact
    Rails.logger.warn("[BulkContactUpsertService] Duplicate key during bulk create: #{e.message}")

    # Fall back to individual creates with find_or_create
    operations.filter_map do |op|
      begin
        contact = find_or_create_contact(op[:attrs])
        {
          contact_id: contact.id,
          xero_contact_id: op[:xero_contact]['ContactID'],
          xero_contact_name: op[:xero_contact]['Name']
        }
      rescue => e
        Rails.logger.error("[BulkContactUpsertService] Failed to create contact: #{e.message}")
        nil
      end
    end
  end

  # Bulk update contacts
  # Uses upsert_all for efficiency
  def bulk_update(operations)
    return 0 if operations.empty?

    now = Time.current

    # Build upsert records (must include id)
    records = operations.map do |op|
      op[:attrs].merge(
        id: op[:contact_id],
        updated_at: now
      ).compact
    end

    # upsert_all with unique_by: :id for updates
    Contact.upsert_all(records, unique_by: :id)

    operations.size
  end

  # Bulk create/update contact external links
  def bulk_create_links(link_records)
    return 0 if link_records.empty?

    now = Time.current

    records = link_records.map do |lr|
      {
        contact_id: lr[:contact_id],
        source: 'xero',
        xero_org_id: lr[:xero_org_id],
        external_contact_id: lr[:xero_contact_id],
        external_name: lr[:xero_contact_name],
        tenant_name: lr[:tenant_name],
        match_type: lr[:match_type].to_s,
        match_confidence: lr[:match_confidence],
        needs_review: lr[:needs_review] || false,
        sync_enabled: !(lr[:needs_review] || false),
        sync_direction: 'bidirectional',
        last_synced_at: lr[:needs_review] ? nil : now,
        xero_contact_status: 'active',
        last_verified_at: now,
        created_at: now,
        updated_at: now
      }.compact
    end

    # Use upsert_all to handle existing links
    ContactExternalLink.upsert_all(
      records,
      unique_by: [:source, :xero_org_id, :external_contact_id],
      on_duplicate: :update,
      update_only: [:external_name, :match_type, :match_confidence, :last_synced_at, :xero_contact_status, :last_verified_at, :updated_at]
    )

    records.size
  end

  private

  # Build link operations from all processed contacts
  def build_link_operations(operations, created_contacts)
    created_map = (created_contacts || []).index_by { |c| c[:xero_contact_id] }

    operations.filter_map do |op|
      xero_contact = op[:xero_contact]
      xero_id = xero_contact['ContactID']

      # Get contact_id from either creation result or operation
      contact_id = if op[:action] == :create
        created_map.dig(xero_id, :contact_id)
      else
        op[:contact_id]
      end

      next unless contact_id

      {
        contact_id: contact_id,
        xero_org_id: op[:xero_org_id],
        xero_contact_id: xero_id,
        xero_contact_name: xero_contact['Name'],
        tenant_name: op[:tenant_name],
        match_type: op[:match_type] || 'sync',
        match_confidence: op[:match_confidence] || 1.0,
        needs_review: op[:needs_review] || false
      }
    end
  end

  # Fallback for individual create with duplicate handling
  def find_or_create_contact(attrs)
    Contact.transaction do
      # Try to find existing by display_name for companies
      if attrs[:entity_type] == 'company' && attrs[:display_name].present?
        existing = Contact.find_by(
          tenant_id: @teeem_tenant_id,
          entity_type: 'company',
          display_name: attrs[:display_name],
          is_active: true
        )
        return existing if existing
      end

      # Create new contact
      Contact.create!(attrs.merge(tenant_id: @teeem_tenant_id, is_active: true))
    end
  end
end
