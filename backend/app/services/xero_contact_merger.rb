# frozen_string_literal: true

# XeroContactMerger service for merging duplicate contacts
# Handles:
# 1. Preserving ALL Xero organization links (ContactExternalLink)
# 2. Transferring all associations to target contact
# 3. Soft deleting duplicate contacts
# 4. Archiving duplicates in Xero via API
# 5. Handling conflicts when both target and duplicate are linked to same org
class XeroContactMerger
  attr_reader :result

  def initialize
    @result = {
      success: false,
      merged_count: 0,
      xero_archived_count: 0,
      xero_links_transferred: 0,
      xero_links_conflicts: 0,
      associations_updated: 0,
      errors: []
    }
  end

  # Main merge method
  # @param target_id [Integer] ID of contact to keep
  # @param duplicate_ids [Array<Integer>] IDs of contacts to merge into target
  # @param reviewer_email [String] Email of person approving merge
  def merge_contacts(target_id, duplicate_ids, reviewer_email: nil)
    target = Contact.find(target_id)
    duplicates = Contact.where(id: duplicate_ids)

    if duplicates.empty?
      @result[:errors] << "No duplicate contacts found"
      return @result
    end

    ActiveRecord::Base.transaction do
      duplicates.each do |duplicate|
        merge_single_contact(target, duplicate, reviewer_email)
      end

      @result[:success] = true
    end

    @result
  rescue StandardError => e
    @result[:errors] << "Merge failed: #{e.message}"
    Rails.logger.error "[XeroContactMerger] Error: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    @result
  end

  private

  def merge_single_contact(target, duplicate, reviewer_email)
    Rails.logger.info "[XeroContactMerger] Merging contact #{duplicate.id} into #{target.id}"

    # 1. Preserve ALL Xero organization links
    merge_xero_links(target, duplicate)

    # 2. Merge contact data (prefer most recent non-null values)
    merge_contact_data(target, duplicate)

    # 3. Update all associations to point to target
    transfer_associations(target, duplicate)

    # 4. Mark duplicate as merged (soft delete)
    mark_as_merged(duplicate, target.id)

    # 5. Archive in Xero (per organization)
    archive_in_xero(duplicate)

    @result[:merged_count] += 1
    Rails.logger.info "[XeroContactMerger] Successfully merged contact #{duplicate.id}"
  end

  def merge_xero_links(target, duplicate)
    # Get all Xero links from duplicate
    duplicate_links = duplicate.external_links.where(source: "xero")

    duplicate_links.each do |dup_link|
      # Check if target already has a link for this tenant
      existing_link = target.external_links.find_by(
        source: "xero",
        tenant_id: dup_link.tenant_id
      )

      if existing_link
        # Conflict: both target and duplicate are linked to same org
        if existing_link.external_contact_id == dup_link.external_contact_id
          # Same Xero contact ID - just delete duplicate link
          Rails.logger.info "[XeroContactMerger] Same Xero ID for tenant #{dup_link.tenant_id}, deleting duplicate link"
          dup_link.destroy
        else
          # Different Xero contact IDs - flag for review and keep both for now
          Rails.logger.warn "[XeroContactMerger] Conflict: different Xero IDs for tenant #{dup_link.tenant_id}"
          @result[:xero_links_conflicts] += 1

          # Archive the duplicate's Xero contact in this org
          archive_xero_contact_in_org(dup_link.tenant_id, dup_link.external_contact_id)

          # Delete the duplicate link
          dup_link.destroy
        end
      else
        # No conflict - transfer link to target
        Rails.logger.info "[XeroContactMerger] Transferring Xero link for tenant #{dup_link.tenant_id} to target"
        dup_link.update!(contact_id: target.id)
        @result[:xero_links_transferred] += 1
      end
    end
  end

  def merge_contact_data(target, duplicate)
    # Prefer most recent non-null values
    updates = {}

    # Merge basic fields
    %i[
      company_name first_name last_name tax_number email mobile_phone office_phone
      website bank_account_name bank_account_number bank_bsb
    ].each do |field|
      if target.send(field).blank? && duplicate.send(field).present?
        updates[field] = duplicate.send(field)
      end
    end

    # Update if we have new data
    target.update!(updates) if updates.any?
  end

  def transfer_associations(target, duplicate)
    # Transfer has_many associations by updating foreign keys
    transfer_has_many(duplicate, target, :external_invoices, :contact_id)
    transfer_has_many(duplicate, target, :job_contacts, :contact_id)
    transfer_has_many(duplicate, target, :case_contacts, :contact_id)
    transfer_has_many(duplicate, target, :quote_responses, :contact_id)
    transfer_has_many(duplicate, target, :subcontractor_invoices, :contact_id)
    transfer_has_many(duplicate, target, :pay_now_requests, :contact_id)

    # Transfer contact persons, addresses (but avoid duplicates)
    merge_contact_persons(target, duplicate)
    merge_contact_addresses(target, duplicate)

    # Transfer pricebook items (supplier)
    duplicate.pricebook_items.update_all(supplier_id: target.id)
    duplicate.default_pricebook_items.update_all(default_supplier_id: target.id)

    # Transfer purchase orders (supplier)
    duplicate.purchase_orders.update_all(supplier_id: target.id)

    # Transfer price histories
    duplicate.price_histories.update_all(supplier_id: target.id)

    # Transfer relationships with validation
    # Don't use update_all as it bypasses model validations
    transfer_relationships_with_validation(target, duplicate)

    # Transfer employees (if duplicate was primary company)
    duplicate.employees.update_all(primary_company_id: target.id)

    # Transfer corporate directorships and shareholdings
    duplicate.corporate_directorships.update_all(contact_id: target.id)
    duplicate.corporate_shareholdings.update_all(shareholder_id: target.id)
    duplicate.dividend_payments.update_all(shareholder_id: target.id)
  end

  def transfer_has_many(from, to, association, foreign_key)
    count = from.send(association).update_all(foreign_key => to.id)
    @result[:associations_updated] += count if count > 0
  end

  def merge_contact_persons(target, duplicate)
    duplicate.contact_persons.each do |person|
      # Check if target already has this person (by email)
      existing = target.contact_persons.find_by(email: person.email) if person.email.present?

      if existing
        # Already exists, delete duplicate
        person.destroy
      else
        # Transfer to target
        person.update!(contact_id: target.id)
      end
    end
  end

  def merge_contact_addresses(target, duplicate)
    duplicate.contact_addresses.each do |address|
      # Check if target already has similar address
      existing = target.contact_addresses.find_by(
        address_type: address.address_type,
        line1: address.line1,
        city: address.city
      )

      if existing
        # Already exists, delete duplicate
        address.destroy
      else
        # Transfer to target
        address.update!(contact_id: target.id)
      end
    end
  end

  def mark_as_merged(duplicate, target_id)
    # Soft delete the duplicate contact
    duplicate.update!(
      merged_into_id: target_id,
      deleted_at: Time.current
    )
  end

  def archive_in_xero(duplicate)
    # Get all Xero links for this contact
    xero_links = duplicate.external_links.xero

    xero_links.each do |link|
      begin
        archive_xero_contact_in_org(link.tenant_id, link.external_contact_id)
        @result[:xero_archived_count] += 1
      rescue StandardError => e
        Rails.logger.error "[XeroContactMerger] Failed to archive Xero contact: #{e.message}"
        @result[:errors] << "Failed to archive Xero contact in org #{link.tenant_id}: #{e.message}"
      end
    end
  end

  def archive_xero_contact_in_org(tenant_id, xero_contact_id)
    # Find credential for this tenant
    credential = XeroCredential.find_by(tenant_id: tenant_id)
    return unless credential&.effectively_connected?

    # Initialize API client
    api_client = XeroApiClient.new(
      access_token: credential.access_token,
      tenant_id: tenant_id
    )

    # Archive the contact via API
    api_client.put("Contacts/#{xero_contact_id}", {
      ContactID: xero_contact_id,
      ContactStatus: "ARCHIVED"
    })

    Rails.logger.info "[XeroContactMerger] Archived Xero contact #{xero_contact_id} in org #{tenant_id}"
  rescue StandardError => e
    Rails.logger.error "[XeroContactMerger] Error archiving Xero contact: #{e.message}"
    raise
  end

  def transfer_relationships_with_validation(target, duplicate)
    # Transfer outgoing relationships (duplicate is the source)
    duplicate.outgoing_relationships.find_each do |relationship|
      # Check if target already has this relationship
      existing = target.outgoing_relationships.find_by(
        related_contact_id: relationship.related_contact_id,
        relationship_type: relationship.relationship_type
      )

      if existing
        # Relationship already exists, destroy the duplicate
        relationship.destroy
      else
        # Validate entity types before transferring
        # For employee_of, source must be person/sole_trader
        if relationship.relationship_type == "employee_of"
          unless %w[person sole_trader].include?(target.entity_type)
            Rails.logger.warn "[XeroContactMerger] Skipping invalid employee_of transfer: #{target.display_name} (#{target.entity_type}) cannot be employee"
            relationship.destroy
            next
          end
        end

        # Transfer relationship to target using update (runs validations)
        unless relationship.update(source_contact_id: target.id)
          Rails.logger.warn "[XeroContactMerger] Failed to transfer relationship #{relationship.id}: #{relationship.errors.full_messages.join(', ')}"
          relationship.destroy
        end
      end
    end

    # Transfer incoming relationships (duplicate is the related_contact/target)
    duplicate.incoming_relationships.find_each do |relationship|
      # Check if target already has this relationship
      existing = target.incoming_relationships.find_by(
        source_contact_id: relationship.source_contact_id,
        relationship_type: relationship.relationship_type
      )

      if existing
        # Relationship already exists, destroy the duplicate
        relationship.destroy
      else
        # Validate entity types before transferring
        # For employee_of, target must be company/trust
        if relationship.relationship_type == "employee_of"
          unless %w[company trust].include?(target.entity_type)
            Rails.logger.warn "[XeroContactMerger] Skipping invalid employee_of transfer: #{target.display_name} (#{target.entity_type}) cannot be employer"
            relationship.destroy
            next
          end
        end

        # Transfer relationship to target using update (runs validations)
        unless relationship.update(related_contact_id: target.id)
          Rails.logger.warn "[XeroContactMerger] Failed to transfer relationship #{relationship.id}: #{relationship.errors.full_messages.join(', ')}"
          relationship.destroy
        end
      end
    end
  end
end
