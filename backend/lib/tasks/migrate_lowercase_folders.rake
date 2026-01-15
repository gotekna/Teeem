# frozen_string_literal: true

require "cgi"

# Migrate lowercase folder duplicates to SSoT uppercase folders
# /jobs/* -> /Jobs/J{id}/*
# /corporate/* -> /Corporate/*
#
# Usage:
#   rake storage:migrate_lowercase_jobs              # Dry run
#   rake storage:migrate_lowercase_jobs[apply]      # Apply
#   rake storage:migrate_lowercase_corporate         # Dry run
#   rake storage:migrate_lowercase_corporate[apply] # Apply

namespace :storage do
  desc "Migrate /jobs (lowercase) to /Jobs with SSoT naming"
  task :migrate_lowercase_jobs, [:mode] => :environment do |_t, args|
    dry_run = args[:mode] != "apply"
    migrate_lowercase_folder(
      source_path: "/jobs",
      target_base: "/Jobs",
      code_column: :job_code,  # SSoT: Read from database column, NOT hardcoded
      model_class: Job,
      dry_run: dry_run
    )
  end

  desc "Migrate /corporate (lowercase) to /Corporate"
  task :migrate_lowercase_corporate, [:mode] => :environment do |_t, args|
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
    bucket = provider.instance_variable_get(:@bucket)
    client = provider.instance_variable_get(:@client)

    # List all files in /corporate
    puts "\nScanning /corporate folder..."
    items = provider.list_folder("/corporate", recursive: true)
    files = items.select { |i| i[:type] == :file }

    puts "Found #{files.count} files to migrate\n\n"

    migrated = 0
    errors = []

    files.each do |file|
      old_path = file[:path]
      # Simply change /corporate/ to /Corporate/
      new_path = old_path.sub(%r{^/corporate/}, "/Corporate/")

      if dry_run
        puts "MIGRATE: #{old_path}"
        puts "      -> #{new_path}"
        migrated += 1
      else
        begin
          old_key = old_path.sub(/^\//, "")
          new_key = new_path.sub(/^\//, "")

          # Copy
          encoded_source = "#{bucket}/#{CGI.escape(old_key).gsub('+', '%20')}"
          client.copy_object(
            bucket: bucket,
            copy_source: encoded_source,
            key: new_key
          )

          # Delete original
          client.delete_object(bucket: bucket, key: old_key)

          migrated += 1
          print "." if migrated % 100 == 0
        rescue => e
          errors << { file: old_path, error: e.message }
        end
      end
    end

    puts "\n\n" + "=" * 60
    puts "SUMMARY"
    puts "=" * 60
    puts dry_run ? "Would migrate: #{migrated}" : "Migrated: #{migrated}"
    puts "Errors: #{errors.count}"
    errors.first(10).each { |e| puts "  - #{e[:file]}: #{e[:error]}" }

    if dry_run && migrated > 0
      puts "\nTo apply changes, run:"
      puts "  rake storage:migrate_lowercase_corporate[apply]"
    end
  end

  desc "FAST parallel migration of /corporate to /Corporate (10 threads)"
  task :migrate_lowercase_corporate_fast, [:mode] => :environment do |_t, args|
    dry_run = args[:mode] != "apply"
    thread_count = 10

    puts "=" * 60
    puts dry_run ? "DRY RUN - No changes will be made" : "APPLYING CHANGES (#{thread_count} threads)"
    puts "=" * 60

    credential = S3CompatibleCredential.active.connected.first
    unless credential
      puts "ERROR: No S3/Wasabi credential configured"
      exit 1
    end

    provider = DocumentProviders::S3Compatible.new(credential)
    bucket = provider.instance_variable_get(:@bucket)

    # List all files in /corporate
    puts "\nScanning /corporate folder..."
    items = provider.list_folder("/corporate", recursive: true)
    files = items.select { |i| i[:type] == :file }

    puts "Found #{files.count} files to migrate"
    puts "Using #{thread_count} parallel threads\n\n"

    if dry_run
      files.first(10).each do |file|
        old_path = file[:path]
        new_path = old_path.sub(%r{^/corporate/}, "/Corporate/")
        puts "MIGRATE: #{old_path}"
        puts "      -> #{new_path}"
      end
      puts "... and #{files.count - 10} more" if files.count > 10
    else
      require "concurrent"

      migrated = Concurrent::AtomicFixnum.new(0)
      errors = Concurrent::Array.new

      pool = Concurrent::FixedThreadPool.new(thread_count)
      files.each do |file|
        pool.post do
          old_path = file[:path]
          new_path = old_path.sub(%r{^/corporate/}, "/Corporate/")

          begin
            old_key = old_path.sub(/^\//, "")
            new_key = new_path.sub(/^\//, "")

            # Each thread gets its own client (thread-safe)
            client = Aws::S3::Client.new(
              endpoint: credential.endpoint,
              region: credential.region,
              access_key_id: credential.access_key_id,
              secret_access_key: credential.secret_access_key,
              force_path_style: true
            )

            # Copy
            encoded_source = "#{bucket}/#{CGI.escape(old_key).gsub('+', '%20')}"
            client.copy_object(
              bucket: bucket,
              copy_source: encoded_source,
              key: new_key
            )

            # Delete original
            client.delete_object(bucket: bucket, key: old_key)

            count = migrated.increment
            print "." if count % 100 == 0
            print "[#{count}]" if count % 1000 == 0
          rescue => e
            errors << { file: old_path, error: e.message }
          end
        end
      end

      pool.shutdown
      pool.wait_for_termination

      puts "\n\n" + "=" * 60
      puts "SUMMARY"
      puts "=" * 60
      puts "Migrated: #{migrated.value}"
      puts "Errors: #{errors.count}"
      errors.first(10).each { |e| puts "  - #{e[:file]}: #{e[:error]}" }
    end

    if dry_run && files.count > 0
      puts "\nTo apply changes, run:"
      puts "  rake storage:migrate_lowercase_corporate_fast[apply]"
    end
  end

  def migrate_lowercase_folder(source_path:, target_base:, code_column:, model_class:, dry_run:)
    puts "=" * 60
    puts dry_run ? "DRY RUN - No changes will be made" : "APPLYING CHANGES"
    puts "=" * 60

    credential = S3CompatibleCredential.active.connected.first
    unless credential
      puts "ERROR: No S3/Wasabi credential configured"
      exit 1
    end

    provider = DocumentProviders::S3Compatible.new(credential)
    bucket = provider.instance_variable_get(:@bucket)
    client = provider.instance_variable_get(:@client)

    # List top-level folders in source
    puts "\nScanning #{source_path} folder..."
    items = provider.list_folder(source_path, recursive: false)
    folders = items.select { |i| i[:type] == :folder }

    puts "Found #{folders.count} folders\n\n"

    migrated_files = 0
    skipped = 0
    errors = []

    folders.each do |folder|
      folder_name = folder[:name]
      folder_path = folder[:path]

      # Extract ID from folder name (could be just number or number - name)
      record_id = folder_name.to_i
      if record_id == 0
        puts "SKIP: #{folder_name} - Cannot determine ID"
        skipped += 1
        next
      end

      # Check if record exists
      record = model_class.find_by(id: record_id)
      unless record
        puts "SKIP: #{folder_name} - #{model_class.name} ##{record_id} not found"
        skipped += 1
        next
      end

      # SSoT: Get target folder name from DATABASE COLUMN, not hardcoded
      target_folder = record.send(code_column)
      target_path = "#{target_base}/#{target_folder}"

      puts "MIGRATE: #{folder_path}"
      puts "      -> #{target_path}"

      # List all files in this folder
      file_items = provider.list_folder(folder_path, recursive: true)
      files = file_items.select { |i| i[:type] == :file }

      unless dry_run
        files.each do |file|
          old_file_path = file[:path]
          relative_path = old_file_path.sub(folder_path, "")
          new_file_path = "#{target_path}#{relative_path}"

          begin
            old_key = old_file_path.sub(/^\//, "")
            new_key = new_file_path.sub(/^\//, "")

            # Copy
            encoded_source = "#{bucket}/#{CGI.escape(old_key).gsub('+', '%20')}"
            client.copy_object(
              bucket: bucket,
              copy_source: encoded_source,
              key: new_key
            )

            # Delete original
            client.delete_object(bucket: bucket, key: old_key)

            migrated_files += 1
          rescue => e
            errors << { file: old_file_path, error: e.message }
          end
        end
        puts "      [DONE - #{files.count} files]"
      else
        migrated_files += files.count
      end
    end

    puts "\n" + "=" * 60
    puts "SUMMARY"
    puts "=" * 60
    puts dry_run ? "Would migrate: #{migrated_files} files" : "Migrated: #{migrated_files} files"
    puts "Skipped folders: #{skipped}"
    puts "Errors: #{errors.count}"
    errors.first(10).each { |e| puts "  - #{e[:file]}: #{e[:error]}" }
  end
end
