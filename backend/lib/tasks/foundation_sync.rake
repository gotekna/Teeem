namespace :foundation do
  desc "Check for column sync issues between database tables and Foundation metadata"
  task check: :environment do
    puts "🔍 Checking Foundation column sync...\n\n"

    issues = find_foundation_sync_issues

    if issues.empty?
      puts "✅ All Foundation columns are in sync!"
    else
      puts "\n📊 Summary:"
      puts "   #{issues.count} foundation(s) with column sync issues"
      total_orphans = issues.sum { |i| i[:orphans].count }
      total_missing = issues.sum { |i| i[:missing].count }
      puts "   #{total_orphans} orphaned column(s) (in DB but not in Foundation metadata)"
      puts "   #{total_missing} missing column(s) (in Foundation metadata but not in DB)"
      puts "\nRun 'rails foundation:sync' to automatically fix these issues."
    end
  end

  desc "Sync Foundation metadata with database schema (auto-fix orphaned and missing columns)"
  task sync: :environment do
    puts "🔧 Syncing Foundation metadata with database schema...\n\n"

    fixes = {
      added: 0,
      removed: 0,
      skipped: 0
    }

    # Foundations to skip (special handling required)
    skip_foundations = [
      "Trinity Bible",
      "Trinity Teacher",
      "Trinity Lexicon",
      "User Management",
      "Gold Standard Reference"
    ]

    Foundation.all.each do |foundation|
      table_name = foundation.database_table_name

      # Skip if table doesn't exist in database
      unless ActiveRecord::Base.connection.table_exists?(table_name)
        puts "⏭️  Skipping #{foundation.name} (table '#{table_name}' does not exist)"
        fixes[:skipped] += 1
        next
      end

      # Skip special foundations
      if skip_foundations.include?(foundation.name)
        puts "⏭️  Skipping #{foundation.name} (requires manual review)"
        fixes[:skipped] += 1
        next
      end

      # Get actual DB columns (excluding Rails auto-generated columns)
      db_cols = ActiveRecord::Base.connection.columns(table_name).map(&:name)
      db_cols -= [ "id", "created_at", "updated_at" ]

      # Get Foundation metadata columns
      meta_cols = foundation.columns.pluck(:column_name)

      # Find orphans (in DB but not in metadata)
      orphans = db_cols - meta_cols

      # Find missing (in metadata but not in DB)
      missing = meta_cols - db_cols

      next if orphans.empty? && missing.empty?

      puts "\n=== #{foundation.name} (#{table_name}) ==="

      # Add orphaned columns to metadata
      orphans.each do |col_name|
        db_col = ActiveRecord::Base.connection.columns(table_name).find { |c| c.name == col_name }
        next unless db_col

        col_type = infer_foundation_column_type(db_col)
        display_name = col_name.titleize
        column_group = infer_column_group(col_name)

        puts "  ➕ Adding orphaned column: #{col_name} (#{col_type})"

        foundation.columns.create!(
          name: display_name,
          column_name: col_name,
          column_type: col_type,
          position: foundation.columns.maximum(:position).to_i + 1,
          column_group: column_group,
          searchable: infer_searchable(db_col)
        )
        fixes[:added] += 1
      end

      # Remove stale metadata columns (in metadata but not in DB)
      missing.each do |col_name|
        col = foundation.columns.find_by(column_name: col_name)
        next unless col

        puts "  ➖ Removing stale column metadata: #{col_name}"
        col.destroy
        fixes[:removed] += 1
      end
    end

    puts "\n\n✅ Sync complete!"
    puts "   #{fixes[:added]} column(s) added to Foundation metadata"
    puts "   #{fixes[:removed]} stale column metadata removed"
    puts "   #{fixes[:skipped]} foundation(s) skipped (need manual review)"
  end

  desc "Sync a specific Foundation table"
  task :sync_foundation, [ :foundation_name ] => :environment do |t, args|
    foundation_name = args[:foundation_name]

    unless foundation_name
      puts "Usage: rails foundation:sync_foundation[FoundationName]"
      puts "Example: rails foundation:sync_foundation[Contacts]"
      exit 1
    end

    foundation = Foundation.find_by(name: foundation_name)
    unless foundation
      puts "❌ Foundation '#{foundation_name}' not found!"
      exit 1
    end

    table_name = foundation.database_table_name

    unless ActiveRecord::Base.connection.table_exists?(table_name)
      puts "❌ Table '#{table_name}' does not exist!"
      exit 1
    end

    puts "🔧 Syncing #{foundation.name} foundation...\n"

    # Get actual DB columns
    db_cols = ActiveRecord::Base.connection.columns(table_name).map(&:name)
    db_cols -= [ "id", "created_at", "updated_at" ]

    # Get metadata columns
    meta_cols = foundation.columns.pluck(:column_name)

    # Find orphans and missing
    orphans = db_cols - meta_cols
    missing = meta_cols - db_cols

    if orphans.empty? && missing.empty?
      puts "✅ #{foundation.name} foundation is already in sync!"
      return
    end

    fixes = { added: 0, removed: 0 }

    # Add orphaned columns
    orphans.each do |col_name|
      db_col = ActiveRecord::Base.connection.columns(table_name).find { |c| c.name == col_name }
      next unless db_col

      col_type = infer_foundation_column_type(db_col)
      display_name = col_name.titleize
      column_group = infer_column_group(col_name)

      puts "  ➕ Adding: #{col_name} (#{col_type})"

      foundation.columns.create!(
        name: display_name,
        column_name: col_name,
        column_type: col_type,
        position: foundation.columns.maximum(:position).to_i + 1,
        column_group: column_group,
        searchable: infer_searchable(db_col)
      )
      fixes[:added] += 1
    end

    # Remove stale metadata
    missing.each do |col_name|
      col = foundation.columns.find_by(column_name: col_name)
      next unless col

      puts "  ➖ Removing stale metadata: #{col_name}"
      col.destroy
      fixes[:removed] += 1
    end

    puts "\n✅ Sync complete!"
    puts "   #{fixes[:added]} column(s) added"
    puts "   #{fixes[:removed]} stale column(s) removed"
  end

  private

  def find_foundation_sync_issues
    issues = []

    Foundation.all.each do |foundation|
      table_name = foundation.database_table_name

      # Skip if table doesn't exist
      next unless ActiveRecord::Base.connection.table_exists?(table_name)

      # Get actual DB columns
      db_cols = ActiveRecord::Base.connection.columns(table_name).map(&:name)
      db_cols -= [ "id", "created_at", "updated_at" ]

      # Get metadata columns
      meta_cols = foundation.columns.pluck(:column_name)

      # Find orphans and missing
      orphans = db_cols - meta_cols
      missing = meta_cols - db_cols

      if orphans.any? || missing.any?
        puts "=== #{foundation.name} (#{table_name}) ==="
        puts "  🔴 Orphaned (in DB, not in Foundation): #{orphans.join(', ')}" if orphans.any?
        puts "  🟡 Missing (in Foundation, not in DB): #{missing.join(', ')}" if missing.any?
        puts ""

        issues << {
          foundation: foundation,
          orphans: orphans,
          missing: missing
        }
      end
    end

    issues
  end

  def infer_foundation_column_type(db_col)
    # Map database column types to Foundation column types
    case db_col.type
    when :string
      # Check column name patterns for specific types
      return "email" if db_col.name.include?("email")
      return "phone" if db_col.name.include?("phone") && !db_col.name.include?("mobile")
      return "mobile" if db_col.name.include?("mobile")
      return "url" if db_col.name.include?("url") || db_col.name.include?("link") || db_col.name.include?("photo_url")
      return "abn" if db_col.name.include?("abn") && !db_col.name.include?("abn_")
      return "acn" if db_col.name.include?("acn")
      return "bsb" if db_col.name.include?("bsb")
      return "tfn" if db_col.name == "tfn"
      return "postcode" if db_col.name == "postcode"
      "single_line_text"
    when :text
      # Check if it's an array
      return "array_of_items" if db_col.array?
      "multiple_lines_text"
    when :integer, :bigint
      # Check if it's a foreign key
      if db_col.name.end_with?("_id")
        "whole_number" # Could be a lookup - needs manual review
      else
        "whole_number"
      end
    when :decimal, :float
      return "percentage" if db_col.name.include?("percent") || db_col.name.include?("rate")
      return "currency" if db_col.name.include?("price") || db_col.name.include?("cost") ||
                           db_col.name.include?("value") || db_col.name.include?("amount") ||
                           db_col.name.include?("receivable") || db_col.name.include?("payable")
      "number"
    when :boolean
      "boolean"
    when :date
      "date"
    when :datetime, :timestamp
      "date_and_time"
    when :jsonb
      "structured_data"
    when :json
      "structured_data"
    else
      "single_line_text"
    end
  end

  def infer_column_group(col_name)
    # Infer column group based on column name patterns
    return "Xero Integration" if col_name.include?("xero")
    return "Business Details" if col_name.include?("abn") || col_name.include?("acn") || col_name.include?("company")
    return "Contact Information" if col_name.include?("address") || col_name.include?("phone") || col_name.include?("email") ||
                                     col_name.include?("city") || col_name.include?("state") || col_name.include?("postcode")
    return "Personal Details" if col_name.include?("name") || col_name.include?("birth") || col_name.include?("photo") ||
                                  col_name.include?("licence") || col_name.include?("passport")
    return "Tax Details" if col_name.include?("tfn") || col_name.include?("tax")
    return "Banking" if col_name.include?("bank") || col_name.include?("bsb")
    return "System" if col_name.include?("deleted") || col_name.include?("is_") || col_name.include?("sync")
    return "Performance Metrics" if col_name.include?("rating") || col_name.include?("response")

    "General"
  end

  def infer_searchable(db_col)
    # Text fields are generally searchable
    return true if [ :string, :text ].include?(db_col.type)
    # Except for sensitive data
    return false if db_col.name.include?("tfn") || db_col.name.include?("password") || db_col.name.include?("token")
    false
  end
