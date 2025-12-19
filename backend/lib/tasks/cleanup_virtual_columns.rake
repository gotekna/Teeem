namespace :teeem do
  desc "Clean up registered columns that don't exist in the database (virtual/unused columns)"
  task cleanup_virtual_columns: :environment do
    puts "\n🧹 Cleaning up virtual columns from system table metadata..."
    puts "=" * 80

    # Get all system tables
    system_tables = Table.where(table_type: "system").order(:id)

    total_tables = system_tables.count
    cleaned_count = 0
    total_removed = 0

    system_tables.each_with_index do |table, index|
      begin
        puts "\n[#{index + 1}/#{total_tables}] #{table.icon} #{table.name} (ID: #{table.id})"

        # Get actual database table name
        actual_table_name = get_actual_table_name(table.model_class)

        unless actual_table_name && ActiveRecord::Base.connection.table_exists?(actual_table_name)
          puts "  ⚠️  Database table '#{actual_table_name}' not found - skipping"
          next
        end

        # Get actual database columns
        db_columns = ActiveRecord::Base.connection.columns(actual_table_name)
        db_column_names = db_columns.map(&:name)

        # Get registered columns
        registered_columns = table.columns

        # Find columns that are registered but not in database
        virtual_columns = registered_columns.reject do |col|
          db_column_names.include?(col.column_name)
        end

        if virtual_columns.empty?
          puts "  ✅ No virtual columns to remove"
          next
        end

        puts "  🗑️  Found #{virtual_columns.count} virtual columns to remove:"
        virtual_columns.each do |col|
          puts "     - #{col.name} (#{col.column_name})"
        end

        # Ask for confirmation (or auto-confirm in production)
        if ENV["AUTO_CONFIRM"] == "true"
          # Delete the virtual columns
          deleted_count = 0
          virtual_columns.each do |col|
            col.destroy
            deleted_count += 1
          end

          puts "  ✅ Removed #{deleted_count} virtual columns"
          cleaned_count += 1
          total_removed += deleted_count
        else
          puts "  ⏸️  Skipping (set AUTO_CONFIRM=true to delete)"
        end

      rescue => e
        puts "  ❌ Error: #{e.message}"
      end
    end

    puts "\n" + "=" * 80
    puts "✨ Cleanup complete!"
    puts "  📊 Tables processed: #{total_tables}"
    puts "  🧹 Tables cleaned: #{cleaned_count}"
    puts "  🗑️  Total columns removed: #{total_removed}"
    puts "=" * 80

    unless ENV["AUTO_CONFIRM"] == "true"
      puts "\n⚠️  DRY RUN MODE - No columns were actually deleted."
      puts "   To perform the cleanup, run: AUTO_CONFIRM=true rails teeem:cleanup_virtual_columns"
    end
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
end
