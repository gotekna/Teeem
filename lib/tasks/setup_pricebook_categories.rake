namespace :trapid do
  namespace :pricebook do
    desc "Seed pricebook_categories from existing pricebook_items.category values"
    task seed_categories: :environment do
      puts "Seeding pricebook categories from existing data..."

      # Get all unique category values from pricebook_items
      existing_categories = PricebookItem.where.not(category: [nil, '']).distinct.pluck(:category).sort

      puts "Found #{existing_categories.count} unique categories in pricebook_items"

      created_count = 0
      skipped_count = 0

      existing_categories.each_with_index do |category_name, index|
        # Skip if already exists
        if PricebookCategory.exists?(name: category_name)
          puts "  - Skipping '#{category_name}' (already exists)"
          skipped_count += 1
          next
        end

        PricebookCategory.create!(
          name: category_name,
          display_name: category_name.titleize,
          position: index + 1,
          is_active: true
        )
        puts "  + Created '#{category_name}'"
        created_count += 1
      end

      puts "\nSummary:"
      puts "  - Created: #{created_count}"
      puts "  - Skipped: #{skipped_count}"
      puts "  - Total categories: #{PricebookCategory.count}"
    end

    desc "Register pricebook_categories table in the Tables system"
    task register_table: :environment do
      puts "Registering pricebook_categories in Tables system..."

      # Check if table already exists
      existing = Table.find_by(database_table_name: 'pricebook_categories')
      if existing
        puts "Table already registered with ID #{existing.id}"
        return
      end

      # Create the table record
      table = Table.create!(
        name: 'Price Book Categories',
        slug: 'pricebook-categories',
        singular_name: 'Category',
        plural_name: 'Categories',
        database_table_name: 'pricebook_categories',
        icon: '📁',
        title_column: 'name',
        searchable: true,
        description: 'Categories for organizing price book items',
        is_live: true,
        table_type: 'system',
        api_endpoint: '/api/v1/pricebook_categories'
      )

      puts "Created table with ID: #{table.id}"

      # Create columns for this table
      columns = [
        { name: 'Name', column_name: 'name', column_type: 'single_line_text', required: true, is_title: true, searchable: true, position: 0 },
        { name: 'Display Name', column_name: 'display_name', column_type: 'single_line_text', required: false, searchable: true, position: 1 },
        { name: 'Color', column_name: 'color', column_type: 'color_picker', required: false, position: 2 },
        { name: 'Icon', column_name: 'icon', column_type: 'single_line_text', required: false, position: 3 },
        { name: 'Position', column_name: 'position', column_type: 'whole_number', required: false, position: 4 },
        { name: 'Active', column_name: 'is_active', column_type: 'boolean', required: false, position: 5 },
        { name: 'Created', column_name: 'created_at', column_type: 'date_and_time', required: false, position: 6 },
        { name: 'Updated', column_name: 'updated_at', column_type: 'date_and_time', required: false, position: 7 }
      ]

      columns.each do |col_attrs|
        Column.create!(col_attrs.merge(table_id: table.id))
        puts "  + Created column: #{col_attrs[:name]}"
      end

      puts "\nTable registered successfully!"
      puts "Access at: /tables/#{table.id}"
    end

    desc "Add category_id to pricebook_items and backfill from category text"
    task backfill_category_ids: :environment do
      puts "Backfilling category_id in pricebook_items..."

      # First, ensure all categories exist
      Rake::Task['trapid:pricebook:seed_categories'].invoke

      # Build a lookup hash for faster processing
      category_lookup = PricebookCategory.pluck(:name, :id).to_h

      updated_count = 0
      skipped_count = 0
      not_found_count = 0

      PricebookItem.find_each do |item|
        if item.category.blank?
          skipped_count += 1
          next
        end

        category_id = category_lookup[item.category]
        if category_id.nil?
          puts "  ! Category not found: '#{item.category}' (item: #{item.item_code})"
          not_found_count += 1
          next
        end

        # Update directly without callbacks to speed up bulk operation
        item.update_column(:category_id, category_id)
        updated_count += 1

        print "." if updated_count % 100 == 0
      end

      puts "\n\nSummary:"
      puts "  - Updated: #{updated_count}"
      puts "  - Skipped (no category): #{skipped_count}"
      puts "  - Not found: #{not_found_count}"
    end

    desc "Update pricebook_items.category column to lookup type"
    task update_category_column: :environment do
      puts "Updating category column type to lookup..."

      # Find the pricebook_items table
      pricebook_table = Table.find_by(database_table_name: 'pricebook_items')
      unless pricebook_table
        puts "ERROR: pricebook_items table not found in Tables system"
        return
      end

      # Find the categories table
      categories_table = Table.find_by(database_table_name: 'pricebook_categories')
      unless categories_table
        puts "ERROR: pricebook_categories table not found. Run 'rake trapid:pricebook:register_table' first."
        return
      end

      # Find or create the category column
      category_column = pricebook_table.columns.find_by(column_name: 'category')
      unless category_column
        puts "ERROR: category column not found in pricebook_items"
        return
      end

      # Update the column to be a lookup
      category_column.update!(
        column_type: 'lookup',
        lookup_table_id: categories_table.id,
        lookup_display_column: 'name'
      )

      puts "Category column updated to lookup type"
      puts "  - Lookup table ID: #{categories_table.id}"
      puts "  - Display column: name"
    end

    desc "Run all pricebook category setup tasks"
    task setup: :environment do
      puts "=" * 60
      puts "SETTING UP PRICEBOOK CATEGORIES"
      puts "=" * 60

      Rake::Task['trapid:pricebook:seed_categories'].invoke
      puts "\n"

      Rake::Task['trapid:pricebook:register_table'].invoke
      puts "\n"

      # Only run backfill if category_id column exists
      if ActiveRecord::Base.connection.column_exists?(:pricebook_items, :category_id)
        Rake::Task['trapid:pricebook:backfill_category_ids'].invoke
        puts "\n"

        Rake::Task['trapid:pricebook:update_category_column'].invoke
      else
        puts "NOTE: category_id column doesn't exist yet. Run migration first:"
        puts "  rails db:migrate"
        puts "Then run:"
        puts "  rake trapid:pricebook:backfill_category_ids"
        puts "  rake trapid:pricebook:update_category_column"
      end

      puts "\n"
      puts "=" * 60
      puts "SETUP COMPLETE!"
      puts "=" * 60
    end
  end
end
