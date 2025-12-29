# frozen_string_literal: true

# Data migration to convert existing templates to versioned architecture
#
# For each existing SmScheduleMasterTemplate:
# 1. Creates Version 1 (published)
# 2. Links existing rows to Version 1
# 3. Clears the legacy sm_template_ids array (version now owns relationship)
#
class MigrateExistingTemplatesToVersioned < ActiveRecord::Migration[8.0]
  def up
    # Process each existing template
    SmScheduleMasterTemplate.find_each do |template|
      puts "Processing template: #{template.name} (ID: #{template.id})"

      # Skip if already has versions
      if template.sm_schedule_master_versions.exists?
        puts "  - Already has versions, skipping"
        next
      end

      # Create Version 1 (published)
      version = SmScheduleMasterVersion.create!(
        sm_schedule_master_template_id: template.id,
        version_number: 1,
        status: 'published',
        published_at: Time.current,
        change_summary: 'Initial version (migrated from legacy)'
      )
      puts "  - Created Version 1 (ID: #{version.id})"

      # Find rows that belong to this template (via JSONB array)
      rows = SmScheduleMaster.where("sm_template_ids @> ?", [template.id].to_json)
      row_count = rows.count
      puts "  - Found #{row_count} rows to migrate"

      # Link rows to version
      rows.update_all(sm_schedule_master_version_id: version.id)
      puts "  - Linked #{row_count} rows to Version 1"
    end

    puts "Migration complete!"
  end

  def down
    # Remove version links from rows
    SmScheduleMaster.update_all(sm_schedule_master_version_id: nil)

    # Delete all versions
    SmScheduleMasterVersion.delete_all

    puts "Rollback complete - versions removed"
  end
end
