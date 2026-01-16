# frozen_string_literal: true

namespace :storage do
  desc "Rename Wasabi folders to match scope_folders config"
  task rename_folders: :environment do
    # SSoT: These renames sync actual Wasabi folders with StorageConfiguration.scope_folders
    renames = [
      ["Emails/eml", "Emails/Email Body"],
      ["Emails/attachments", "Emails/Attachments"],
      ["corporate", "Corporate"],
      ["people", "Corporate/People"]
    ]

    puts "=" * 60
    puts "Storage Folder Rename Task"
    puts "=" * 60
    puts ""

    # Get the S3 provider
    org = Organization.first
    provider = DocumentProviders.for_organization(org)

    unless provider.is_a?(DocumentProviders::S3Compatible)
      puts "ERROR: This task only works with S3-compatible storage (Wasabi)."
      puts "Current provider: #{provider.class.name}"
      exit 1
    end

    puts "Provider: #{provider.class.name}"
    puts "Bucket: #{StorageConfiguration.instance.connection_config['bucket']}"
    puts ""

    total_moved = 0

    renames.each do |old_path, new_path|
      puts "Renaming: #{old_path} -> #{new_path}"
      result = provider.rename_folder(old_path, new_path)

      if result[:success]
        puts "  ✓ Moved #{result[:moved_count]} objects"
        total_moved += result[:moved_count]
      else
        puts "  ✗ Failed: #{result[:error]}"
      end
      puts ""
    end

    puts "=" * 60
    puts "Complete! Total objects moved: #{total_moved}"
    puts "=" * 60
  end

  desc "Merge & rename Contact folders to SSoT format (Contact#document_folder_name)"
  task rename_contact_folders: :environment do
    puts "=" * 60
    puts "Contact Folder Merge & Rename Task"
    puts "SSoT: Uses Contact#document_folder_name for target format"
    puts "=" * 60
    puts ""

    org = Organization.first
    provider = DocumentProviders.for_organization(org)

    unless provider.is_a?(DocumentProviders::S3Compatible)
      puts "ERROR: This task only works with S3-compatible storage."
      exit 1
    end

    contacts_path = StorageConfiguration.instance.path_for(:contact) || "Contacts"
    template = StorageConfiguration.instance.template_for(:contact) || "{{ContactName}}"
    puts "Contacts folder: #{contacts_path}/"
    puts "Target template: #{template}"
    puts ""

    result = provider.list_folder(contacts_path)
    folders = result.select { |item| item[:type] == :folder }

    puts "Found #{folders.count} folders"
    puts ""

    # Group folders by contact ID
    # Patterns to match:
    #   C{id} -> contact_id
    #   {id} - {name} -> contact_id
    #   {name} only -> skip (already in target format if no ID prefix)
    contact_folders = {}

    folders.each do |folder|
      name = folder[:name]

      contact_id = nil
      if name =~ /^C(\d+)$/
        # C1310 format
        contact_id = $1.to_i
      elsif name =~ /^(\d+)\s*-\s*.+$/
        # 1310 - Principal Finance format
        contact_id = $1.to_i
      end

      if contact_id
        contact_folders[contact_id] ||= []
        contact_folders[contact_id] << name
      end
    end

    puts "Found #{contact_folders.keys.count} contacts with folders to process"
    puts ""

    merged = 0
    renamed = 0
    skipped = 0
    errors = 0

    contact_folders.each do |contact_id, folder_names|
      contact = Contact.find_by(id: contact_id)

      unless contact
        puts "Skipping contact #{contact_id} (not found in database)"
        folder_names.each { |n| puts "  - #{n}" }
        skipped += folder_names.count
        next
      end

      # SSoT: Get target folder name from Contact model
      target_name = contact.document_folder_name
      target_path = "#{contacts_path}/#{target_name}"

      puts "Contact #{contact_id}: #{contact.display_name}"
      puts "  Target: #{target_name}"
      puts "  Source folders: #{folder_names.join(', ')}"

      # Check if any folder already has the target name
      already_correct = folder_names.include?(target_name)

      folder_names.each do |source_name|
        next if source_name == target_name # Skip if already correct

        source_path = "#{contacts_path}/#{source_name}"

        begin
          # Move/merge folder contents to target
          rename_result = provider.rename_folder(source_path, target_path)

          if rename_result[:success]
            if rename_result[:moved_count] > 0
              puts "  ✓ Merged #{source_name} -> #{target_name} (#{rename_result[:moved_count]} objects)"
              merged += 1
            else
              puts "  ✓ Renamed #{source_name} -> #{target_name}"
              renamed += 1
            end
          else
            puts "  ✗ Failed #{source_name}: #{rename_result[:error]}"
            errors += 1
          end
        rescue => e
          puts "  ✗ Error #{source_name}: #{e.message}"
          errors += 1
        end
      end

      puts ""
    end

    puts "=" * 60
    puts "Complete!"
    puts "  Merged: #{merged}"
    puts "  Renamed: #{renamed}"
    puts "  Skipped: #{skipped}"
    puts "  Errors: #{errors}"
    puts "=" * 60
  end

  desc "List contents of a storage folder"
  task :list_folder, [:path] => :environment do |_t, args|
    path = args[:path] || "/"
    org = Organization.first
    provider = DocumentProviders.for_organization(org)

    puts "Listing: #{path}"
    puts "-" * 40

    result = provider.list_folder(path)
    result[:items].each do |item|
      prefix = item[:type] == "folder" ? "[DIR]" : "[FILE]"
      puts "#{prefix} #{item[:name]}"
    end
  end
end
