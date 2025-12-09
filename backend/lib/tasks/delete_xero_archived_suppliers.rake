namespace :xero do
  desc "Delete archived suppliers from Xero (with safety checks)"
  task delete_archived_suppliers: :environment do
    puts "=" * 80
    puts "XERO ARCHIVED SUPPLIER DELETION"
    puts "=" * 80
    puts

    # Safety check - require DRY_RUN=false to actually delete
    dry_run = ENV["DRY_RUN"] != "false"

    if dry_run
      puts "⚠️  DRY RUN MODE - No deletions will occur"
      puts "   To actually delete, run: DRY_RUN=false bin/rails xero:delete_archived_suppliers"
      puts
    else
      puts "🔴 LIVE DELETION MODE - Contacts will be permanently deleted!"
      puts "   Press Ctrl+C within 10 seconds to cancel..."
      10.downto(1) do |i|
        print "\r   Continuing in #{i} seconds... "
        sleep(1)
      end
      puts "\n"
    end

    # Get Xero client
    xero_client = XeroApiClient.new

    # Get all tenants
    configs = SyncConfiguration.where(sync_enabled: true)

    if configs.empty?
      puts "No Xero tenants configured!"
      return
    end

    config = configs.first
    tenant_id = config.xero_tenant_id
    tenant_name = config.xero_tenant_name

    puts "Tenant: #{tenant_name}"
    puts

    # Fetch all contacts
    puts "Fetching all contacts from Xero..."
    all_contacts = []
    page = 1

    loop do
      print "\r  Fetching page #{page}..."
      result = xero_client.get("Contacts", tenant_id: tenant_id, params: { page: page })

      if result[:success] && result[:data]["Contacts"]
        contacts = result[:data]["Contacts"]
        break if contacts.empty?

        all_contacts.concat(contacts)
        page += 1
        sleep(1.2) # Rate limiting
      else
        puts "\nError fetching contacts: #{result[:error]}"
        return
      end
    end

    puts "\n"
    puts "Total contacts fetched: #{all_contacts.count}"
    puts

    # Filter for archived suppliers
    archived_suppliers = all_contacts.select do |contact|
      contact["ContactStatus"] == "ARCHIVED" &&
      contact["IsSupplier"] == true
    end

    # Further filter for no activity (optional - safer)
    no_activity_suppliers = archived_suppliers.select do |contact|
      !contact["HasPurchases"] && !contact["HasSales"]
    end

    puts "Breakdown:"
    puts "  Total contacts: #{all_contacts.count}"
    puts "  Archived suppliers: #{archived_suppliers.count}"
    puts "  Archived suppliers with NO activity: #{no_activity_suppliers.count}"
    puts

    # Choose which to delete (safer to only delete those with no activity)
    to_delete = no_activity_suppliers

    if to_delete.empty?
      puts "No archived suppliers with no activity found. Nothing to delete."
      return
    end

    puts "Will delete #{to_delete.count} archived suppliers with no purchase/sale activity"
    puts

    if dry_run
      puts "DRY RUN - Showing first 10 contacts that would be deleted:"
      to_delete.first(10).each do |contact|
        puts "  - #{contact['Name']} (#{contact['ContactID']})"
      end
      puts "  ... and #{to_delete.count - 10} more" if to_delete.count > 10
      puts
      puts "To actually delete, run:"
      puts "  DRY_RUN=false bin/rails xero:delete_archived_suppliers"
      return
    end

    # Actually delete
    deleted_count = 0
    error_count = 0
    errors = []

    puts "Starting deletion..."
    puts "This will take approximately #{(to_delete.count / 60.0).ceil} minutes due to rate limiting"
    puts

    to_delete.each_with_index do |contact, index|
      contact_id = contact["ContactID"]
      contact_name = contact["Name"]

      # Update contact status to DELETED (Xero doesn't support permanent deletion via API)
      update_data = {
        Contacts: [
          {
            ContactID: contact_id,
            ContactStatus: "DELETED"
          }
        ]
      }

      result = xero_client.post("Contacts", update_data, { tenant_id: tenant_id })

      if result[:success]
        deleted_count += 1
        print "\r  Deleted #{deleted_count}/#{to_delete.count}: #{contact_name}"
      else
        error_count += 1
        error_msg = "Failed to delete #{contact_name}: #{result[:error]}"
        errors << error_msg
        puts "\n  ❌ #{error_msg}"
      end

      # Rate limiting - 60 calls per minute max
      sleep(1.2) if (index + 1) % 50 == 0
    end

    puts "\n"
    puts "=" * 80
    puts "DELETION COMPLETE"
    puts "=" * 80
    puts "Successfully deleted: #{deleted_count}"
    puts "Errors: #{error_count}"
    puts

    if errors.any?
      puts "Errors encountered:"
      errors.first(20).each { |err| puts "  - #{err}" }
      puts "  ... and #{errors.count - 20} more errors" if errors.count > 20
    end
  end
end
