# frozen_string_literal: true

# Migrate job folders in Wasabi from old naming pattern to SSoT
# Old pattern: /Jobs/201 - 17 Redruth Road...
# New pattern: /Jobs/0201 (from StorageConfiguration.job_path)
#
# Usage:
#   rake storage:migrate_job_folders              # Dry run (shows what would change)
#   rake storage:migrate_job_folders[apply]      # Actually rename folders
#   rake storage:migrate_job_folder[201]         # Migrate single job by ID
#   rake storage:migrate_job_folder[201,apply]   # Migrate single job and apply

namespace :storage do
  desc "Migrate job folders from old naming pattern to SSoT pattern"
  task :migrate_job_folders, [:mode] => :environment do |_t, args|
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
    jobs_base = config&.path_for(:job) || "Jobs"

    # List all folders in /Jobs/
    puts "\nScanning #{jobs_base} folder..."
    items = provider.list_folder("/#{jobs_base}", recursive: false)
    folders = items.select { |i| i[:type] == :folder }

    puts "Found #{folders.count} folders\n\n"

    migrated = 0
    skipped = 0
    errors = []

    folders.each do |folder|
      old_name = folder[:name]
      old_path = folder[:path]

      # Try to extract job ID from old folder name patterns:
      # Pattern 1: "201 - 17 Redruth Road..." (id - title)
      # Pattern 2: "0201 - 17 Redruth Road..." (job_number - title)
      # Pattern 3: "0201" (already SSoT)

      job_id = nil
      if old_name =~ /^(\d+)\s*-\s*/
        # Has " - " separator, extract the number part
        job_id = $1.to_i
      elsif old_name =~ /^(\d+)$/
        # Just a number (already SSoT format)
        job_id = $1.to_i
      end

      unless job_id
        puts "SKIP: #{old_name} - Cannot determine job ID"
        skipped += 1
        next
      end

      job = Job.find_by(id: job_id)
      unless job
        puts "SKIP: #{old_name} - Job ##{job_id} not found in database"
        skipped += 1
        next
      end

      # Get the SSoT path
      new_path = config.job_path(job.job_code)
      new_name = File.basename(new_path)

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
          rename_folder(provider, old_path, new_path)
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
      puts "  rake storage:migrate_job_folders[apply]"
    end
  end

  desc "Migrate a single job folder"
  task :migrate_job_folder, [:job_id, :mode] => :environment do |_t, args|
    job_id = args[:job_id].to_i
    dry_run = args[:mode] != "apply"

    job = Job.find_by(id: job_id)
    unless job
      puts "ERROR: Job ##{job_id} not found"
      exit 1
    end

    credential = S3CompatibleCredential.active.connected.first
    provider = DocumentProviders::S3Compatible.new(credential)
    config = StorageConfiguration.instance

    # Get SSoT path
    new_path = config.job_path(job.job_code)
    new_name = File.basename(new_path)

    # Find existing folder (try various patterns)
    jobs_base = config&.path_for(:job) || "Jobs"
    possible_patterns = [
      "#{job.id} - #{job.title}",
      "#{job.id.to_s.rjust(3, '0')} - #{job.title}",
      job.job_code,
      job.id.to_s
    ]

    items = provider.list_folder("/#{jobs_base}", recursive: false)
    folders = items.select { |i| i[:type] == :folder }

    existing_folder = nil
    possible_patterns.each do |pattern|
      existing_folder = folders.find { |f| f[:name].start_with?(pattern.to_s[0..20]) }
      break if existing_folder
    end

    unless existing_folder
      puts "No existing folder found for job #{job_id}"
      puts "Searched patterns: #{possible_patterns.inspect}"
      exit 1
    end

    old_path = existing_folder[:path]
    old_name = existing_folder[:name]

    puts "Found: #{old_name}"
    puts "SSoT:  #{new_name}"

    if old_name == new_name
      puts "Already matches SSoT - nothing to do"
      exit 0
    end

    if dry_run
      puts "\nDry run - no changes made"
      puts "To apply: rake storage:migrate_job_folder[#{job_id},apply]"
    else
      puts "\nRenaming folder..."
      rename_folder(provider, old_path, new_path)
      puts "Done!"
    end
  end

  def rename_folder(provider, old_path, new_path)
    # In S3, "renaming" a folder means copying all objects then deleting originals
    # List all objects with the old prefix
    items = provider.list_folder(old_path, recursive: true)

    items.each do |item|
      next unless item[:type] == :file

      old_key = item[:path].sub(/^\//, "") # Remove leading slash
      relative_path = item[:path].sub(old_path, "")
      new_key = "#{new_path}#{relative_path}".sub(/^\//, "")

      # Copy object
      provider.instance_variable_get(:@client).copy_object(
        bucket: provider.instance_variable_get(:@bucket),
        copy_source: "#{provider.instance_variable_get(:@bucket)}/#{old_key}",
        key: new_key
      )

      # Delete original
      provider.instance_variable_get(:@client).delete_object(
        bucket: provider.instance_variable_get(:@bucket),
        key: old_key
      )
    end
  end
end
