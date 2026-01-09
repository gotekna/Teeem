namespace :teeem do
  desc "Sync system table column metadata with actual database schema"
  task sync_system_columns: :environment do
    puts "\n🔄 Syncing system table columns with database schema..."
    puts "=" * 80

    # Get all system tables
    system_tables = Table.where(table_type: "system").order(:id)

    total_tables = system_tables.count
    synced_count = 0
    error_count = 0

    system_tables.each_with_index do |table, index|
      begin
        puts "\n[#{index + 1}/#{total_tables}] #{table.icon} #{table.name} (ID: #{table.id})"

        # Get actual database table name
        actual_table_name = get_actual_table_name(table.model_class)

        unless actual_table_name && ActiveRecord::Base.connection.table_exists?(actual_table_name)
          puts "  ⚠️  Database table '#{actual_table_name}' not found - skipping"
          error_count += 1
          next
        end

        # Get actual database columns
        db_columns = ActiveRecord::Base.connection.columns(actual_table_name)
        puts "  📊 Found #{db_columns.count} columns in database"

        # Get registered columns
        registered_columns = table.columns.pluck(:column_name)
        puts "  📝 #{registered_columns.count} columns currently registered"

        # Find missing columns
        db_column_names = db_columns.map(&:name)
        missing_columns = db_column_names - registered_columns
        extra_columns = registered_columns - db_column_names

        if missing_columns.any?
          puts "  ➕ Adding #{missing_columns.count} missing columns: #{missing_columns.join(', ')}"

          missing_columns.each do |col_name|
            db_col = db_columns.find { |c| c.name == col_name }
            next unless db_col

            # Determine column type
            column_type = map_sql_type_to_column_type(db_col.sql_type)

            # Create column metadata
            Column.create!(
              table_id: table.id,
              name: col_name.titleize,
              column_name: col_name,
              column_type: column_type,
              required: !db_col.null,
              is_unique: false,
              is_title: col_name == "name" || col_name == "title",
              searchable: [ "name", "title", "description", "email" ].include?(col_name),
              position: table.columns.maximum(:position).to_i + 1
            )
          end
        end

        if extra_columns.any?
          # Filter out known virtual columns
          virtual_columns = [ "actions", "action_buttons" ]
          real_extra = extra_columns - virtual_columns

          if real_extra.any?
            puts "  ⚠️  #{real_extra.count} registered columns not in database: #{real_extra.join(', ')}"
            puts "      (These may need manual review)"
          end
        end

        puts "  ✅ Synced! Now has #{table.columns.count} registered columns (#{db_columns.count} in database)"
        synced_count += 1

      rescue => e
        puts "  ❌ Error: #{e.message}"
        error_count += 1
      end
    end

    puts "\n" + "=" * 80
    puts "✨ Sync complete!"
    puts "  ✅ Synced: #{synced_count}/#{total_tables}"
    puts "  ❌ Errors: #{error_count}" if error_count > 0
    puts "=" * 80
  end

  # Helper method to get actual table name from model class
  def get_actual_table_name(model_class)
    return nil unless model_class.present?

    # Map of model class names to their database table names
    table_mapping = {
      "FinancialTransaction" => "financial_transactions",
      "GoldStandardTable" => "gold_standard_table",
      "TrinityEntry" => "trinity_entries",
      "Trinity" => "trinity",
      "Construction" => "constructions",
      "PricebookItem" => "pricebook",
      "WhsSwms" => "whs_swms",
      "WhsActionItem" => "whs_action_items",
      "WhsInduction" => "whs_inductions",
      "WhsInspection" => "whs_inspections",
      "WhsIncident" => "whs_incidents",
      "User" => "users",
      "InspiringQuote" => "inspiring_quotes",
      "Contact" => "contacts",
      "Estimate" => "estimates",
      "PurchaseOrder" => "purchase_orders",
      "SmTask" => "sm_tasks",
      "SmResource" => "sm_resources",
      "SmTimeEntry" => "sm_time_entries",
      "PriceHistory" => "price_histories",
      "Job" => "jobs",
      "Supplier" => "suppliers"
    }

    table_mapping[model_class] || model_class.underscore.pluralize
  end

  # Map SQL types to valid column types (must match Column model validation)
  def map_sql_type_to_column_type(sql_type)
    case sql_type.downcase
    when /^character varying/, /^varchar/
      "single_line_text"
    when /^text/
      "multiple_lines_text"
    when /^integer/, /^bigint/, /^smallint/
      "whole_number"
    when /^numeric/, /^decimal/
      "currency"
    when /^double/, /^float/, /^real/
      "number"
    when /^boolean/
      "boolean"
    when /^date$/
      "date"
    when /^timestamp/, /^datetime/
      "date_and_time"
    when /^time$/
      "date_and_time"
    when /^json/, /^jsonb/
      "multiple_lines_text"
    else
      "single_line_text"
    end
  end
end
