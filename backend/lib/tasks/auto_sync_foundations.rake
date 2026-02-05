# Auto-sync Foundation metadata after migrations
# This ensures columns are always in sync with the database schema

# Hook into Rails migration lifecycle
Rake::Task["db:migrate"].enhance do
  Rake::Task["foundation:auto_sync_after_migration"].invoke
end

Rake::Task["db:rollback"].enhance do
  Rake::Task["foundation:auto_sync_after_migration"].invoke
end

namespace :foundation do
  desc "Auto-sync Foundation metadata after migrations (runs automatically)"
  task auto_sync_after_migration: :environment do
    # Skip in test environment
    next if Rails.env.test?

    puts "\n🔄 Auto-syncing Foundation metadata after migration..."

    begin
      # Foundations to skip (require manual review)
      skip_foundations = [
        "Trinity Bible",
        "Trinity Teacher",
        "Trinity Lexicon",
        "User Management",
        "Gold Standard Reference"
      ]

      # Quick check for out-of-sync foundations
      issues = find_foundation_sync_issues

      if issues.empty?
        puts "✅ All foundations are in sync!"
      else
        puts "⚠️  Found #{issues.count} foundation(s) with sync issues"
        puts "   Running auto-sync..."

        # Run sync for affected foundations only (faster)
        issues.each do |issue|
          foundation = issue[:foundation]
          orphans = issue[:orphans]
          missing = issue[:missing]

          next if orphans.empty? && missing.empty?

          # Skip special foundations that require manual review
          if skip_foundations.include?(foundation.name)
            puts "  ⏭️  Skipping #{foundation.name} (requires manual review)"
            next
          end

          puts "  🔧 Syncing #{foundation.name}..."

          # Add orphaned columns
          orphans.each do |col_name|
            next if col_name.in?([ "id", "created_at", "updated_at" ])

            db_col = ActiveRecord::Base.connection.columns(foundation.database_table_name).find { |c| c.name == col_name }
            next unless db_col

            col_type = infer_foundation_column_type(db_col)

            foundation.columns.create!(
              name: col_name.titleize,
              column_name: col_name,
              column_type: col_type,
              position: foundation.columns.maximum(:position).to_i + 1,
              searchable: infer_searchable(db_col)
            )
          end

          # Remove stale columns (but NEVER system columns or computed columns)
          missing.each do |col_name|
            # CRITICAL: Never delete system columns
            next if col_name.in?([ "id", "created_at", "updated_at" ])

            col = foundation.columns.find_by(column_name: col_name)
            next unless col

            # CRITICAL: Never delete computed columns (Feb 2026)
            # These are virtual columns that don't exist in DB but are populated by API
            next if col.settings&.dig("computed") == true

            col.destroy
          end
        end

        puts "✅ Auto-sync complete!"
      end
    rescue => e
      # Don't fail migrations if sync fails - just warn
      puts "⚠️  Auto-sync encountered an error (migrations still succeeded):"
      puts "   #{e.message}"
      puts "   Run 'rails foundation:sync' manually to fix."
    end
  end
end