end

# Make helper methods available at task level
def infer_foundation_column_type(db_col)
  case db_col.type
  when :string
    return "email" if db_col.name.include?("email")
    return "phone" if db_col.name.include?("phone") && !db_col.name.include?("mobile")
    return "mobile" if db_col.name.include?("mobile")
    return "url" if db_col.name.include?("url") || db_col.name.include?("link") || db_col.name.include?("photo_url")
    return "abn" if db_col.name.include?("abn") && !db_col.name.include?("abn_")
    return "acn" if db_col.name.include?("acn")
    return "bsb" if db_col.name.include?("bsb")
    return "tfn" if db_col.name == "tfn"
    return "postcode" if db_col.name == "postcode"
    "single_line_text"
  when :text
    return "array_of_items" if db_col.array?
    "multiple_lines_text"
  when :integer, :bigint
    db_col.name.end_with?("_id") ? "whole_number" : "whole_number"
  when :decimal, :float
    return "percentage" if db_col.name.include?("percent") || db_col.name.include?("rate")
    return "currency" if db_col.name.include?("price") || db_col.name.include?("cost") ||
                         db_col.name.include?("value") || db_col.name.include?("amount")
    "number"
  when :boolean
    "boolean"
  when :date
    "date"
  when :datetime, :timestamp
    "date_and_time"
  when :jsonb, :json
    "structured_data"
  else
    "single_line_text"
  end
