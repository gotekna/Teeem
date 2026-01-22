# frozen_string_literal: true

# S3 Legacy Folder Cleanup - Migrate legacy files to StorageBlob, then delete legacy folders
#
# Background:
#   Legacy documents were stored in flat S3 folders: Jobs/, Contacts/, Corporate/, etc.
#   The new SSoT is StorageBlob with content-hash deduplication in Blobs/ folder.
#
# This migration:
#   1. Downloads legacy files from old S3 paths
#   2. Creates StorageBlob entries (deduplicates via content_hash)
#   3. Links documents to storage_blob_id
#   4. Creates WarehouseDocument entries where missing
#   5. Deletes legacy S3 folders after all files migrated
#
# After cleanup, only the Blobs/ folder should remain in S3.
#
# Usage:
#   # Preview what needs migration
#   rails storage:preview_legacy
#
#   # Run migration (will take ~30 mins for ~11k files)
#   rails storage:migrate_legacy_to_blobs
#
#   # Delete legacy folders (only after migration complete)
#   rails storage:delete_legacy_folders
#

# Helper module for migration methods (must be outside namespace for Rake)
module StorageMigrationHelpers
  module_function

  def migrate_document(doc, provider, stats, model_name)
    return if doc.storage_path.blank?

    begin
      # Download content from legacy S3 path
      content = provider.download_file(doc.storage_path)

      unless content.present?
        stats[:skipped] += 1
        return
      end

      # Determine content type
      content_type = case model_name
      when "JobDocument"
        doc.mime_type
      when "CorporateCompanyDocument"
        doc.content_type
      when "ContactDocument"
        doc.content_type
      end

      # Find or create StorageBlob (deduplicates via content_hash)
      blob = StorageBlob.find_or_create_for_content!(
        content,
        filename: doc.file_name,
        content_type: content_type
      )

      # Track if we reused an existing blob
      if blob.reference_count > 0
        stats[:already_exists] += 1
      end

      # Update document with blob reference
      doc.update!(storage_blob: blob)
      blob.increment_reference!

      # Create WarehouseDocument entry if missing
      unless doc.warehouse_document
        create_warehouse_entry(doc, blob, model_name)
      else
        # Update existing warehouse entry to use blob
        doc.warehouse_document.update!(storage_blob: blob) if doc.warehouse_document.storage_blob_id.nil?
      end

      stats[:migrated] += 1

    rescue DocumentProviders::NotFoundError => e
      stats[:errors] << "#{model_name} #{doc.id}: File not found at #{doc.storage_path}"
    rescue StandardError => e
      stats[:errors] << "#{model_name} #{doc.id}: #{e.class} - #{e.message}"
    end
  end

  def create_warehouse_entry(doc, blob, model_name)
    source_type = case model_name
    when "JobDocument" then "job"
    when "CorporateCompanyDocument" then "corporate"
    when "ContactDocument" then "contact"
    end

    # Compute folder path
    folder = begin
      doc.virtual_folder_path
    rescue StandardError
      "Unknown"
    end

    # Get display name
    display_name = doc.respond_to?(:display_name) ? doc.display_name.presence : nil
    display_name ||= doc.file_name.presence || "Document #{doc.id}"

    doc.create_warehouse_document!(
      source_type: source_type,
      folder: folder,
      display_name: display_name,
      original_filename: doc.file_name,
      storage_blob: blob
    )
  rescue StandardError => e
    Rails.logger.warn "[StorageMigration] Failed to create warehouse entry for #{model_name} #{doc.id}: #{e.message}"
  end
end

