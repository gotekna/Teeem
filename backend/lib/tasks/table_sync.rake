namespace :table_sync do
  desc "Check if system tables metadata is in sync with Rails models"
  task check: :environment do
    puts "🔍 Checking system tables metadata against Rails models...\n\n"

    drift_found = false
    fixes_applied = []

    # Get all system tables
    system_tables = Table.where(table_type: "system")

    system_tables.each do |table|
      next unless table.model_class.present?

      begin
        # Try to find the Rails model
        model = table.model_class.constantize

        # Check if it's actually an ActiveRecord model
        unless model.ancestors.include?(ApplicationRecord)
          puts "⚠️  Table '#{table.name}' (ID: #{table.id})"
          puts "   model_class: #{table.model_class} is not an ActiveRecord model\n\n"
          drift_found = true
          next
        end

        # Check database_table_name
        expected_table_name = model.table_name
        if table.database_table_name != expected_table_name
          puts "❌ Table '#{table.name}' (ID: #{table.id})"
          puts "   database_table_name mismatch:"
          puts "   - Metadata: #{table.database_table_name}"
          puts "   - Actual:   #{expected_table_name}\n\n"
          drift_found = true
        end

        # Check model_class exists and is correct
        if table.model_class != model.name
          puts "⚠️  Table '#{table.name}' (ID: #{table.id})"
          puts "   model_class mismatch:"
          puts "   - Metadata: #{table.model_class}"
          puts "   - Actual:   #{model.name}\n\n"
          drift_found = true
        end

      rescue NameError => e
        puts "❌ Table '#{table.name}' (ID: #{table.id})"
        puts "   model_class '#{table.model_class}' not found: #{e.message}\n\n"
        drift_found = true
      end
    end

    # Check for Rails models without Table entries
    puts "\n📋 Checking for Rails models without Table metadata..."

    # Get all Rails models that inherit from ApplicationRecord
    rails_models = ApplicationRecord.descendants.reject do |model|
      # Skip anonymous classes, abstract classes, and certain system classes
      model.name.nil? ||
      model.abstract_class? ||
      model.name.start_with?("ActiveStorage::") ||
      model.name.start_with?("SolidQueue::") ||
      model.name == "ApplicationRecord" ||
      model.name == "Version" || # PaperTrail audit log
      model.name.include?("Table") # Skip dynamic Table classes
    end

    rails_models.each do |model|
      table_entry = Table.find_by(model_class: model.name, table_type: "system")

      unless table_entry
        puts "⚠️  Rails model '#{model.name}' has no system Table entry"
        puts "   table_name: #{model.table_name}\n\n"
        drift_found = true
      end
    end

    if drift_found
      puts "\n❌ Drift detected! Run 'rails table_sync:fix' to auto-correct."
      exit 1
    else
      puts "\n✅ All system tables are in sync with Rails models!"
    end
  end

  desc "Fix system tables metadata to match Rails models"
  task fix: :environment do
    puts "🔧 Fixing system tables metadata...\n\n"

    fixes_applied = 0

    # Get all system tables
    system_tables = Table.where(table_type: "system")

    system_tables.each do |table|
      next unless table.model_class.present?

      begin
        # Try to find the Rails model
        model = table.model_class.constantize

        # Check if it's actually an ActiveRecord model
        unless model.ancestors.include?(ApplicationRecord)
          puts "⚠️  Skipping '#{table.name}' - #{table.model_class} is not an ActiveRecord model\n"
          next
        end

        # Fix database_table_name if needed
        expected_table_name = model.table_name
        if table.database_table_name != expected_table_name
          puts "✏️  Fixing database_table_name for '#{table.name}'"
          puts "   #{table.database_table_name} → #{expected_table_name}"
          table.update!(database_table_name: expected_table_name)
          fixes_applied += 1
        end

        # Fix model_class if needed (shouldn't happen but just in case)
        if table.model_class != model.name
          puts "✏️  Fixing model_class for '#{table.name}'"
          puts "   #{table.model_class} → #{model.name}"
          table.update!(model_class: model.name)
          fixes_applied += 1
        end

        # Suggest API endpoint if missing
        if table.api_endpoint.blank?
          suggested_endpoint = "/api/v1/#{model.table_name}"
          puts "💡 Suggestion: Add api_endpoint for '#{table.name}'"
          puts "   Suggested: #{suggested_endpoint}\n"
        end

      rescue NameError => e
        puts "❌ Cannot fix '#{table.name}' - model_class '#{table.model_class}' not found: #{e.message}\n"
      end
    end

    if fixes_applied > 0
      puts "\n✅ Applied #{fixes_applied} fix(es)!"
      puts "Run 'rails table_sync:check' to verify.\n"
    else
      puts "\n✅ No fixes needed - all system tables are in sync!"
    end
  end

  desc "List all system tables and their Rails models"
  task list: :environment do
    puts "📊 System Tables Metadata:\n\n"

    system_tables = Table.where(table_type: "system").order(:name)

    system_tables.each do |table|
      puts "Table: #{table.name} (ID: #{table.id})"
      puts "  model_class:         #{table.model_class || 'N/A'}"
      puts "  database_table_name: #{table.database_table_name}"
      puts "  api_endpoint:        #{table.api_endpoint || 'N/A'}"

      if table.model_class.present?
        begin
          model = table.model_class.constantize
          actual_table_name = model.table_name
          status = table.database_table_name == actual_table_name ? "✅" : "❌"
          puts "  actual_table_name:   #{actual_table_name} #{status}"
        rescue NameError
          puts "  actual_table_name:   ❌ Model not found"
        end
      end

      puts ""
    end

    puts "\nTotal: #{system_tables.count} system tables"
  end
end
