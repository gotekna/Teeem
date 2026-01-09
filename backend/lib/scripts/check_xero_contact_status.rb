# Check Xero Contact Status
# Queries Xero API to check if a contact is ACTIVE, ARCHIVED, or DELETED
#
# Usage: rails runner lib/scripts/check_xero_contact_status.rb
#
# Options:
#   CONTACT_ID=xxx       - TEEEM contact ID to check
#   XERO_CONTACT_ID=xxx  - Xero contact ID (GUID) to check directly
#   TENANT_NAME=xxx      - Tenant name to check in (required if using CONTACT_ID)
#
# Examples:
#   # Check specific TEEEM contact's Xero links
#   CONTACT_ID=3376 rails runner lib/scripts/check_xero_contact_status.rb
#
#   # Check specific Xero contact ID directly
#   XERO_CONTACT_ID=afa6b8d1-afd0-4886-9327-1a91dc8baf44 TENANT_NAME="Livin The Dream PTY LTD" rails runner lib/scripts/check_xero_contact_status.rb

contact_id = ENV['CONTACT_ID']
xero_contact_id = ENV['XERO_CONTACT_ID']
tenant_name = ENV['TENANT_NAME']

puts "="*80
puts "XERO CONTACT STATUS CHECKER"
puts "="*80

if contact_id.present?
  contact = Contact.find_by(id: contact_id)
  unless contact
    puts "❌ Contact #{contact_id} not found"
    exit 1
  end

  puts "Contact: #{contact.display_name} (ID: #{contact.id})"
  puts ""

  links = contact.external_links.where(source: 'xero')
  if links.empty?
    puts "❌ No Xero links found for this contact"
    exit 1
  end

  puts "Found #{links.count} Xero link(s):"
  puts "-"*80
  puts ""

  links.each_with_index do |link, index|
    puts "#{index + 1}. Tenant: #{link.tenant_name}"
    puts "   Xero Contact ID: #{link.external_contact_id}"
    puts "   Stored Status: #{link.xero_contact_status || 'unknown'}"
    puts "   Last Verified: #{link.last_verified_at ? link.last_verified_at.strftime('%Y-%m-%d %H:%M') : 'never'}"
    puts ""

    # Query Xero API to get current status
    begin
      puts "   Querying Xero API..."
      api_client = XeroApiClient.new
      result = api_client.get("Contacts/#{link.external_contact_id}", { tenant_id: link.tenant_id })

      if result[:success]
        xero_contact = result[:data]["Contacts"]&.first

        if xero_contact
          status = xero_contact["ContactStatus"] || "UNKNOWN"
          is_supplier = xero_contact["IsSupplier"]
          is_customer = xero_contact["IsCustomer"]
          updated_date = xero_contact["UpdatedDateUTC"]

          puts "   ✅ XERO API STATUS: #{status}"
          puts "      Is Supplier: #{is_supplier}"
          puts "      Is Customer: #{is_customer}"
          puts "      Updated in Xero: #{updated_date}"
        else
          puts "   ⚠️  Contact not found in Xero API response"
        end
      else
        puts "   ❌ Failed to query Xero: #{result[:error]}"
      end
    rescue XeroApiClient::AuthenticationError => e
      puts "   ❌ Authentication error: #{e.message}"
    rescue StandardError => e
      puts "   ❌ Error: #{e.message}"
    end

    puts ""
  end

elsif xero_contact_id.present? && tenant_name.present?
  puts "Checking Xero Contact ID: #{xero_contact_id}"
  puts "Tenant: #{tenant_name}"
  puts ""

  # Find tenant_id from tenant_name
  credential = XeroCredential.find_by("LOWER(tenant_name) = ?", tenant_name.downcase)
  unless credential
    puts "❌ Xero credential not found for tenant: #{tenant_name}"
    exit 1
  end

  puts "Found credential: #{credential.tenant_name} (#{credential.tenant_id})"
  puts ""

  # Query Xero API
  begin
    puts "Querying Xero API..."
    api_client = XeroApiClient.new
    result = api_client.get("Contacts/#{xero_contact_id}", { tenant_id: credential.tenant_id })

    if result[:success]
      xero_contact = result[:data]["Contacts"]&.first

      if xero_contact
        status = xero_contact["ContactStatus"] || "UNKNOWN"
        name = xero_contact["Name"]
        is_supplier = xero_contact["IsSupplier"]
        is_customer = xero_contact["IsCustomer"]
        updated_date = xero_contact["UpdatedDateUTC"]

        puts "✅ CONTACT FOUND IN XERO"
        puts "-"*80
        puts "Name: #{name}"
        puts "Status: #{status}"
        puts "Is Supplier: #{is_supplier}"
        puts "Is Customer: #{is_customer}"
        puts "Updated in Xero: #{updated_date}"
        puts ""

        if status == "ARCHIVED"
          puts "⚠️  This contact is ARCHIVED in Xero"
        elsif status == "ACTIVE"
          puts "✅ This contact is ACTIVE in Xero"
        else
          puts "❓ Unknown status: #{status}"
        end
      else
        puts "❌ Contact not found in Xero API response"
      end
    else
      puts "❌ Failed to query Xero: #{result[:error]}"
    end
  rescue XeroApiClient::AuthenticationError => e
    puts "❌ Authentication error: #{e.message}"
  rescue StandardError => e
    puts "❌ Error: #{e.message}"
    puts e.backtrace.first(5).join("\n")
  end

else
  puts "❌ Missing required parameters"
  puts ""
  puts "Usage:"
  puts "  CONTACT_ID=xxx rails runner lib/scripts/check_xero_contact_status.rb"
  puts "  XERO_CONTACT_ID=xxx TENANT_NAME=\"xxx\" rails runner lib/scripts/check_xero_contact_status.rb"
  exit 1
end

puts "="*80
puts ""
