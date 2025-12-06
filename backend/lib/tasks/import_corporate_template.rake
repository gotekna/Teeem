namespace :corporate do
  desc "Import Corporate Documents folder template"
  task import_template: :environment do
    puts "Creating Corporate Documents Folder Template"
    puts "=" * 80

    # Define the folder structure from Corporate File.xlsx spreadsheet
    folder_structure = {
      "Assets" => [ "Assets Register" ],
      "BAS" => [ "BAS" ],
      "Company Setup" => [ "Company Setup" ],
      "Constitution" => [ "Constitution" ],
      "General" => [
        "AGM Minutes",
        "AGM Solvency Minutes",
        "Appointment",
        "Certificate of Registration",
        "Change of Details",
        "Corporate Key",
        "Depreciation",
        "Distribution",
        "Dividends",
        "Officers",
        "PPSR",
        "Resignation",
        "Variation",
        "Winding Up"
      ],
      "Loans and Security" => [
        "Loan Agreement",
        "PPSR",
        "Security Deed",
        "UCC"
      ],
      "Minutes" => [
        "AGM Minutes",
        "AGM Solvency Minutes"
      ],
      "Register of Members" => [ "Register of Members" ],
      "Structure" => [ "Structure" ],
      "Trust Deed" => [
        "Deed of Variation",
        "Trust Deed"
      ]
    }

    # Create or find the template
    template = FolderTemplate.find_or_create_by!(name: "Corporate Documents")

    puts "Template: #{template.name}"
    puts "=" * 80

    # Clear existing items to start fresh
    template.folder_template_items.destroy_all

    # Create folder structure
    order_counter = 1
    folder_structure.sort.each do |folder_name, doc_types|
      # Skip the invalid "Folder" entry
      next if folder_name == "Folder"

      # Create parent folder (level 1)
      parent = FolderTemplateItem.create!(
        folder_template: template,
        name: folder_name,
        level: 1,
        order: order_counter,
        parent_id: nil,
        description: "#{folder_name} documents"
      )

      puts "\n📁 #{folder_name}"
      order_counter += 1

      # Create document types under this folder (level 2)
      sub_order = 1
      doc_types.sort.each do |doc_type|
        FolderTemplateItem.create!(
          folder_template: template,
          name: doc_type,
          level: 2,
          order: sub_order,
          parent_id: parent.id,
          description: nil
        )
        puts "  📄 #{doc_type}"
        sub_order += 1
      end
    end

    puts "\n" + "=" * 80
    puts "SUMMARY"
    puts "=" * 80
    puts "Template: #{template.name}"
    puts "Total folders: #{template.folder_template_items.where(level: 1).count}"
    puts "Total document types: #{template.folder_template_items.where(level: 2).count}"
    puts "Total items: #{template.folder_template_items.count}"

    puts "\n📋 Folder Structure:"
    template.folder_template_items.where(level: 1).order(:order).each do |folder|
      child_count = template.folder_template_items.where(parent_id: folder.id).count
      puts "  📁 #{folder.name} (#{child_count} document types)"
    end

    puts "\n✅ Corporate Documents template ready to use!"
    puts "\nThis template can now be applied to companies to create their document folder structure."
  end
end
