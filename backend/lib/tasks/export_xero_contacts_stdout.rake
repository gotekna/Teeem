require "csv"

namespace :xero do
  desc "Export all Xero contacts to CSV stdout (for piping to file)"
  task export_contacts_stdout: :environment do
    # Suppress Rails output
    Rails.logger.level = Logger::ERROR

    # Get Xero client
    xero_client = XeroApiClient.new

    # Get all tenants
    configs = SyncConfiguration.where(sync_enabled: true)

    return unless configs.any?

    config = configs.first
    tenant_id = config.xero_tenant_id

    # Fetch all contacts from Xero
    all_contacts = []
    page = 1

    loop do
      result = xero_client.get("Contacts", tenant_id: tenant_id, params: { page: page })

      if result[:success] && result[:data]["Contacts"]
        contacts = result[:data]["Contacts"]
        break if contacts.empty?

        all_contacts.concat(contacts)

        page += 1
        sleep(1.2) # Rate limiting
      else
        break
      end
    end

    # Output CSV to stdout
    csv_string = CSV.generate do |csv|
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

    puts csv_string
  end
end
