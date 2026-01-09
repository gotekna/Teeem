# frozen_string_literal: true

# Rake task to audit lookup and multiple_lookups columns for:
# 1. Type mismatches (declared column_type vs actual database type)
# 2. Missing lookup configuration (lookup_foundation_id, lookup_display_column)
#
# Usage: rake columns:audit_lookup_types
#
namespace :columns do
  desc "Audit lookup/multiple_lookups columns for type mismatches and missing configuration"
  task audit_lookup_types: :environment do
    puts "\n=========================================="
    puts "Column Type Audit: Lookup Columns"
    puts "=========================================="
    puts "Started at: #{Time.current.in_time_zone('Australia/Brisbane').strftime('%Y-%m-%d %H:%M:%S')} Brisbane"
    puts "==========================================\n"

    issues = {
      type_mismatch: [],
      missing_lookup_foundation: [],
      missing_lookup_display_column: [],
      invalid_lookup_foundation: [],
      invalid_lookup_display_column: [],
      missing_table: [],
      missing_db_column: []
    }

    stats = {
      total_checked: 0,
      foundations_checked: 0,
      lookup_columns: 0,
      multiple_lookup_columns: 0,
      array_of_integer_columns: 0,
      skipped_no_table: 0
    }

    # Get all foundations with their columns
    Foundation.includes(:columns).find_each do |foundation|
      stats[:foundations_checked] += 1

      # Get lookup-type columns for this foundation
      lookup_columns = foundation.columns.where(
        column_type: %w[lookup multiple_lookups array_of_integers]
      )

      next if lookup_columns.empty?

      table_name = foundation.database_table_name

      # Check if table exists
      unless table_name.present? && ActiveRecord::Base.connection.table_exists?(table_name)
        stats[:skipped_no_table] += 1
        lookup_columns.each do |col|
          issues[:missing_table] << {
            foundation: foundation.name,
            foundation_slug: foundation.slug,
            column_name: col.column_name,
            column_type: col.column_type,
            table_name: table_name || "(not set)",
            issue: "Database table does not exist"
          }
        end
        next
      end

      # Get database columns for this table
      db_columns = ActiveRecord::Base.connection.columns(table_name)
      db_column_map = db_columns.index_by(&:name)

      lookup_columns.each do |column|
        stats[:total_checked] += 1

        # Track by type
        case column.column_type
        when "lookup"
          stats[:lookup_columns] += 1
        when "multiple_lookups"
          stats[:multiple_lookup_columns] += 1
        when "array_of_integers"
          stats[:array_of_integer_columns] += 1
        end

        # Get the actual database column
        db_col = db_column_map[column.column_name]

        unless db_col
          issues[:missing_db_column] << {
            foundation: foundation.name,
            foundation_slug: foundation.slug,
            column_name: column.column_name,
            column_type: column.column_type,
            table_name: table_name,
            issue: "Column exists in metadata but not in database"
          }
          next
        end

        # Audit 1: Check type mismatch
        audit_column_type_mismatch(column, foundation, db_col, issues)

        # Audit 2: Check lookup configuration (only for lookup types, not array_of_integers)
        if column.column_type.in?(%w[lookup multiple_lookups])
          audit_lookup_configuration(column, foundation, issues)
        end
      end
    end

    # Print report
    print_report(issues, stats)
  end
end

def audit_column_type_mismatch(column, foundation, db_col, issues)
  actual_sql_type = db_col.sql_type.upcase

  case column.column_type
  when "lookup"
    # Expected: INTEGER, BIGINT, INT, INT4, INT8
    unless actual_sql_type =~ /^(INTEGER|BIGINT|INT|INT4|INT8|SMALLINT)/i
      issues[:type_mismatch] << {
        foundation: foundation.name,
        foundation_slug: foundation.slug,
        column_name: column.column_name,
        declared_type: column.column_type,
        expected_db_type: "INTEGER (foreign key)",
        actual_db_type: actual_sql_type,
        issue: "lookup column should be INTEGER"
      }
    end

  when "multiple_lookups"
    # Expected: TEXT or JSONB (stored as JSON array)
    unless actual_sql_type =~ /^(TEXT|JSONB|JSON|CHARACTER VARYING)/i
      issues[:type_mismatch] << {
        foundation: foundation.name,
        foundation_slug: foundation.slug,
        column_name: column.column_name,
        declared_type: column.column_type,
        expected_db_type: "TEXT or JSONB",
        actual_db_type: actual_sql_type,
        issue: "multiple_lookups column should be TEXT or JSONB"
      }
    end

  when "array_of_integers"
    # Expected: INTEGER[] or INT4[] or INT8[]
    unless actual_sql_type =~ /(INTEGER|INT4|INT8|BIGINT)\[\]/i
      issues[:type_mismatch] << {
        foundation: foundation.name,
        foundation_slug: foundation.slug,
        column_name: column.column_name,
        declared_type: column.column_type,
        expected_db_type: "INTEGER[]",
        actual_db_type: actual_sql_type,
        issue: "array_of_integers column should be INTEGER[]"
      }
    end
  end
end

