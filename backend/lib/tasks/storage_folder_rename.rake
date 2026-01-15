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
