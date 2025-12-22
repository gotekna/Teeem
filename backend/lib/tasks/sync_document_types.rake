namespace :sync do
  desc "Sync DocumentTypes from JSON file"
  task document_types: :environment do
    require 'json'

    file_path = Rails.root.join('tmp', 'document_types_export.json')
    unless File.exist?(file_path)
      puts "Error: #{file_path} not found"
      exit 1
    end

    doc_types_data = JSON.parse(File.read(file_path))
    puts "Syncing #{doc_types_data.count} document types..."

    created = 0
    updated = 0

    doc_types_data.each do |dt|
      doc_type = DocumentType.find_or_initialize_by(name: dt['name'])
      was_new = doc_type.new_record?

      doc_type.assign_attributes(
        folder: dt['folder'],
        description: dt['description'],
        category: dt['category'],
        requires_filing: dt['requires_filing'],
        retention_years: dt['retention_years'],
        active: dt['active'],
        tabs: dt['tabs'],
        primary_tab: dt['primary_tab'],
        name_format: dt['name_format'],
        file_name: dt['file_name'],
        abbreviation: dt['abbreviation'],
        aliases: dt['aliases'],
        display_name: dt['display_name'],
        scope: dt['scope'],
        file_extensions: dt['file_extensions'],
        target_folder: dt['target_folder']
      )
      doc_type.save!

      was_new ? created += 1 : updated += 1
    end

    puts "Created #{created} document types, updated #{updated} document types"
    puts "Done!"
  end
end