end

def infer_column_group(col_name)
  return "Xero Integration" if col_name.include?("xero")
  return "Business Details" if col_name.include?("abn") || col_name.include?("acn") || col_name.include?("company")
  return "Contact Information" if col_name.include?("address") || col_name.include?("phone") || col_name.include?("email") ||
                                   col_name.include?("city") || col_name.include?("state") || col_name.include?("postcode")
  return "Personal Details" if col_name.include?("name") || col_name.include?("birth") || col_name.include?("photo") ||
                                col_name.include?("licence") || col_name.include?("passport")
  return "Tax Details" if col_name.include?("tfn") || col_name.include?("tax")
  return "Banking" if col_name.include?("bank") || col_name.include?("bsb")
  return "System" if col_name.include?("deleted") || col_name.include?("is_") || col_name.include?("sync")
  return "Performance Metrics" if col_name.include?("rating") || col_name.include?("response")

  "General"
end

def infer_searchable(db_col)
  return true if [ :string, :text ].include?(db_col.type)
  return false if db_col.name.include?("tfn") || db_col.name.include?("password") || db_col.name.include?("token")
  false
end

def find_foundation_sync_issues
  issues = []

  Foundation.all.each do |foundation|
    table_name = foundation.database_table_name
    next unless ActiveRecord::Base.connection.table_exists?(table_name)

    db_cols = ActiveRecord::Base.connection.columns(table_name).map(&:name)
    db_cols -= [ "id", "created_at", "updated_at" ]

    meta_cols = foundation.columns.pluck(:column_name)

    orphans = db_cols - meta_cols
    missing = meta_cols - db_cols

    if orphans.any? || missing.any?
      puts "=== #{foundation.name} (#{table_name}) ==="
      puts "  🔴 Orphaned (in DB, not in Foundation): #{orphans.join(', ')}" if orphans.any?
      puts "  🟡 Missing (in Foundation, not in DB): #{missing.join(', ')}" if missing.any?
      puts ""

      issues << {
        foundation: foundation,
        orphans: orphans,
        missing: missing
      }
    end
  end

  issues
end
