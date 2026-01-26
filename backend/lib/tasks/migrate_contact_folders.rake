# frozen_string_literal: true

require "cgi"

# Migrate contact folders in Wasabi from old naming pattern to SSoT
# Old pattern: /Contacts/1310 - Principal Finance...
# New pattern: /Contacts/C1310 (from contact_code)
#
# Usage:
#   rake storage:migrate_contact_folders              # Dry run (shows what would change)
#   rake storage:migrate_contact_folders[apply]      # Actually rename folders

namespace :storage do
  desc "Migrate contact folders from old naming pattern to SSoT pattern"
  task :migrate_contact_folders, [:mode] => :environment do |_t, args|
    dry_run = args[:mode] != "apply"

    puts "=" * 60
    puts dry_run ? "DRY RUN - No changes will be made" : "APPLYING CHANGES"
    puts "=" * 60

    credential = S3CompatibleCredential.active.connected.first
    unless credential
      puts "ERROR: No S3/Wasabi credential configured"
      exit 1
    end

    provider = DocumentProviders::S3Compatible.new(credential)
    config = StorageConfiguration.instance
    contacts_base = config&.path_for(:contacts)&.sub(/^\//, "") || "Contacts"

    # List all folders in /Contacts/
    puts "\nScanning #{contacts_base} folder..."
    items = provider.list_folder("/#{contacts_base}", recursive: false)
    folders = items.select { |i| i[:type] == :folder }

    puts "Found #{folders.count} folders\n\n"

    migrated = 0
    skipped = 0
    errors = []

    folders.each do |folder|
      old_name = folder[:name]
      old_path = folder[:path]

      # Try to extract contact ID from folder name patterns:
      # Pattern 1: "C1310" (SSoT format - already correct)
      # Pattern 2: "1310 - Principal Finance" (old: id - name)
      # Pattern 3: "1310" (just number)

      contact_id = nil
      already_ssot = false

      if old_name =~ /^C(\d+)$/
        # Already in SSoT format (C + id)
        contact_id = $1.to_i
        already_ssot = true
      elsif old_name =~ /^(\d+)\s*-\s*/
        # Has " - " separator, extract the number part
        contact_id = $1.to_i
      elsif old_name =~ /^(\d+)$/
        # Just a number
        contact_id = $1.to_i
      end

      unless contact_id
        puts "SKIP: #{old_name} - Cannot determine contact ID"
        skipped += 1
        next
      end

      # If already in SSoT format, skip
      if already_ssot
        puts "OK: #{old_name} - Already SSoT format"
        skipped += 1
        next
      end

      contact = Contact.find_by(id: contact_id)
      unless contact
        puts "SKIP: #{old_name} - Contact ##{contact_id} not found in database"
        skipped += 1
        next
      end

      # Get the SSoT path using contact_code
      new_name = contact.contact_code
      new_path = "/#{contacts_base}/#{new_name}"

      if old_name == new_name
        puts "OK: #{old_name} - Already matches SSoT"
        skipped += 1
        next
      end

      puts "MIGRATE: #{old_name}"
      puts "      -> #{new_name}"

      unless dry_run
        begin
          # Rename folder by moving all contents
          rename_contact_folder(provider, old_path, new_path)
          migrated += 1
          puts "      [DONE]"
        rescue => e
          errors << { folder: old_name, error: e.message }
          puts "      [ERROR: #{e.message}]"
        end
      else
        migrated += 1
      end
    end

    puts "\n" + "=" * 60
    puts "SUMMARY"
    puts "=" * 60
    puts "Would migrate: #{migrated}" if dry_run
    puts "Migrated: #{migrated}" unless dry_run
    puts "Skipped: #{skipped}"
    puts "Errors: #{errors.count}"
    errors.each { |e| puts "  - #{e[:folder]}: #{e[:error]}" }

    if dry_run && migrated > 0
      puts "\nTo apply changes, run:"
      puts "  rake storage:migrate_contact_folders[apply]"
    end
  end

  def rename_contact_folder(provider, old_path, new_path)
    # In S3, "renaming" a folder means copying all objects then deleting originals
    items = provider.list_folder(old_path, recursive: true)
    bucket = provider.instance_variable_get(:@bucket)
    client = provider.instance_variable_get(:@client)

    items.each do |item|
      next unless item[:type] == :file

      old_key = item[:path].sub(/^\//, "") # Remove leading slash
      relative_path = item[:path].sub(old_path, "")
      new_key = "#{new_path}#{relative_path}".sub(/^\//, "")

      # Copy object - copy_source must be URL-encoded for special characters
      encoded_source = "#{bucket}/#{CGI.escape(old_key).gsub('+', '%20')}"
      client.copy_object(
        bucket: bucket,
        copy_source: encoded_source,
        key: new_key
      )

      # Delete original
      client.delete_object(
        bucket: bucket,
        key: old_key
      )
    end
  end
end
