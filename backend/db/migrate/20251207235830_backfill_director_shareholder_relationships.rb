# SSoT: Backfill ContactRelationship records from CompanyDirector and CompanyShareholding
# This ensures data consistency between the two systems
#
# Also fixes the unique index to include relationship_type (a person can be both director AND shareholder)
class BackfillDirectorShareholderRelationships < ActiveRecord::Migration[8.0]
  # Disable DDL transaction so individual record failures don't abort the whole migration
  disable_ddl_transaction!

  def up
    # Step 1: Fix the unique index to include relationship_type
    # This allows the same person to have multiple relationship types with the same company
    say_with_time "Updating unique index to include relationship_type" do
      begin
        remove_index :contact_relationships, name: "index_contact_relationships_on_source_and_related", if_exists: true
      rescue StandardError => e
        say "  Index removal failed (may not exist): #{e.message}", true
      end

      begin
        add_index :contact_relationships,
                  [ :source_contact_id, :related_contact_id, :relationship_type ],
                  unique: true,
                  name: "index_contact_relationships_unique_by_type"
      rescue StandardError => e
        say "  Index creation failed (may already exist): #{e.message}", true
      end
    end

    # Step 2: Backfill director relationships
    say_with_time "Backfilling director relationships from CompanyDirector to ContactRelationship" do
      directors_synced = 0
      directors_skipped = 0

      CompanyDirector.includes(:company, :contact).find_each do |director|
        # Skip if company has no linked contact
        unless director.company&.contact_id.present?
          directors_skipped += 1
          next
        end

        # Skip if director contact doesn't exist
        unless director.contact.present?
          directors_skipped += 1
          next
        end

        begin
          # Find or create the ContactRelationship
          rel = ContactRelationship.find_or_initialize_by(
            source_contact_id: director.contact_id,
            related_contact_id: director.company.contact_id,
            relationship_type: "director_of"
          )

          # Only update if new or if we have more data
          if rel.new_record? || rel.start_date.nil?
            rel.is_active = director.is_current
            rel.start_date = director.appointment_date
            rel.end_date = director.resignation_date
            rel.save!
            directors_synced += 1
          end
        rescue StandardError => e
          say "  Warning: Failed to sync director ##{director.id}: #{e.message}", true
        end
      end

      say "  Synced: #{directors_synced}, Skipped: #{directors_skipped}", true
      directors_synced
    end

    # Step 3: Backfill shareholder relationships
    say_with_time "Backfilling shareholder relationships from CompanyShareholding to ContactRelationship" do
      shareholders_synced = 0
      shareholders_skipped = 0

      CompanyShareholding.includes(:company).find_each do |holding|
        # Only sync Contact shareholders (not Company shareholders)
        unless holding.shareholder_type == "Contact"
          shareholders_skipped += 1
          next
        end

        # Skip if company has no linked contact
        unless holding.company&.contact_id.present?
          shareholders_skipped += 1
          next
        end

        # Skip if shareholder contact doesn't exist
        unless Contact.exists?(id: holding.shareholder_id)
          shareholders_skipped += 1
          next
        end

        begin
          # Find or create the ContactRelationship
          rel = ContactRelationship.find_or_initialize_by(
            source_contact_id: holding.shareholder_id,
            related_contact_id: holding.company.contact_id,
            relationship_type: "shareholder_of"
          )

          # Only update if new or if we have more data
          if rel.new_record? || rel.ownership_percentage.nil?
            rel.is_active = holding.disposal_date.nil?
            rel.start_date = holding.acquisition_date
            rel.end_date = holding.disposal_date
            rel.ownership_percentage = holding.percentage_of_total
            rel.save!
            shareholders_synced += 1
          end
        rescue StandardError => e
          say "  Warning: Failed to sync shareholding ##{holding.id}: #{e.message}", true
        end
      end

      say "  Synced: #{shareholders_synced}, Skipped: #{shareholders_skipped}", true
      shareholders_synced
    end
  end

  def down
    say_with_time "Reverting unique index to original form" do
      begin
        remove_index :contact_relationships, name: "index_contact_relationships_unique_by_type", if_exists: true
      rescue StandardError => e
        say "  Index removal failed: #{e.message}", true
      end

      begin
        add_index :contact_relationships,
                  [ :source_contact_id, :related_contact_id ],
                  unique: true,
                  name: "index_contact_relationships_on_source_and_related"
      rescue StandardError => e
        say "  Index creation failed: #{e.message}", true
      end
    end

    # Note: We don't remove the backfilled data as it may have been modified
    say "Backfilled data was NOT removed - manual cleanup required if needed"
  end
end
