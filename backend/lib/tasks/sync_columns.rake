namespace :columns do
  desc "Check for column sync issues between database tables and columns metadata"
  task check: :environment do
    puts "🔍 Checking column sync across all tables...\n\n"

    issues = find_column_issues

    if issues.empty?
      puts "✅ All columns are in sync!"
    else
      puts "\n📊 Summary:"
      puts "   #{issues.count} table(s) with column sync issues"
      puts "\nRun 'rails columns:sync' to fix these issues."
    end
  end

  desc "Sync columns - fix orphaned and missing columns across all tables"
  task sync: :environment do
    puts "🔧 Syncing columns across all tables...\n\n"

    fixes = {
      renamed: 0,
      added: 0,
      removed: 0,
      skipped: 0
    }

    # Tables to skip (special handling required)
    skip_tables = [ "Trinity Bible", "Trinity Teacher", "Trinity Lexicon", "User Management", "Gold Standard Reference" ]

    # Known renames: old_name => new_name
    known_renames = {
      "construction_id" => "job_id"
    }

    Table.all.each do |table|
      next unless ActiveRecord::Base.connection.table_exists?(table.database_table_name)

      if skip_tables.include?(table.name)
        puts "⏭️  Skipping #{table.name} (requires special handling)"
        fixes[:skipped] += 1
        next
      end

      # Get actual DB columns
      db_cols = ActiveRecord::Base.connection.columns(table.database_table_name).map(&:name)
      db_cols -= [ "id", "created_at", "updated_at" ]

      # Get metadata columns
      meta_cols = table.columns.pluck(:column_name)
      meta_cols -= [ "id", "created_at", "updated_at", "actions" ]

      # Find orphans (in DB but not in metadata)
      orphans = db_cols - meta_cols

      # Find missing (in metadata but not in DB)
      missing = meta_cols - db_cols

      next if orphans.empty? && missing.empty?

      puts "\n=== #{table.name} (#{table.database_table_name}) ==="

      # Handle known renames first
      known_renames.each do |old_name, new_name|
        if missing.include?(old_name) && orphans.include?(new_name)
          col = table.columns.find_by(column_name: old_name)
          if col
            puts "  ✏️  Renaming column: #{old_name} → #{new_name}"
            col.update!(column_name: new_name)
            missing.delete(old_name)
            orphans.delete(new_name)
            fixes[:renamed] += 1
          end
        end
      end

      # Add orphaned columns to metadata
      orphans.each do |col_name|
        db_col = ActiveRecord::Base.connection.columns(table.database_table_name).find { |c| c.name == col_name }
        next unless db_col

        col_type = infer_column_type(db_col)
        display_name = col_name.titleize

        puts "  ➕ Adding orphaned column: #{col_name} (#{col_type})"

        table.columns.create!(
          name: display_name,
          column_name: col_name,
          column_type: col_type,
          position: table.columns.maximum(:position).to_i + 1
        )
        fixes[:added] += 1
      end

      # Remove stale metadata columns
      missing.each do |col_name|
        col = table.columns.find_by(column_name: col_name)
        next unless col

        puts "  ➖ Removing stale column definition: #{col_name}"
        col.destroy
        fixes[:removed] += 1
      end
    end

    puts "\n\n✅ Sync complete!"
    puts "   #{fixes[:renamed]} column(s) renamed"
    puts "   #{fixes[:added]} column(s) added to metadata"
    puts "   #{fixes[:removed]} stale column definition(s) removed"
    puts "   #{fixes[:skipped]} table(s) skipped (need manual review)"
  end

  desc "Sync Jobs table specifically (ted_number, design_id)"
  task sync_jobs: :environment do
    puts "🔧 Syncing Jobs table columns...\n"

    table = Table.find_by(name: "Jobs")
    unless table
      puts "❌ Jobs table not found!"
      exit 1
    end

    db_cols = ActiveRecord::Base.connection.columns(table.database_table_name).map(&:name)
    meta_cols = table.columns.pluck(:column_name)

    orphans = db_cols - meta_cols - [ "id", "created_at", "updated_at" ]

    if orphans.empty?
      puts "✅ Jobs table columns are in sync!"
      return
    end

    puts "Found #{orphans.count} orphaned column(s): #{orphans.join(', ')}"

    orphans.each do |col_name|
      db_col = ActiveRecord::Base.connection.columns(table.database_table_name).find { |c| c.name == col_name }
      next unless db_col

      col_type = infer_column_type(db_col)
      display_name = col_name.titleize

      puts "  ➕ Adding: #{col_name} (#{col_type})"

      table.columns.create!(
        name: display_name,
        column_name: col_name,
        column_type: col_type,
        position: table.columns.maximum(:position).to_i + 1
      )
    end

    puts "✅ Jobs table synced!"
  end

  desc "Remove orphaned database column (dangerous - removes data)"
  task :drop_column, [ :table_name, :column_name ] => :environment do |t, args|
    table_name = args[:table_name]
    column_name = args[:column_name]

    unless table_name && column_name
      puts "Usage: rails columns:drop_column[table_name,column_name]"
      exit 1
    end

    unless ActiveRecord::Base.connection.table_exists?(table_name)
      puts "❌ Table '#{table_name}' does not exist!"
      exit 1
    end

    unless ActiveRecord::Base.connection.column_exists?(table_name, column_name)
      puts "❌ Column '#{column_name}' does not exist in '#{table_name}'!"
      exit 1
    end

    print "⚠️  This will permanently delete the '#{column_name}' column and all its data from '#{table_name}'. Continue? (yes/no): "
    confirm = STDIN.gets.chomp

    unless confirm.downcase == "yes"
      puts "Aborted."
      exit 0
    end

    ActiveRecord::Base.connection.remove_column(table_name, column_name)
    puts "✅ Column '#{column_name}' dropped from '#{table_name}'"
  end

  private

  def find_column_issues
    issues = []

    Table.all.each do |table|
      next unless ActiveRecord::Base.connection.table_exists?(table.database_table_name)

      # Get actual DB columns (excluding Rails defaults)
      db_cols = ActiveRecord::Base.connection.columns(table.database_table_name).map(&:name)
      db_cols -= [ "id", "created_at", "updated_at" ]

      # Get metadata columns
      meta_cols = table.columns.pluck(:column_name)
      meta_cols -= [ "id", "created_at", "updated_at", "actions" ]

      # Find orphans (in DB but not in metadata)
      orphans = db_cols - meta_cols

      # Find missing (in metadata but not in DB)
      missing = meta_cols - db_cols

      if orphans.any? || missing.any?
        puts "=== #{table.name} (#{table.database_table_name}) ==="
        puts "  Orphaned (in DB, not in columns table): #{orphans.join(', ')}" if orphans.any?
        puts "  Missing (in columns table, not in DB): #{missing.join(', ')}" if missing.any?
        puts ""

        issues << {
          table: table,
          orphans: orphans,
          missing: missing
        }
      end
    end

    issues
  end

  def infer_column_type(db_col)
    case db_col.type
    when :string
      if db_col.name.include?("email")
        "email"
      elsif db_col.name.include?("phone")
        "phone"
      elsif db_col.name.include?("url") || db_col.name.include?("link")
        "url"
      else
        "single_line_text"
      end
    when :text
      "multiple_lines_text"
    when :integer, :bigint
      if db_col.name.end_with?("_id")
        "whole_number" # Could be a lookup - needs manual review
      else
        "whole_number"
      end
    when :decimal, :float
      if db_col.name.include?("percent")
        "percentage"
      elsif db_col.name.include?("price") || db_col.name.include?("cost") || db_col.name.include?("value") || db_col.name.include?("amount")
        "currency"
      else
        "decimal_number"
      end
    when :boolean
      "boolean"
    when :date
      "date"
    when :datetime, :timestamp
      "date" # Or datetime if you have that type
    when :json, :jsonb
      "multiple_lines_text" # JSON display
    else
      "single_line_text"
    end
  end
end

# Make helper method available at task level
def infer_column_type(db_col)
  case db_col.type
  when :string
    if db_col.name.include?("email")
      "email"
    elsif db_col.name.include?("phone")
      "phone"
    elsif db_col.name.include?("url") || db_col.name.include?("link")
      "url"
    else
      "single_line_text"
    end
  when :text
    "multiple_lines_text"
  when :integer, :bigint
    if db_col.name.end_with?("_id")
      "whole_number"
    else
      "whole_number"
    end
  when :decimal, :float
    if db_col.name.include?("percent")
      "percentage"
    elsif db_col.name.include?("price") || db_col.name.include?("cost") || db_col.name.include?("value") || db_col.name.include?("amount")
      "currency"
    else
      "decimal_number"
    end
  when :boolean
    "boolean"
  when :date
    "date"
  when :datetime, :timestamp
    "date"
  when :json, :jsonb
    "multiple_lines_text"
  else
    "single_line_text"
  end
end
