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

  desc "Rename Contact folders from C{id} format to {id} - {name} format"
  task rename_contact_folders: :environment do
    puts "=" * 60
    puts "Contact Folder Rename Task"
    puts "Renames: C1310 -> 1310 - Contact Name"
    puts "=" * 60
    puts ""

    org = Organization.first
    provider = DocumentProviders.for_organization(org)

    unless provider.is_a?(DocumentProviders::S3Compatible)
      puts "ERROR: This task only works with S3-compatible storage."
      exit 1
    end

    # List all folders in Contacts/
    contacts_path = StorageConfiguration.instance.path_for(:contact) || "Contacts"
    puts "Scanning: #{contacts_path}/"
    puts ""

    result = provider.list_folder(contacts_path)
    folders = result.select { |item| item[:type] == :folder }

    puts "Found #{folders.count} folders"
    puts ""

    renamed = 0
    skipped = 0
    errors = 0

    folders.each do |folder|
      name = folder[:name]

      # Match C{id} pattern (e.g., C1310)
      if name =~ /^C(\d+)$/
        contact_id = $1.to_i
        contact = Contact.find_by(id: contact_id)

        if contact
          new_name = "#{contact_id} - #{contact.display_name}"
          old_path = "#{contacts_path}/#{name}"
          new_path = "#{contacts_path}/#{new_name}"

          puts "Renaming: #{name} -> #{new_name}"

          begin
            result = provider.rename_folder(old_path, new_path)
            if result[:success]
              puts "  ✓ Moved #{result[:moved_count]} objects"
              renamed += 1
            else
              puts "  ✗ Failed: #{result[:error]}"
              errors += 1
            end
          rescue => e
            puts "  ✗ Error: #{e.message}"
            errors += 1
          end
        else
          puts "Skipping: #{name} (Contact #{contact_id} not found)"
          skipped += 1
        end
      else
        # Already in correct format or unknown format
        skipped += 1
      end
    end

    puts ""
    puts "=" * 60
    puts "Complete!"
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
