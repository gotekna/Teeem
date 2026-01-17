# frozen_string_literal: true

namespace :storage do
  desc "Rename Wasabi folders to match scope_folders config"
  task rename_folders: :environment do
    # SSoT: These renames sync actual Wasabi folders with StorageConfiguration.scope_folders
    renames = [
      ["Emails/eml", "Emails/Email Body"],
      ["Emails/attachments", "Emails/Attachments"],
      ["corporate", "Corporate"],
      ["people", "Corporate/People"],
      ["jobs", "Jobs"]
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

  desc "Clean up duplicate Contact folders - delete old formats if SSoT folder exists"
  task cleanup_contact_folders: :environment do
    puts "=" * 60
    puts "Contact Folder Cleanup Task"
    puts "SSoT: Deletes old C{id} and {id} - {name} folders if name-only exists"
    puts "=" * 60
    puts ""

    org = Organization.first
    provider = DocumentProviders.for_organization(org)

    unless provider.is_a?(DocumentProviders::S3Compatible)
      puts "ERROR: This task only works with S3-compatible storage."
      exit 1
    end

    client = provider.instance_variable_get(:@client)
    bucket = provider.instance_variable_get(:@bucket)

    contacts_path = StorageConfiguration.instance.path_for(:contact) || "Contacts"
    template = StorageConfiguration.instance.template_for(:contact) || "{{ContactName}}"
    puts "Contacts folder: #{contacts_path}/"
    puts "Target template: #{template}"
    puts ""

    # List all folders in Contacts
    resp = client.list_objects_v2(bucket: bucket, prefix: "#{contacts_path}/", delimiter: "/")
    folders = resp.common_prefixes&.map { |p| p.prefix.chomp("/").split("/").last } || []

    puts "Found #{folders.count} folders"
    puts ""

    # Group folders by contact
    contact_groups = {}

    folders.each do |name|
      contact_id = nil
      if name =~ /^C(\d+)$/
        contact_id = $1.to_i
      elsif name =~ /^(\d+)\s*-\s*(.+)$/
        contact_id = $1.to_i
      end

      if contact_id
        contact = Contact.find_by(id: contact_id)
        if contact
          target_name = contact.document_folder_name
          contact_groups[target_name] ||= { target: target_name, contact_id: contact_id, old_folders: [] }
          contact_groups[target_name][:old_folders] << name unless name == target_name
        end
      end
    end

    puts "Found #{contact_groups.count} contacts with potential duplicates"
    puts ""

    deleted = 0
    skipped = 0
    errors = 0

    contact_groups.each do |target_name, group|
      next if group[:old_folders].empty?

      # Check if SSoT folder exists
      target_prefix = "#{contacts_path}/#{target_name}/"
      target_resp = client.list_objects_v2(bucket: bucket, prefix: target_prefix, max_keys: 1)
      target_exists = target_resp.contents&.any?

      unless target_exists
        puts "Skipping #{target_name} - SSoT folder doesn't exist (would need migration)"
        skipped += group[:old_folders].count
        next
      end

      puts "Contact: #{target_name} (id: #{group[:contact_id]})"
      puts "  SSoT folder exists - deleting old duplicates:"

      group[:old_folders].each do |old_name|
        old_prefix = "#{contacts_path}/#{old_name}/"

        # Delete all objects with this prefix
        continuation_token = nil
        delete_count = 0

        loop do
          list_params = { bucket: bucket, prefix: old_prefix }
          list_params[:continuation_token] = continuation_token if continuation_token
          list_resp = client.list_objects_v2(list_params)

          objects = list_resp.contents || []
          break if objects.empty?

          # Delete objects in batch
          objects.each do |obj|
            begin
              client.delete_object(bucket: bucket, key: obj.key)
              delete_count += 1
            rescue => e
              puts "    ✗ Failed to delete #{obj.key}: #{e.message}"
              errors += 1
            end
          end

          break unless list_resp.is_truncated
          continuation_token = list_resp.next_continuation_token
        end

        puts "    ✓ Deleted #{old_name}/ (#{delete_count} objects)"
        deleted += 1
      end
      puts ""
    end

    puts "=" * 60
    puts "Complete!"
    puts "  Deleted: #{deleted} old folders"
    puts "  Skipped: #{skipped}"
    puts "  Errors: #{errors}"
    puts "=" * 60
  end

  desc "Clean up legacy root Attachments folder - migrate to Emails/Attachments"
  task cleanup_root_attachments: :environment do
    puts "=" * 60
    puts "Cleanup: Root Attachments Folder"
    puts "SSoT: Attachments belong under Emails/Attachments, not at root"
    puts "=" * 60
    puts ""

    org = Organization.first
    provider = DocumentProviders.for_organization(org)

    unless provider.is_a?(DocumentProviders::S3Compatible)
      puts "ERROR: This task only works with S3-compatible storage."
      exit 1
    end

    client = provider.instance_variable_get(:@client)
    bucket = provider.instance_variable_get(:@bucket)

    # Check if root Attachments folder exists
    root_prefix = "Attachments/"
    target_prefix = "Emails/Attachments/"

    puts "Scanning root '#{root_prefix}'..."
    root_resp = client.list_objects_v2(bucket: bucket, prefix: root_prefix, max_keys: 1000)
    root_objects = root_resp.contents || []

    if root_objects.empty?
      puts "✓ Root Attachments folder is empty or doesn't exist. Nothing to clean."
      exit 0
    end

    puts "Found #{root_objects.count} objects in root Attachments/"
    puts ""

    migrated = 0
    deleted_dupes = 0
    errors = 0

    root_objects.each do |obj|
      # Get filename from key (e.g., "Attachments/file.pdf" -> "file.pdf")
      filename = obj.key.sub(root_prefix, "")
      next if filename.blank? || filename.end_with?("/") # Skip folder markers

      target_key = "#{target_prefix}#{filename}"

      # Check if file exists in target location
      begin
        client.head_object(bucket: bucket, key: target_key)
        # File exists in target - delete the duplicate from root
        client.delete_object(bucket: bucket, key: obj.key)
        deleted_dupes += 1
        puts "  ✓ Deleted duplicate: #{filename}"
      rescue Aws::S3::Errors::NotFound
        # File doesn't exist in target - move it there
        begin
          # Copy to target
          client.copy_object(
            bucket: bucket,
            copy_source: "#{bucket}/#{obj.key}",
            key: target_key
          )
          # Delete from source
          client.delete_object(bucket: bucket, key: obj.key)
          migrated += 1
          puts "  ✓ Migrated: #{filename} → Emails/Attachments/"
        rescue => e
          puts "  ✗ Failed to migrate #{filename}: #{e.message}"
          errors += 1
        end
      rescue => e
        puts "  ✗ Error checking #{filename}: #{e.message}"
        errors += 1
      end
    end

    puts ""
    puts "=" * 60
    puts "Complete!"
    puts "  Migrated to Emails/Attachments: #{migrated}"
    puts "  Deleted duplicates: #{deleted_dupes}"
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
