namespace :contacts do
  namespace :xero do
    desc "Migrate existing xero_id data to contact_xero_links table"
    task migrate_xero_ids: :environment do
      puts "Starting xero_id migration to contact_xero_links..."

      # Get the current Xero tenant ID
      xero_credential = XeroCredential.order(created_at: :desc).first
      unless xero_credential&.tenant_id
        puts "ERROR: No Xero credentials found. Cannot determine tenant ID."
        puts "Please connect to Xero first before running this migration."
        exit 1
      end

      tenant_id = xero_credential.tenant_id
      tenant_name = xero_credential.tenant_name || "Primary Xero Org"

      puts "Using Xero tenant: #{tenant_name} (#{tenant_id})"

      # Create SyncConfiguration for this tenant
      sync_config = SyncConfiguration.for_tenant!(tenant_id, tenant_name)
      puts "Created/found SyncConfiguration for tenant"

      # Find all contacts with xero_id
      contacts_with_xero = Contact.where.not(xero_id: [ nil, "" ])
      total = contacts_with_xero.count
      puts "Found #{total} contacts with xero_id"

      migrated = 0
      skipped = 0
      errors = 0

      contacts_with_xero.find_each.with_index do |contact, index|
        begin
          # Check if link already exists
          existing_link = ContactXeroLink.find_by(
            contact_id: contact.id,
            xero_tenant_id: tenant_id
          )

          if existing_link
            skipped += 1
            next
          end

          # Create the xero link
          ContactXeroLink.create!(
            contact: contact,
            xero_tenant_id: tenant_id,
            xero_tenant_name: tenant_name,
            xero_contact_id: contact.xero_id,
            sync_enabled: contact.sync_with_xero || false,
            sync_direction: "bidirectional",
            last_synced_at: contact.last_synced_at
          )

          migrated += 1

          # Progress update every 100 records
          if (index + 1) % 100 == 0
            puts "Progress: #{index + 1}/#{total} (migrated: #{migrated}, skipped: #{skipped})"
          end
        rescue => e
          errors += 1
          puts "ERROR migrating contact #{contact.id}: #{e.message}"
        end
      end

      puts "\n=== Migration Complete ==="
      puts "Total contacts with xero_id: #{total}"
      puts "Successfully migrated: #{migrated}"
      puts "Skipped (already exists): #{skipped}"
      puts "Errors: #{errors}"
    end

    desc "Populate ContactRelationships from primary_company_id"
    task populate_relationships: :environment do
      puts "Starting ContactRelationship population from primary_company_id..."

      # Find all person contacts with a primary_company_id
      contacts_with_company = Contact.where.not(primary_company_id: nil)
        .where(entity_type: "person")
      total = contacts_with_company.count
      puts "Found #{total} person contacts with primary_company_id"

      created = 0
      skipped = 0
      errors = 0

      contacts_with_company.find_each.with_index do |contact, index|
        begin
          # Check if relationship already exists
          existing_rel = ContactRelationship.find_by(
            source_contact_id: contact.id,
            related_contact_id: contact.primary_company_id,
            relationship_type: "employee_of"
          )

          if existing_rel
            skipped += 1
            next
          end

          # Create the relationship
          ContactRelationship.create!(
            source_contact_id: contact.id,
            related_contact_id: contact.primary_company_id,
            relationship_type: "employee_of",
            is_active: true,
            start_date: contact.created_at&.to_date
          )

          created += 1

          # Progress update every 100 records
          if (index + 1) % 100 == 0
            puts "Progress: #{index + 1}/#{total} (created: #{created}, skipped: #{skipped})"
          end
        rescue => e
          errors += 1
          puts "ERROR creating relationship for contact #{contact.id}: #{e.message}"
        end
      end

      puts "\n=== Population Complete ==="
      puts "Total contacts with primary_company_id: #{total}"
      puts "Relationships created: #{created}"
      puts "Skipped (already exists): #{skipped}"
      puts "Errors: #{errors}"
    end

    desc "Show migration status"
    task status: :environment do
      puts "=== Contact Xero Migration Status ==="
      puts ""

      # Contacts with old xero_id
      old_style = Contact.where.not(xero_id: [ nil, "" ]).count
      puts "Contacts with old xero_id column: #{old_style}"

      # ContactXeroLinks
      links = ContactXeroLink.count
      enabled_links = ContactXeroLink.enabled.count
      links_with_errors = ContactXeroLink.with_errors.count
      puts "ContactXeroLinks total: #{links}"
      puts "ContactXeroLinks enabled: #{enabled_links}"
      puts "ContactXeroLinks with errors: #{links_with_errors}"

      # SyncConfigurations
      configs = SyncConfiguration.count
      puts "SyncConfigurations: #{configs}"

      # ContactRelationships
      relationships = ContactRelationship.count
      puts ""
      puts "ContactRelationships total: #{relationships}"

      # Contacts with primary_company_id but no relationship
      orphans = Contact.where.not(primary_company_id: nil)
        .where.not(id: ContactRelationship.select(:source_contact_id))
        .count
      puts "Contacts with primary_company_id but no relationship: #{orphans}"

      puts ""
      puts "=== Recommendations ==="
      if old_style > links
        puts "- Run 'rake contacts:xero:migrate_xero_ids' to migrate remaining xero_ids"
      end
      if orphans > 0
        puts "- Run 'rake contacts:xero:populate_relationships' to create missing relationships"
      end
      if old_style == links && orphans == 0
        puts "- Migration complete! All data has been migrated."
      end
    end

    desc "Run full migration (xero_ids + relationships)"
    task migrate_all: :environment do
      Rake::Task["contacts:xero:migrate_xero_ids"].invoke
      puts "\n" + "="*50 + "\n\n"
      Rake::Task["contacts:xero:populate_relationships"].invoke
      puts "\n" + "="*50 + "\n\n"
      Rake::Task["contacts:xero:status"].invoke
    end

    desc "Convert self-referential contacts to sole_trader entity type"
    task convert_sole_traders: :environment do
      puts "Converting self-referential contacts to sole_trader entity type..."

      # IDs of contacts that had self-referential primary_company_id
      sole_trader_ids = [
        1301, 1308, 1335, 1336, 1338, 1485, 1488, 1493, 1498, 1514,
        1518, 1519, 1521, 1533, 1534, 1540, 1542, 1567, 1573
      ]

      converted = 0
      skipped = 0
      errors = 0

      sole_trader_ids.each do |contact_id|
        begin
          contact = Contact.find_by(id: contact_id)

          unless contact
            puts "Contact #{contact_id} not found (already deleted?)"
            skipped += 1
            next
          end

          # Update to sole_trader entity type
          contact.update!(
            entity_type: "sole_trader",
            primary_company_id: contact_id  # Restore self-referential relationship
          )

          # Create self-referential employee_of relationship
          unless ContactRelationship.find_by(
            source_contact_id: contact_id,
            related_contact_id: contact_id,
            relationship_type: "employee_of"
          )
            ContactRelationship.create!(
              source_contact_id: contact_id,
              related_contact_id: contact_id,
              relationship_type: "employee_of",
              is_active: true
            )
          end

          converted += 1
          puts "✅ Contact #{contact_id}: Converted to sole_trader"
        rescue => e
          errors += 1
          puts "ERROR converting contact #{contact_id}: #{e.message}"
        end
      end

      puts "\n=== Conversion Complete ==="
      puts "Total contacts to convert: #{sole_trader_ids.count}"
      puts "Successfully converted: #{converted}"
      puts "Skipped (not found): #{skipped}"
      puts "Errors: #{errors}"
    end
  end
end
