namespace :documentation do
  desc "Backfill construction documentation tabs from global categories for all existing jobs"
  task backfill_tabs: :environment do
    puts "Starting backfill of documentation tabs..."

    categories = DocumentationCategory.active.ordered
    constructions = Construction.all

    puts "Found #{categories.count} categories and #{constructions.count} constructions"

    created_count = 0
    skipped_count = 0

    constructions.find_each do |construction|
      categories.each do |category|
        # Skip if this tab already exists for this construction
        if construction.construction_documentation_tabs.exists?(name: category.name)
          skipped_count += 1
          next
        end

        construction.construction_documentation_tabs.create!(
          name: category.name,
          icon: category.icon,
          color: category.color,
          description: category.description,
          sequence_order: category.sequence_order,
          is_active: true
        )

        created_count += 1
        print "."
      end
    end

    puts "\n\nBackfill complete!"
    puts "Created: #{created_count} tabs"
    puts "Skipped: #{skipped_count} (already existed)"
  end

  desc "Sync a specific category to all jobs (pass NAME='Category Name')"
  task sync_category: :environment do
    category_name = ENV["NAME"]

    unless category_name
      puts "ERROR: Please provide NAME='Category Name'"
      exit 1
    end

    category = DocumentationCategory.find_by(name: category_name)

    unless category
      puts "ERROR: Category '#{category_name}' not found"
      exit 1
    end

    puts "Syncing category '#{category.name}' to all jobs..."

    created_count = 0
    skipped_count = 0

    Construction.find_each do |construction|
      if construction.construction_documentation_tabs.exists?(name: category.name)
        skipped_count += 1
        next
      end

      construction.construction_documentation_tabs.create!(
        name: category.name,
        icon: category.icon,
        color: category.color,
        description: category.description,
        sequence_order: category.sequence_order,
        is_active: true
      )

      created_count += 1
      print "."
    end

    puts "\n\nSync complete!"
    puts "Created: #{created_count} tabs"
    puts "Skipped: #{skipped_count} (already existed)"
  end
end
