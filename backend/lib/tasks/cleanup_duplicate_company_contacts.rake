# frozen_string_literal: true

# SSoT: Cleanup duplicate company contacts
# Root Cause: Race condition in XeroContactSyncService allowed concurrent syncs to
# create duplicate contacts before xero_link was saved.
# This rake task merges duplicates (keeping oldest) and moves relationships.

namespace :contacts do
  desc "List duplicate company contacts (dry run)"
  task list_duplicate_companies: :environment do
    puts "=" * 60
    puts "Searching for duplicate company contacts..."
    puts "=" * 60

    # Find groups of duplicate company names
    duplicates = Contact.where(entity_type: "company", is_active: true)
                        .group("LOWER(TRIM(display_name))")
                        .having("COUNT(*) > 1")
                        .pluck(Arel.sql("LOWER(TRIM(display_name)), COUNT(*)"))

    if duplicates.empty?
      puts "\nNo duplicate company contacts found."
    else
      puts "\nFound #{duplicates.count} duplicate company name groups:\n"

      duplicates.each do |name, count|
        contacts = Contact.where(entity_type: "company", is_active: true)
                          .where("LOWER(TRIM(display_name)) = ?", name)
                          .order(:id)

        puts "\n#{name} (#{count} duplicates):"
        contacts.each_with_index do |c, idx|
          marker = idx.zero? ? "[KEEP]" : "[MERGE]"
          xero_links = c.xero_links.count
          relationships = c.outgoing_relationships.count + c.incoming_relationships.count
          puts "  #{marker} ##{c.id} - created: #{c.created_at.strftime('%Y-%m-%d %H:%M:%S')} - xero_links: #{xero_links} - relationships: #{relationships}"
        end
      end

      puts "\n" + "=" * 60
      puts "Run 'rails contacts:cleanup_duplicate_companies' to merge these duplicates"
      puts "=" * 60
    end
  end

  desc "Merge duplicate company contacts (keep oldest, merge relationships)"
  task cleanup_duplicate_companies: :environment do
    puts "=" * 60
    puts "Cleaning up duplicate company contacts..."
    puts "=" * 60

    # Find groups of duplicate company names
    duplicates = Contact.where(entity_type: "company", is_active: true)
                        .group("LOWER(TRIM(display_name))")
                        .having("COUNT(*) > 1")
                        .pluck(Arel.sql("LOWER(TRIM(display_name))"))

    if duplicates.empty?
      puts "\nNo duplicate company contacts found. Database is clean."
      return
    end

    merged_count = 0
    errors = []

    duplicates.each do |name|
      contacts = Contact.where(entity_type: "company", is_active: true)
                        .where("LOWER(TRIM(display_name)) = ?", name)
                        .order(:id)

      primary = contacts.first
      duplicates_to_merge = contacts[1..]

      puts "\nMerging '#{name}':"
      puts "  Primary: ##{primary.id}"

      duplicates_to_merge.each do |dup|
        begin
          ActiveRecord::Base.transaction do
            # Move outgoing relationships to primary
            moved_out = ContactRelationship.where(source_contact_id: dup.id)
                                           .update_all(source_contact_id: primary.id)

            # Move incoming relationships to primary
            moved_in = ContactRelationship.where(related_contact_id: dup.id)
                                          .update_all(related_contact_id: primary.id)

            # Move xero links to primary
            xero_links = ContactExternalLink.where(contact_id: dup.id)
                                             .update_all(contact_id: primary.id)

            # Move purchase orders
            pos = PurchaseOrder.where(supplier_id: dup.id)
                               .update_all(supplier_id: primary.id)

            # Move pricebook items
            pricebook = PricebookItem.where(supplier_id: dup.id)
                                      .update_all(supplier_id: primary.id)

            # Move job contacts
            job_contacts = JobContact.where(contact_id: dup.id)
                                     .update_all(contact_id: primary.id)

            # Deactivate duplicate
            dup.update_column(:is_active, false)

            puts "  Merged ##{dup.id} -> ##{primary.id} (rel: #{moved_out + moved_in}, xero: #{xero_links}, POs: #{pos}, pricebook: #{pricebook}, jobs: #{job_contacts})"
            merged_count += 1
          end
        rescue StandardError => e
          errors << { id: dup.id, error: e.message }
          puts "  ERROR merging ##{dup.id}: #{e.message}"
        end
      end
    end

    puts "\n" + "=" * 60
    puts "Summary:"
    puts "  Duplicates merged: #{merged_count}"
    puts "  Errors: #{errors.count}"
    puts "=" * 60

    if errors.any?
      puts "\nErrors encountered:"
      errors.each do |err|
        puts "  Contact ##{err[:id]}: #{err[:error]}"
      end
    end
  end
end
