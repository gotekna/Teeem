# frozen_string_literal: true

namespace :teeem do
  desc "Link existing columns to ColumnTypeDefinition records based on column_type"
  task link_columns_to_type_definitions: :environment do
    puts "Starting column linkage to ColumnTypeDefinition records..."
    puts

    # Build a lookup hash of type_key => ColumnTypeDefinition
    type_definitions = ColumnTypeDefinition.all.index_by(&:type_key)
    puts "Found #{type_definitions.count} ColumnTypeDefinition records"
    puts

    # Track statistics
    stats = {
      total: 0,
      linked: 0,
      already_linked: 0,
      no_type: 0,
      no_definition: 0,
      errors: 0
    }

    # Process all columns
    Column.find_each do |column|
      stats[:total] += 1

      # Skip if already linked
      if column.column_type_definition_id.present?
        stats[:already_linked] += 1
        next
      end

      # Skip if no column_type
      if column.column_type.blank?
        stats[:no_type] += 1
        next
      end

      # Find matching type definition
      type_def = type_definitions[column.column_type]
      if type_def.nil?
        stats[:no_definition] += 1
        puts "  WARNING: No ColumnTypeDefinition for type '#{column.column_type}' (column: #{column.name}, foundation: #{column.foundation_id})"
        next
      end

      # Link the column to the type definition
      begin
        column.update_columns(
          column_type_definition_id: type_def.id,
          type_version_applied: type_def.version
        )
        stats[:linked] += 1
      rescue => e
        stats[:errors] += 1
        puts "  ERROR: Failed to link column #{column.id}: #{e.message}"
      end
    end

    puts
    puts "=" * 60
    puts "SUMMARY"
    puts "=" * 60
    puts "Total columns processed:     #{stats[:total]}"
    puts "Newly linked:                #{stats[:linked]}"
    puts "Already linked:              #{stats[:already_linked]}"
    puts "No column_type set:          #{stats[:no_type]}"
    puts "No matching definition:      #{stats[:no_definition]}"
    puts "Errors:                      #{stats[:errors]}"
    puts
    puts "Done!"
  end
end
