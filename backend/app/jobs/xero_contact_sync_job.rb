class XeroContactSyncJob < ApplicationJob
  queue_as :default

  # Perform can accept different actions:
  # - No args: Full sync all tenants
  # - tenant_id: Sync specific tenant
  # - contact_id + tenant_id + action: Sync specific contact
  # - xero_contact_id + tenant_id + action: Import from Xero
  #
  # All syncing uses XeroContactSyncService which manages contact_external_links (SSoT)
  def perform(options = {})
    options = options.with_indifferent_access if options.is_a?(Hash)

    # Route to appropriate handler based on options
    if options[:action] == "sync_from_xero" && options[:contact_id]
      sync_contact_from_xero(options[:contact_id], options[:tenant_id])
    elsif options[:action] == "import_from_xero" && options[:xero_contact_id]
      import_contact_from_xero(options[:xero_contact_id], options[:tenant_id])
    elsif options[:tenant_id]
      sync_tenant(options[:tenant_id])
    else
      sync_all_tenants
    end
  end

  def sync_all_tenants
    Rails.logger.info("XeroContactSyncJob: Syncing all tenants")

    # Mark sync as in progress
    XeroSyncStatus.start_sync!("contacts")

    begin
      service = XeroContactSyncService.new
      result = service.sync_all_tenants

      # Update SSoT with success
      records_synced = result[:stats][:synced].to_i rescue 0
      XeroSyncStatus.complete_sync!(
        "contacts",
        records_synced: records_synced,
        next_sync_at: 30.minutes.from_now
      )

      result
    rescue StandardError => e
      Rails.logger.error("XeroContactSyncJob failed: #{e.message}")
      XeroSyncStatus.fail_sync!("contacts", error: e.message)
      raise
    end
  end

  def sync_tenant(tenant_id)
    Rails.logger.info("XeroContactSyncJob: Syncing tenant #{tenant_id}")

    # Mark sync as in progress
    XeroSyncStatus.start_sync!("contacts", tenant_id: tenant_id)

    begin
      service = XeroContactSyncService.new(tenant_id: tenant_id)
      result = service.sync

      # Update SSoT with success
      records_synced = result[:stats][:synced].to_i rescue 0
      XeroSyncStatus.complete_sync!(
        "contacts",
        tenant_id: tenant_id,
        records_synced: records_synced,
        next_sync_at: 30.minutes.from_now
      )

      result
    rescue StandardError => e
      Rails.logger.error("XeroContactSyncJob failed for tenant #{tenant_id}: #{e.message}")
      XeroSyncStatus.fail_sync!("contacts", tenant_id: tenant_id, error: e.message)
      raise
    end
  end

  def sync_contact_from_xero(contact_id, tenant_id)
    Rails.logger.info("XeroContactSyncJob: Syncing contact #{contact_id} from Xero tenant #{tenant_id}")
    contact = Contact.find(contact_id)
    link = contact.xero_links.find_by(tenant_id: tenant_id)

    if link
      service = XeroContactSyncService.new(tenant_id: tenant_id)
      service.sync_from_xero(link)
    else
      Rails.logger.warn("No xero_link found for contact #{contact_id} and tenant #{tenant_id}")
    end
  end

  def import_contact_from_xero(xero_contact_id, tenant_id)
    Rails.logger.info("XeroContactSyncJob: Importing Xero contact #{xero_contact_id} from tenant #{tenant_id}")
    service = XeroContactSyncService.new(tenant_id: tenant_id)
    xero_contact = service.fetch_single_xero_contact(xero_contact_id, tenant_id)

    if xero_contact
      service.create_teeem_contact_from_xero(xero_contact, tenant_id)
    else
      Rails.logger.warn("Could not fetch Xero contact #{xero_contact_id} from tenant #{tenant_id}")
    end
  end
end
