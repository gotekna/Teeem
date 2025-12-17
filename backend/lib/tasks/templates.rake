# frozen_string_literal: true

namespace :templates do
  desc "List all document templates and their SharePoint paths"
  task list: :environment do
    puts "\n=== Document Templates ===\n\n"
    puts format("%-4s %-40s %s", "ID", "Name", "SharePoint Path")
    puts "-" * 100

    DocumentTemplate.order(:id).each do |t|
      puts format("%-4d %-40s %s", t.id, t.name.truncate(38), t.sharepoint_path || "(not linked)")
    end
    puts "\n"
  end

  desc "Copy templates to new folder structure in SharePoint"
  task migrate_to_folders: :environment do
    # Folder structure mapping
    # Format: template_id => { folder: destination_folder, filename: new_filename }
    migrations = {
      # Contract documents
      27 => { folder: "Templates/Contract", filename: "qbcc-contract.docx" },
      26 => { folder: "Templates/Contract", filename: "qbcc-general-conditions.docx" },
      25 => { folder: "Templates/Contract", filename: "qbcc-consumer-building-guide.docx" },

      # Letters
      24 => { folder: "Templates/Letters", filename: "welcome-letter.docx" },

      # Forms
      29 => { folder: "Templates/Forms", filename: "owners-authority.docx" },
      32 => { folder: "Templates/Forms", filename: "colour-selections.docx" },
      30 => { folder: "Templates/Forms", filename: "spec-acknowledgement.docx" },

      # Specifications
      28 => { folder: "Templates/Specifications", filename: "specifications.docx" },
      31 => { folder: "Templates/Specifications", filename: "termite-protection.docx" }
    }

    puts "\n=== Migrating Templates to New Folder Structure ===\n\n"

    graph_client = MicrosoftAppGraphClient.new

    migrations.each do |id, config|
      template = DocumentTemplate.find_by(id: id)
      next unless template&.sharepoint_linked?

      puts "#{template.name}:"
      puts "  FROM: #{template.sharepoint_path}"
      puts "  TO:   #{config[:folder]}/#{config[:filename]}"

      begin
        # Copy file to new location
        new_item = graph_client.copy_file(
          drive_id: template.sharepoint_drive_id,
          item_id: template.sharepoint_item_id,
          destination_folder_path: config[:folder],
          new_name: config[:filename]
        )

        # Update database with new path and item_id
        new_path = "#{config[:folder]}/#{config[:filename]}"
        template.update!(
          sharepoint_path: new_path,
          sharepoint_item_id: new_item["id"]
        )

        puts "  ✓ Copied and updated!"
      rescue StandardError => e
        puts "  ✗ ERROR: #{e.message}"
      end

      puts ""
    end

    puts "=== Migration Complete ===\n\n"
  end

  desc "Update template paths (manual - after moving files yourself)"
  task reorganize: :environment do
    # New folder structure mapping
    # Format: template_id => new_path
    new_paths = {
      # Contract documents
      27 => "Templates/Contract/qbcc-contract.docx",
      26 => "Templates/Contract/qbcc-general-conditions.docx",
      25 => "Templates/Contract/qbcc-consumer-building-guide.docx",

      # Letters
      24 => "Templates/Letters/welcome-letter.docx",

      # Forms
      29 => "Templates/Forms/owners-authority.docx",
      32 => "Templates/Forms/colour-selections.docx",
      30 => "Templates/Forms/spec-acknowledgement.docx",

      # Specifications
      28 => "Templates/Specifications/specifications.docx",
      31 => "Templates/Specifications/termite-protection.docx"
    }

    puts "\n=== Updating Template Paths ===\n\n"
    puts "⚠️  Make sure you've moved the files in SharePoint FIRST!\n\n"

    new_paths.each do |id, new_path|
      template = DocumentTemplate.find_by(id: id)
      next unless template

      old_path = template.sharepoint_path
      puts "#{template.name}:"
      puts "  OLD: #{old_path}"
      puts "  NEW: #{new_path}"

      # Uncomment to actually update:
      # template.update!(sharepoint_path: new_path)
      # puts "  ✓ Updated!"

      puts ""
    end

    puts "="*50
    puts "DRY RUN COMPLETE"
    puts "To actually update, edit the rake task and uncomment the update! line"
    puts "="*50
  end

  desc "Update a single template path"
  task :update_path, [:id, :new_path] => :environment do |_t, args|
    template = DocumentTemplate.find(args[:id])
    old_path = template.sharepoint_path

    puts "\nUpdating: #{template.name}"
    puts "  OLD: #{old_path}"
    puts "  NEW: #{args[:new_path]}"

    template.update!(sharepoint_path: args[:new_path])
    puts "  ✓ Updated!\n\n"
  end

  desc "Verify all templates are accessible in SharePoint"
  task verify: :environment do
    puts "\n=== Verifying Template Access ===\n\n"

    graph_client = MicrosoftAppGraphClient.new

    DocumentTemplate.where.not(sharepoint_item_id: nil).each do |template|
      print "#{template.name.truncate(40).ljust(42)}"

      begin
        graph_client.get_drive_item_content(
          site_id: template.sharepoint_site_id,
          drive_id: template.sharepoint_drive_id,
          item_id: template.sharepoint_item_id
        )
        puts "✓ OK"
      rescue StandardError => e
        puts "✗ ERROR: #{e.message.truncate(50)}"
      end
    end

    puts "\n"
  end
end
