# frozen_string_literal: true

# Storage Path Normalization - Move files from lowercase to uppercase folder names
#
# This fixes the mismatch between:
# - SCOPE_FOLDERS: "job" => "Jobs" (uppercase)
# - Actual files: stored in "jobs/" (lowercase)
#
# Usage:
#   # Dry run (preview changes)
#   rails storage:normalize_paths
#
#   # Actually move files
#   rails storage:normalize_paths[execute]
#
#   # Move specific type only
#   rails storage:normalize_paths[execute,JobDocument]
#
namespace :storage do
  desc "Normalize storage paths from lowercase to uppercase (matches SCOPE_FOLDERS)"
  task :normalize_paths, [:mode, :document_type] => :environment do |_t, args|
    mode = args[:mode] || "dry_run"
    document_type_filter = args[:document_type]
    execute = mode == "execute"

    puts "=" * 70
    puts "Storage Path Normalization"
    puts "Mode: #{execute ? 'EXECUTE' : 'DRY RUN (preview only)'}"
    puts "=" * 70
    puts ""

    # SSoT: Get correct folder names from StorageConfiguration
    storage_config = StorageConfiguration.instance

    # Mapping of lowercase to uppercase (from SCOPE_FOLDERS)
    path_mappings = {
      "jobs" => storage_config.path_for(:job),      # "Jobs"
      "corporate" => storage_config.path_for(:corporate),  # "Corporate"
      "people" => storage_config.path_for(:people)  # "Corporate/People"
    }

    puts "Path mappings (lowercase → uppercase):"
    path_mappings.each { |from, to| puts "  #{from}/ → #{to}/" }
    puts ""

    # Get S3 provider
    organization = Organization.first
    provider = DocumentProviders::S3Compatible.for_organization(organization)

    total_moved = 0
    total_errors = 0
    total_skipped = 0

    # Process each document type
    document_types = {
      "JobDocument" => { model: JobDocument, base_from: "jobs", base_to: "Jobs" },
      "CorporateCompanyDocument" => { model: CorporateCompanyDocument, base_from: "corporate", base_to: "Corporate" },
      "PeopleDocument" => { model: PeopleDocument, base_from: "people", base_to: "Corporate/People" }
    }

    document_types.each do |type_name, config|
      next if document_type_filter.present? && type_name != document_type_filter

      model = config[:model]
      base_from = config[:base_from]
      base_to = config[:base_to]

      puts "-" * 70
      puts "Processing #{type_name}"
      puts "-" * 70

      # Find documents with lowercase paths that need updating
      documents = model.where(storage_provider: "s3_compatible")
                       .where("storage_path LIKE ?", "#{base_from}/%")
                       .or(model.where(storage_provider: "s3_compatible")
                                .where("storage_path LIKE ?", "/#{base_from}/%"))

      count = documents.count
      puts "Found #{count} documents with '#{base_from}/' paths"

      if count == 0
        puts "  No documents to process"
        next
      end

      documents.find_each.with_index do |doc, index|
        old_path = doc.storage_path

        # Calculate new path (replace lowercase base with uppercase)
        new_path = old_path.sub(%r{^/?#{base_from}/}, "#{base_to}/")

        if old_path == new_path
          total_skipped += 1
          next
        end

        # Progress indicator
        if (index + 1) % 100 == 0 || index == 0
          puts "  Progress: #{index + 1}/#{count}"
        end

        if execute
          begin
            # Move file to new location (copy + delete in one operation)
            # Extract destination folder and filename for move_file API
            dest_folder = File.dirname(new_path)
            filename = File.basename(new_path)

            provider.move_file(old_path, dest_folder, filename)

            # Update database record
            doc.update_column(:storage_path, new_path)

            total_moved += 1
          rescue StandardError => e
            puts "  ERROR #{doc.id}: #{e.message}"
            total_errors += 1
          end
        else
          # Dry run - just show what would happen
          if index < 5
            puts "  Would move: #{old_path}"
            puts "          to: #{new_path}"
          elsif index == 5
            puts "  ... and #{count - 5} more"
          end
          total_moved += 1
        end
      end
    end

    puts ""
    puts "=" * 70
    puts "Summary"
    puts "=" * 70
    puts "Total files #{execute ? 'moved' : 'to move'}: #{total_moved}"
    puts "Total errors: #{total_errors}" if execute
    puts "Total skipped (already correct): #{total_skipped}"
    puts ""

    unless execute
      puts "To execute the migration, run:"
      puts "  rails storage:normalize_paths[execute]"
      puts ""
      puts "Or for a specific document type:"
      puts "  rails storage:normalize_paths[execute,JobDocument]"
    end
  end

  desc "Check storage path consistency"
  task check_paths: :environment do
    puts "=" * 70
    puts "Storage Path Consistency Check"
    puts "=" * 70
    puts ""

    # Check SCOPE_FOLDERS
    puts "SCOPE_FOLDERS (expected paths):"
    %w[job corporate people task].each do |scope|
      puts "  #{scope}: #{StorageConfiguration::SCOPE_FOLDERS[scope]}"
    end
    puts ""

    # Check actual database paths
    puts "Actual database storage_path prefixes:"

    {
      "JobDocument" => JobDocument,
      "CorporateCompanyDocument" => CorporateCompanyDocument,
      "PeopleDocument" => PeopleDocument
    }.each do |name, model|
      paths = model.where(storage_provider: "s3_compatible")
                   .where.not(storage_path: [nil, ""])
                   .pluck(:storage_path)

      prefixes = paths.map { |p| p.gsub(%r{^/}, "").split("/").first }.compact.tally.sort_by { |_, v| -v }

      puts "  #{name}:"
      prefixes.first(5).each { |prefix, count| puts "    #{prefix}: #{count} files" }
      puts ""
    end

    # Check S3 folders
    puts "Actual S3 folder counts:"
    org = Organization.first
    provider = DocumentProviders::S3Compatible.for_organization(org)

    %w[Jobs jobs Corporate corporate people Tasks Emails Users Warehousing].each do |folder|
      begin
        files = provider.list_folder(folder, recursive: true) rescue []
        file_count = files.select { |f| f[:type] == :file }.count
        puts "  #{folder}: #{file_count} files"
      rescue => e
        puts "  #{folder}: ERROR - #{e.message}"
      end
    end
  end
end