namespace :storage do
  desc "Preview legacy files that need migration to StorageBlob"
  task preview_legacy: :environment do
    puts "=" * 70
    puts "LEGACY FILE MIGRATION STATUS"
    puts "=" * 70
    puts ""

    job_count = JobDocument.where.not(storage_path: nil).where(storage_blob_id: nil).count
    corp_count = CorporateCompanyDocument.where.not(storage_path: nil).where(storage_blob_id: nil).count
    contact_count = ContactDocument.where.not(storage_path: nil).where(storage_blob_id: nil).count

    total = job_count + corp_count + contact_count

    puts "Files needing migration (have storage_path but no storage_blob_id):"
    puts "  JobDocument:              #{job_count}"
    puts "  CorporateCompanyDocument: #{corp_count}"
    puts "  ContactDocument:          #{contact_count}"
    puts "  " + "-" * 40
    puts "  TOTAL:                    #{total}"
    puts ""

    if total == 0
      puts "All legacy files have been migrated to StorageBlob!"
      puts "You can now run: rails storage:delete_legacy_folders"
    else
      puts "Sample legacy paths (first 5 per model):"
      puts ""

      puts "  JobDocument:"
      JobDocument.where.not(storage_path: nil).where(storage_blob_id: nil).limit(5).each do |doc|
        puts "    #{doc.id}: #{doc.storage_path&.truncate(60)}"
      end

      puts ""
      puts "  CorporateCompanyDocument:"
      CorporateCompanyDocument.where.not(storage_path: nil).where(storage_blob_id: nil).limit(5).each do |doc|
        puts "    #{doc.id}: #{doc.storage_path&.truncate(60)}"
      end

      puts ""
      puts "  ContactDocument:"
      ContactDocument.where.not(storage_path: nil).where(storage_blob_id: nil).limit(5).each do |doc|
        puts "    #{doc.id}: #{doc.storage_path&.truncate(60)}"
      end

      puts ""
      puts "To migrate these files, run:"
      puts "  rails storage:migrate_legacy_to_blobs"
    end
  end

  desc "Migrate legacy S3 files to StorageBlob system"
  task migrate_legacy_to_blobs: :environment do
    puts "=" * 70
    puts "MIGRATE LEGACY FILES TO STORAGE BLOB"
    puts "=" * 70
    puts ""

    provider = DocumentProviders.for_organization(Organization.first)

    stats = {
      migrated: 0,
      skipped: 0,
      already_exists: 0,
      errors: []
    }

    # ========================================
    # 1. JobDocument (expected: ~78 files)
    # ========================================
    puts "[1/3] Migrating JobDocument..."
    job_scope = JobDocument.where.not(storage_path: nil).where(storage_blob_id: nil)
    job_total = job_scope.count
    puts "  Found: #{job_total} files"

    job_scope.find_each.with_index do |doc, i|
      StorageMigrationHelpers.migrate_document(doc, provider, stats, "JobDocument")
      print "." if (i + 1) % 10 == 0
    end
    puts "" if job_total > 0

    # ========================================
    # 2. CorporateCompanyDocument (expected: ~6 files)
    # ========================================
    puts ""
    puts "[2/3] Migrating CorporateCompanyDocument..."
    corp_scope = CorporateCompanyDocument.where.not(storage_path: nil).where(storage_blob_id: nil)
    corp_total = corp_scope.count
    puts "  Found: #{corp_total} files"

    corp_scope.find_each.with_index do |doc, i|
      StorageMigrationHelpers.migrate_document(doc, provider, stats, "CorporateCompanyDocument")
      print "." if (i + 1) % 10 == 0
    end
    puts "" if corp_total > 0

    # ========================================
    # 3. ContactDocument (expected: ~11,478 files)
    # ========================================
    puts ""
    puts "[3/3] Migrating ContactDocument..."
    contact_scope = ContactDocument.where.not(storage_path: nil).where(storage_blob_id: nil)
    contact_total = contact_scope.count
    puts "  Found: #{contact_total} files"
    puts "  Progress (every 100 files):"

    contact_scope.find_each.with_index do |doc, i|
      StorageMigrationHelpers.migrate_document(doc, provider, stats, "ContactDocument")

      # Progress indicator
      if (i + 1) % 100 == 0
        print "."
        puts " #{i + 1}" if (i + 1) % 1000 == 0
      end
    end
    puts "" if contact_total > 0

    # ========================================
    # Summary
    # ========================================
    puts ""
    puts "=" * 70
    puts "MIGRATION COMPLETE"
    puts "=" * 70
    puts "Migrated:       #{stats[:migrated]}"
    puts "Already exists: #{stats[:already_exists]} (reused existing blob)"
    puts "Skipped:        #{stats[:skipped]} (no content)"
    puts "Errors:         #{stats[:errors].count}"

    if stats[:errors].any?
      puts ""
      puts "First 20 errors:"
      stats[:errors].first(20).each { |e| puts "  - #{e}" }
    end

    puts ""
    puts "Next step: Run 'rails storage:preview_legacy' to verify all files migrated"
    puts "Then run: 'rails storage:delete_legacy_folders' to clean up S3"
  end

  desc "Delete legacy S3 folders (after migration complete)"
  task delete_legacy_folders: :environment do
    puts "=" * 70
    puts "DELETE LEGACY S3 FOLDERS"
    puts "=" * 70
    puts ""

    # Safety check - abort if any legacy files remain
    job_count = JobDocument.where.not(storage_path: nil).where(storage_blob_id: nil).count
    corp_count = CorporateCompanyDocument.where.not(storage_path: nil).where(storage_blob_id: nil).count
    contact_count = ContactDocument.where.not(storage_path: nil).where(storage_blob_id: nil).count
    legacy_count = job_count + corp_count + contact_count

    if legacy_count > 0
      puts "ABORT: #{legacy_count} files still need migration!"
      puts ""
      puts "Breakdown:"
      puts "  JobDocument: #{job_count}"
      puts "  CorporateCompanyDocument: #{corp_count}"
      puts "  ContactDocument: #{contact_count}"
      puts ""
      puts "Run 'rails storage:migrate_legacy_to_blobs' first."
      exit 1
    end

    puts "Safety check passed - all legacy files have been migrated."
    puts ""

    provider = DocumentProviders.for_organization(Organization.first)

    # List of legacy folders to delete
    legacy_folders = %w[
      Attachments
      Contacts
      Corporate
      Emails
      Jobs
      jobs
      Task\ Responses
      Tasks
      Users
      Warehousing
      corporate
    ]

    puts "Folders to delete:"
    legacy_folders.each { |f| puts "  - #{f}/" }
    puts ""

    deleted_count = 0
    skipped_count = 0
    error_count = 0

    legacy_folders.each do |folder|
      begin
        print "Deleting #{folder}/... "

        # Check if folder exists first
        begin
          items = provider.list_folder("/#{folder}")
          if items.empty?
            puts "empty, skipping"
            skipped_count += 1
            next
          end
        rescue DocumentProviders::NotFoundError
          puts "not found, skipping"
          skipped_count += 1
          next
        end

        # Delete the folder and all contents
        provider.delete_folder("/#{folder}")
        puts "done"
        deleted_count += 1
      rescue StandardError => e
        puts "ERROR: #{e.message}"
        error_count += 1
      end
    end

    puts ""
    puts "=" * 70
    puts "CLEANUP COMPLETE"
    puts "=" * 70
    puts "Deleted: #{deleted_count} folders"
    puts "Skipped: #{skipped_count} (not found/empty)"
    puts "Errors:  #{error_count}"
    puts ""
    puts "Only 'Blobs/' folder should remain in S3."
    puts "Verify with: rails storage:list_s3_folders"
  end

  desc "List current S3 root folders"
  task list_s3_folders: :environment do
    puts "=" * 70
    puts "S3 ROOT FOLDERS"
    puts "=" * 70
    puts ""

    provider = DocumentProviders.for_organization(Organization.first)

    begin
      items = provider.list_folder("/")

      folders = items.select { |i| i[:type] == :folder }
      puts "Root folders (#{folders.count}):"
      folders.each do |folder|
        puts "  - #{folder[:name]}/"
      end

      files = items.select { |i| i[:type] == :file }
      if files.any?
        puts ""
        puts "Root files (#{files.count}):"
        files.first(10).each do |file|
          puts "  - #{file[:name]} (#{(file[:size].to_f / 1024).round(1)} KB)"
        end
        puts "  ... and #{files.count - 10} more" if files.count > 10
      end

      puts ""
      if folders.count == 1 && folders.first[:name] == "Blobs"
        puts "SUCCESS: Only 'Blobs/' folder remains!"
      elsif folders.any? { |f| f[:name] != "Blobs" }
        legacy = folders.reject { |f| f[:name] == "Blobs" }
        puts "WARNING: #{legacy.count} legacy folders still exist:"
        legacy.each { |f| puts "  - #{f[:name]}/" }
        puts ""
        puts "Run 'rails storage:migrate_legacy_to_blobs' then 'rails storage:delete_legacy_folders'"
      end
    rescue StandardError => e
      puts "ERROR listing folders: #{e.message}"
    end
  end
end
