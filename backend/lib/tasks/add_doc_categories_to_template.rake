namespace :teeem do
  desc "Add documentation categories as folders to a folder template"
  task :add_doc_categories_to_template, [ :template_id ] => :environment do |t, args|
    template_id = args[:template_id] || 34  # Default to Sam Test template

    template = FolderTemplate.find(template_id)
    puts "Template: #{template.name} (ID: #{template.id})"

    categories = DocumentationCategory.active.ordered
    puts "\nDocumentation Categories to add:"
    categories.each { |c| puts "  - #{c.name}" }

    max_order = template.folder_template_items.where(parent_id: nil).maximum(:order) || 0
    puts "\nCurrent max order: #{max_order}"

    added = 0
    skipped = 0

    categories.each_with_index do |cat, index|
      if template.folder_template_items.exists?(name: cat.name)
        puts "Skipping #{cat.name} (already exists)"
        skipped += 1
        next
      end

      item = template.folder_template_items.create!(
        name: cat.name,
        level: 0,
        order: max_order + index + 1,
        description: cat.description
      )
      puts "Created: #{item.name} (order: #{item.order})"
      added += 1
    end

    puts "\n✓ Done! Added: #{added}, Skipped: #{skipped}"
    puts "\nUpdated folder structure:"
    template.folder_template_items.where(parent_id: nil).order(:order).each do |item|
      puts "  #{item.order}. #{item.name}"
    end
  end
end