def audit_lookup_configuration(column, foundation, issues)
  # Check 1: lookup_foundation_id present
  if column.lookup_foundation_id.blank? && column.lookup_foundation_slug.blank?
    issues[:missing_lookup_foundation] << {
      foundation: foundation.name,
      foundation_slug: foundation.slug,
      column_name: column.column_name,
      column_type: column.column_type,
      issue: "No lookup_foundation_id or lookup_foundation_slug configured"
    }
    return
  end

  # Check 2: Target foundation exists
  target_foundation = if column.lookup_foundation_id.present?
                        Foundation.find_by(id: column.lookup_foundation_id)
                      elsif column.lookup_foundation_slug.present?
                        Foundation.find_by(slug: column.lookup_foundation_slug)
                      end

  if target_foundation.nil?
    issues[:invalid_lookup_foundation] << {
      foundation: foundation.name,
      foundation_slug: foundation.slug,
      column_name: column.column_name,
      column_type: column.column_type,
      lookup_foundation_id: column.lookup_foundation_id,
      lookup_foundation_slug: column.lookup_foundation_slug,
      issue: "Target foundation not found (ID: #{column.lookup_foundation_id}, slug: #{column.lookup_foundation_slug})"
    }
    return
  end

  # Check 3: lookup_display_column present
  if column.lookup_display_column.blank?
    issues[:missing_lookup_display_column] << {
      foundation: foundation.name,
      foundation_slug: foundation.slug,
      column_name: column.column_name,
      column_type: column.column_type,
      target_foundation: target_foundation.name,
      target_slug: target_foundation.slug,
      issue: "No lookup_display_column configured"
    }
    return
  end

  # Check 4: Display column exists in target foundation
  # First check Foundation columns, then check actual database columns
  target_has_column = target_foundation.columns.exists?(column_name: column.lookup_display_column)

  # Also check if it's a standard column in the database
  unless target_has_column
    target_table = target_foundation.database_table_name
    if target_table.present? && ActiveRecord::Base.connection.table_exists?(target_table)
      target_db_columns = ActiveRecord::Base.connection.columns(target_table).map(&:name)
      target_has_column = target_db_columns.include?(column.lookup_display_column)
    end
  end

  unless target_has_column
    issues[:invalid_lookup_display_column] << {
      foundation: foundation.name,
      foundation_slug: foundation.slug,
      column_name: column.column_name,
      column_type: column.column_type,
      target_foundation: target_foundation.name,
      target_slug: target_foundation.slug,
      lookup_display_column: column.lookup_display_column,
      issue: "Column '#{column.lookup_display_column}' not found in target foundation '#{target_foundation.name}'"
    }
  end
end

def print_report(issues, stats)
  total_issues = issues.values.sum(&:count)

  puts "\n=========================================="
  puts "AUDIT SUMMARY"
  puts "==========================================\n"

  puts "Foundations checked:     #{stats[:foundations_checked]}"
  puts "Columns checked:         #{stats[:total_checked]}"
  puts "  - lookup:              #{stats[:lookup_columns]}"
  puts "  - multiple_lookups:    #{stats[:multiple_lookup_columns]}"
  puts "  - array_of_integers:   #{stats[:array_of_integer_columns]}"
  puts "Skipped (no table):      #{stats[:skipped_no_table]}"
  puts ""

  if total_issues == 0
    puts "All lookup columns are properly configured!"
    puts "\n=========================================="
    return
  end

  puts "ISSUES FOUND: #{total_issues}"
  puts "==========================================\n"

  # Group issues by foundation for readability
  all_issues = issues.values.flatten
  by_foundation = all_issues.group_by { |i| i[:foundation] }

  by_foundation.each do |foundation_name, foundation_issues|
    puts "\n#{foundation_name}"
    puts "-" * foundation_name.length

    foundation_issues.each do |issue|
      puts "  Column: #{issue[:column_name]} (#{issue[:column_type] || issue[:declared_type]})"
      puts "    Issue: #{issue[:issue]}"

      if issue[:expected_db_type]
        puts "    Expected: #{issue[:expected_db_type]}"
        puts "    Actual:   #{issue[:actual_db_type]}"
      end

      if issue[:target_foundation]
        puts "    Target: #{issue[:target_foundation]} (#{issue[:target_slug]})"
      end

      if issue[:lookup_display_column]
        puts "    Display Column: #{issue[:lookup_display_column]}"
      end

      puts ""
    end
  end

  # Summary by category
  puts "\n=========================================="
  puts "ISSUES BY CATEGORY"
  puts "==========================================\n"

  puts "Type Mismatches:                    #{issues[:type_mismatch].count}"
  puts "Missing lookup_foundation:          #{issues[:missing_lookup_foundation].count}"
  puts "Invalid lookup_foundation:          #{issues[:invalid_lookup_foundation].count}"
  puts "Missing lookup_display_column:      #{issues[:missing_lookup_display_column].count}"
  puts "Invalid lookup_display_column:      #{issues[:invalid_lookup_display_column].count}"
  puts "Missing database table:             #{issues[:missing_table].count}"
  puts "Missing database column:            #{issues[:missing_db_column].count}"
  puts "\n==========================================\n"
end
