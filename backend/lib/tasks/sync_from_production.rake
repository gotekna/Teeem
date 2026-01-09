namespace :db do
  desc "Sync data from production API"
  task sync_from_production: :environment do
    require "httparty"

    puts "Syncing data from production..."

    base_url = "https://teeemlive-ce8e2660a615.herokuapp.com"

    # Get contacts
    puts "Fetching contacts..."
    response = HTTParty.get("#{base_url}/api/v1/contacts", verify: false)
    data = JSON.parse(response.body)
    contacts_data = data["contacts"]

    puts "Found #{contacts_data.length} contacts in production"
    puts "Creating contacts in local database..."

    contacts_data.each do |contact_data|
      Contact.create!(
        full_name: contact_data["full_name"],
        email: contact_data["email"],
        mobile_phone: contact_data["mobile_phone"],
        office_phone: contact_data["office_phone"],
        website: contact_data["website"],
        contact_types: contact_data["contact_types"] || [],
        primary_contact_type: contact_data["primary_contact_type"]
      )
      puts "  ✓ Created: #{contact_data['full_name']}"
    rescue => e
      puts "  ✗ Failed to create #{contact_data['full_name']}: #{e.message}"
    end

    puts "\nDone! Synced #{Contact.count} contacts"
  end
end
