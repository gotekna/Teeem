namespace :teeem do
  desc "Rename all Trapid references to TEEEM in database content"
  task rename_content: :environment do
    puts "Starting Trapid → TEEEM rename in database content..."

    # Update DocumentationEntry records (Trinity documentation)
    if defined?(DocumentationEntry) && DocumentationEntry.table_exists?
      count = 0
      DocumentationEntry.find_each do |entry|
        changes_made = false

        if entry.title&.match?(/trapid/i)
          entry.title = entry.title.gsub(/TRAPID/i, "TEEEM").gsub(/Trapid/i, "TEEEM").gsub(/trapid/i, "teeem")
          changes_made = true
        end

        if entry.content&.match?(/trapid/i)
          entry.content = entry.content.gsub(/TRAPID/i, "TEEEM").gsub(/Trapid/i, "TEEEM").gsub(/trapid/i, "teeem")
          changes_made = true
        end

        if entry.dense_index&.match?(/trapid/i)
          entry.dense_index = entry.dense_index.gsub(/TRAPID/i, "TEEEM").gsub(/Trapid/i, "TEEEM").gsub(/trapid/i, "teeem")
          changes_made = true
        end

        if entry.component&.match?(/trapid/i)
          entry.component = entry.component.gsub(/TrapidTableView/i, "TeeemTableView").gsub(/trapid/i, "teeem")
          changes_made = true
        end

        if changes_made
          entry.save!
          count += 1
          print "." if count % 10 == 0
        end
      end
      puts "\n✓ Updated #{count} DocumentationEntry records"
    else
      puts "⚠ DocumentationEntry model not found, skipping..."
    end

    # Update Rule records
    if defined?(Rule) && Rule.table_exists?
      count = 0
      Rule.find_each do |rule|
        changes_made = false

        if rule.respond_to?(:title) && rule.title&.match?(/trapid/i)
          rule.title = rule.title.gsub(/TRAPID/i, "TEEEM").gsub(/Trapid/i, "TEEEM").gsub(/trapid/i, "teeem")
          changes_made = true
        end

        if rule.respond_to?(:content) && rule.content&.match?(/trapid/i)
          rule.content = rule.content.gsub(/TRAPID/i, "TEEEM").gsub(/Trapid/i, "TEEEM").gsub(/trapid/i, "teeem")
          changes_made = true
        end

        if rule.respond_to?(:description) && rule.description&.match?(/trapid/i)
          rule.description = rule.description.gsub(/TRAPID/i, "TEEEM").gsub(/Trapid/i, "TEEEM").gsub(/trapid/i, "teeem")
          changes_made = true
        end

        if changes_made
          rule.save!
          count += 1
        end
      end
      puts "✓ Updated #{count} Rule records"
    else
      puts "⚠ Rule model not found, skipping..."
    end

    # Update AgentDefinition records
    if defined?(AgentDefinition) && AgentDefinition.table_exists?
      count = 0
      AgentDefinition.find_each do |agent|
        changes_made = false

        if agent.respond_to?(:name) && agent.name&.match?(/trapid/i)
          agent.name = agent.name.gsub(/trapid/i, "teeem")
          changes_made = true
        end

        if agent.respond_to?(:description) && agent.description&.match?(/trapid/i)
          agent.description = agent.description.gsub(/TRAPID/i, "TEEEM").gsub(/Trapid/i, "TEEEM").gsub(/trapid/i, "teeem")
          changes_made = true
        end

        if agent.respond_to?(:system_prompt) && agent.system_prompt&.match?(/trapid/i)
          agent.system_prompt = agent.system_prompt.gsub(/TRAPID/i, "TEEEM").gsub(/Trapid/i, "TEEEM").gsub(/trapid/i, "teeem")
          changes_made = true
        end

        if changes_made
          agent.save!
          count += 1
        end
      end
      puts "✓ Updated #{count} AgentDefinition records"
    else
      puts "⚠ AgentDefinition model not found, skipping..."
    end

    # Update FeatureTracker records (rename 'Trapid' references in feature names)
    if defined?(FeatureTracker) && FeatureTracker.table_exists?
      count = 0
      FeatureTracker.where("feature_name ILIKE '%trapid%'").find_each do |feature|
        feature.feature_name = feature.feature_name.gsub(/TRAPID/i, "TEEEM").gsub(/Trapid/i, "TEEEM")
        feature.save!
        count += 1
      end
      puts "✓ Updated #{count} FeatureTracker records"
    else
      puts "⚠ FeatureTracker model not found, skipping..."
    end

    # Update Column records (rename component references if component column exists)
    if defined?(Column) && Column.table_exists? && Column.column_names.include?("component")
      count = 0
      Column.where("component ILIKE '%trapid%'").find_each do |column|
        column.component = column.component.gsub(/TrapidTableView/i, "TeeemTableView")
        column.save!
        count += 1
      end
      puts "✓ Updated #{count} Column records"
    else
      puts "⚠ Column model or component column not found, skipping..."
    end

    puts "\n✅ Database content rename complete!"
    puts "\nNote: After running this task, you may want to:"
    puts "  1. Export updated Trinity documentation to markdown files"
    puts "  2. Re-sync agent definitions with: rails teeem:agents:sync"
  end

  desc "Verify rename - check for any remaining Trapid references in database"
  task verify_rename: :environment do
    puts "Checking for remaining 'Trapid' references in database..."

    issues_found = false

    if defined?(DocumentationEntry) && DocumentationEntry.table_exists?
      count = DocumentationEntry.where("title ILIKE '%trapid%' OR content ILIKE '%trapid%' OR dense_index ILIKE '%trapid%'").count
      if count > 0
        puts "❌ Found #{count} DocumentationEntry records still containing 'trapid'"
        issues_found = true
      else
        puts "✓ DocumentationEntry: Clean"
      end
    end

    if defined?(FeatureTracker) && FeatureTracker.table_exists?
      count = FeatureTracker.where("feature_name ILIKE '%trapid%'").count
      if count > 0
        puts "❌ Found #{count} FeatureTracker records still containing 'trapid'"
        issues_found = true
      else
        puts "✓ FeatureTracker: Clean"
      end
    end

    if defined?(Column) && Column.table_exists?
      count = Column.where("component ILIKE '%trapid%'").count
      if count > 0
        puts "❌ Found #{count} Column records still containing 'trapid'"
        issues_found = true
      else
        puts "✓ Column: Clean"
      end
    end

    if issues_found
      puts "\n⚠ Run 'rails teeem:rename_content' to fix remaining issues"
    else
      puts "\n✅ All database content has been renamed to TEEEM"
    end
  end
end
