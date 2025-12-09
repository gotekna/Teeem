require "csv"

namespace :xero do
  desc "Export all Xero contacts to CSV without importing (read-only)"
  task export_contacts: :environment do
    puts "=" * 80
    puts "EXPORTING XERO CONTACTS (READ-ONLY)"
    puts "=" * 80
    puts

    # Get Xero client
    xero_client = XeroApiClient.new

    # Get all tenants
    configs = SyncConfiguration.where(sync_enabled: true)

    if configs.empty?
      puts "No Xero tenants configured!"
      return
    end

    # Let user choose tenant if multiple
    if configs.count > 1
      puts "Available Xero Organizations:"
      configs.each_with_index do |config, index|
        puts "  #{index + 1}. #{config.xero_tenant_name} (#{config.xero_tenant_id})"
      end
      puts
      puts "Using first tenant: #{configs.first.xero_tenant_name}"
      puts
    end

    config = configs.first
    tenant_id = config.xero_tenant_id
    tenant_name = config.xero_tenant_name

    puts "Fetching contacts from: #{tenant_name}"
    puts

    # Fetch all contacts from Xero
    all_contacts = []
    page = 1

    loop do
      puts "Fetching page #{page}..."
      result = xero_client.get("Contacts", tenant_id: tenant_id, params: { page: page })

      if result[:success] && result[:data]["Contacts"]
        contacts = result[:data]["Contacts"]
        break if contacts.empty?

        all_contacts.concat(contacts)
        puts "  Found #{contacts.count} contacts (total: #{all_contacts.count})"

        page += 1
        sleep(1.2) # Rate limiting
      else
        puts "Error fetching contacts: #{result[:error]}"
        break
      end
    end

    puts
    puts "=" * 80
    puts "TOTAL CONTACTS IN XERO: #{all_contacts.count}"
    puts "=" * 80
    puts

    # Generate CSV
    csv_path = Rails.root.join("tmp", "xero_contacts_export_#{Time.current.strftime('%Y%m%d_%H%M%S')}.csv")

    CSV.open(csv_path, "w") do |csv|
      # Header
      csv << [
        "Xero Contact ID",
        "Name",
        "Contact Type",
        "Status",
        "Email",
        "Phone",
        "Mobile",
        "Tax Number (ABN)",
        "Account Number",
        "Contact Number",
        "Updated Date",
        "Is Supplier",
        "Is Customer",
        "Has Purchases",
        "Has Sales"
      ]

      # Data rows
      all_contacts.each do |contact|
        # Extract phone numbers
        phones = contact["Phones"] || []
        default_phone = phones.find { |p| p["PhoneType"] == "DEFAULT" }&.dig("PhoneNumber")
        mobile_phone = phones.find { |p| p["PhoneType"] == "MOBILE" }&.dig("PhoneNumber")

        csv << [
          contact["ContactID"],
          contact["Name"],
          contact["ContactPersons"]&.any? ? "Company" : "Person",
          contact["ContactStatus"],
          contact["EmailAddress"],
          default_phone,
          mobile_phone,
          contact["TaxNumber"],
          contact["AccountNumber"],
          contact["ContactNumber"],
          contact["UpdatedDateUTC"],
          contact["IsSupplier"],
          contact["IsCustomer"],
          contact["HasPurchases"],
          contact["HasSales"]
        ]
      end
    end

    puts "=" * 80
    puts "EXPORT COMPLETE"
    puts "=" * 80
    puts "CSV saved to: #{csv_path}"
    puts
    puts "Contact breakdown:"

    # Stats
    active = all_contacts.count { |c| c["ContactStatus"] == "ACTIVE" }
    archived = all_contacts.count { |c| c["ContactStatus"] == "ARCHIVED" }
    suppliers = all_contacts.count { |c| c["IsSupplier"] }
    customers = all_contacts.count { |c| c["IsCustomer"] }
    both = all_contacts.count { |c| c["IsSupplier"] && c["IsCustomer"] }
    has_purchases = all_contacts.count { |c| c["HasPurchases"] }
    has_sales = all_contacts.count { |c| c["HasSales"] }
    no_activity = all_contacts.count { |c| !c["HasPurchases"] && !c["HasSales"] }

    puts "  Active: #{active}"
    puts "  Archived: #{archived}"
    puts
    puts "  Suppliers: #{suppliers}"
    puts "  Customers: #{customers}"
    puts "  Both: #{both}"
    puts
    puts "  Has Purchases: #{has_purchases}"
    puts "  Has Sales: #{has_sales}"
    puts "  No Activity: #{no_activity}"
    puts
    puts "Review the CSV to identify contacts to delete from Xero"
  end
end
