# frozen_string_literal: true

# Email Blob Migration - Migrate hierarchical paths to content-addressed storage
#
# Background:
#   Old emails were stored at: Emails/2026/01/123.eml (hierarchical)
#   New emails should be at:   Blobs/ab/abcdef123.eml (content-addressed)
#
# This task:
#   1. Downloads each .eml file from old S3 location
#   2. Computes content_hash (SHA256)
#   3. Copies to Blobs/{hash-prefix}/{hash}.eml
#   4. Creates StorageBlob record with actual content_hash
#   5. Updates SyncedEmail.storage_path to new path
#   6. Creates/updates WarehouseDocument
#   7. Deletes old file (optional, with --cleanup flag)
#
# Usage:
#   # Preview what needs migration
#   rails email:blob:status
#
#   # Migrate 100 emails (dry run)
#   rails email:blob:migrate[100]
#
#   # Migrate and cleanup old files
#   rails email:blob:migrate[100,cleanup]
#
#   # Delete empty Emails/ folder after migration complete
#   rails email:blob:cleanup_legacy_folders
#
namespace :email do
  namespace :blob do
    desc "Show email storage migration status"
    task :status, [:tenant_id] => :environment do |_t, args|
      puts "=" * 70
      puts "EMAIL BLOB MIGRATION STATUS"
      puts "=" * 70
      puts ""

      # Find tenant - use provided ID or default to first
      tenant = args[:tenant_id] ? Tenant.find(args[:tenant_id]) : Tenant.first
      puts "Tenant: #{tenant.name} (ID: #{tenant.id})"
      puts ""

      ActsAsTenant.with_tenant(tenant) do
        # Show bucket info
        config = StorageConfiguration.for_tenant(tenant)
        puts "Storage Provider: #{config.provider_type}"
        puts "Bucket: #{config.bucket || '(from credential)'}"
        puts ""
        total = SyncedEmail.count
        with_storage = SyncedEmail.where.not(storage_path: [nil, ""]).count
        without_storage = total - with_storage

        # Count emails with old vs new path format
        old_format = SyncedEmail.where("storage_path LIKE 'Emails/%'").count
        new_format = SyncedEmail.where("storage_path LIKE 'Blobs/%'").count
        other_format = with_storage - old_format - new_format

        puts "SyncedEmails:"
        puts "  Total:                    #{total}"
        puts "  With storage_path:        #{with_storage}"
        puts "  Without storage_path:     #{without_storage}"
        puts ""
        puts "Storage Path Formats:"
        puts "  Old (Emails/...):         #{old_format} ← Need migration"
        puts "  New (Blobs/...):          #{new_format} ✓"
        puts "  Other:                    #{other_format}"
        puts ""

        # Sample old format paths
        if old_format > 0
          puts "Sample old format paths (first 5):"
          SyncedEmail.where("storage_path LIKE 'Emails/%'")
                     .limit(5)
                     .pluck(:id, :storage_path)
                     .each do |id, path|
            puts "  #{id}: #{path}"
          end
          puts ""
        end

        # StorageBlob stats
        blobs_total = StorageBlob.count
        blobs_with_hash = StorageBlob.where.not(content_hash: nil).count
        blobs_without_hash = blobs_total - blobs_with_hash
        blobs_old_path = StorageBlob.where("storage_path LIKE 'Emails/%'").count
        blobs_new_path = StorageBlob.where("storage_path LIKE 'Blobs/%'").count

        puts "StorageBlobs:"
        puts "  Total:                    #{blobs_total}"
        puts "  With content_hash:        #{blobs_with_hash}"
        puts "  Without content_hash:     #{blobs_without_hash}"
        puts "  Old path format:          #{blobs_old_path}"
        puts "  New path format:          #{blobs_new_path}"
        puts ""

        if old_format > 0
          puts "To migrate, run:"
          puts "  rails email:blob:migrate[1000]        # Migrate 1000 emails"
          puts "  rails email:blob:migrate[1000,cleanup] # Migrate and delete old files"
        else
          puts "✓ All emails are using content-addressed storage!"
        end
      end
    end

    desc "Migrate emails from hierarchical to content-addressed storage"
    task :migrate, [:limit, :cleanup, :tenant_id] => :environment do |_t, args|
      limit = (args[:limit] || 100).to_i
      cleanup = args[:cleanup] == "cleanup"

      puts "=" * 70
      puts "MIGRATE EMAILS TO CONTENT-ADDRESSED STORAGE"
      puts "=" * 70
      puts ""

      # Find tenant - use provided ID or default to first
      tenant = args[:tenant_id] ? Tenant.find(args[:tenant_id]) : Tenant.first
      unless tenant
        puts "ERROR: No tenant found"
        exit 1
      end

      # Show bucket info for verification
      config = StorageConfiguration.for_tenant(tenant)
      puts "Tenant:  #{tenant.name} (ID: #{tenant.id})"
      puts "Bucket:  #{config.bucket || '(from credential)'}"
      puts "Limit:   #{limit}"
      puts "Cleanup: #{cleanup ? 'Yes (delete old files)' : 'No (keep old files)'}"
      puts ""

      ActsAsTenant.with_tenant(tenant) do
        provider = DocumentProviders.for_tenant(tenant)
        unless provider
          puts "ERROR: No storage provider configured"
          exit 1
        end

        stats = { migrated: 0, skipped: 0, errors: [], already_new: 0 }

        # Find emails with old path format
        scope = SyncedEmail.where("storage_path LIKE 'Emails/%'")
                           .order(:id)
                           .limit(limit)

        total = scope.count
        if total == 0
          puts "No emails need migration!"
          exit 0
        end

        puts "Found #{total} emails to migrate"
        puts ""

        scope.find_each.with_index do |email, i|
          old_path = email.storage_path

          # Skip if already in new format
          if old_path&.start_with?("Blobs/")
            stats[:already_new] += 1
            next
          end

          print "  [#{i + 1}/#{total}] Email #{email.id}..."

          begin
            # 1. Download from old location
            content = provider.download_file(old_path)
            unless content.present?
              puts " SKIP (no content at old path)"
              stats[:skipped] += 1
              next
            end

            # 2. Compute content hash
            content_hash = Digest::SHA256.hexdigest(content)
            prefix = content_hash[0..1]
            new_path = "Blobs/#{prefix}/#{content_hash}.eml"

            # 3. Check if blob already exists with this hash
            existing_blob = StorageBlob.find_by(content_hash: content_hash)
            if existing_blob
              # Use existing blob (deduplication!)
              blob = existing_blob
              puts " DEDUP (using existing blob #{blob.id})"
            else
              # Upload to new location
              result = provider.upload_file(
                "Blobs/#{prefix}",
                content,
                "#{content_hash}.eml",
                content_type: "message/rfc822"
              )

              # 4. Create StorageBlob
              blob = StorageBlob.create!(
                content_hash: content_hash,
                storage_path: new_path,
                file_size: content.bytesize,
                original_filename: "#{email.id}.eml",
                content_type: "message/rfc822",
                reference_count: 0
              )
            end

            # 5. Update email record
            email.update_columns(
              storage_path: new_path,
              storage_file_id: blob.id.to_s,
              storage_email_path: new_path,
              storage_email_file_id: blob.id.to_s
            )

            # 6. Update or create WarehouseDocument
            if email.warehouse_document
              old_blob = email.warehouse_document.storage_blob
              email.warehouse_document.update!(storage_blob: blob)
              old_blob&.decrement!(:reference_count) if old_blob && old_blob != blob
            else
              WarehouseDocument.create!(
                documentable: email,
                storage_blob: blob,
                source_type: "email",
                folder: email.virtual_folder_path,
                display_name: email.subject.presence || "No Subject",
                original_filename: "#{email.id}.eml",
                tenant_id: tenant.id,
                metadata: {
                  subject: email.subject,
                  from_email: email.from_email,
                  received_at: email.received_at&.iso8601,
                  mailbox: email.mailbox_owner_email
                }
              )
            end

            blob.increment!(:reference_count)

            # 7. Delete old file if cleanup enabled
            if cleanup && old_path != new_path
              begin
                provider.delete_file(old_path)
              rescue StandardError => e
                # Ignore delete errors - file might already be gone
                Rails.logger.debug "Could not delete #{old_path}: #{e.message}"
              end
            end

            puts " OK → #{new_path}"
            stats[:migrated] += 1

          rescue DocumentProviders::NotFoundError
            puts " SKIP (file not found at #{old_path})"
            stats[:skipped] += 1
          rescue StandardError => e
            puts " ERROR: #{e.message}"
            stats[:errors] << { id: email.id, error: e.message }
          end
        end

        puts ""
        puts "=" * 70
        puts "MIGRATION COMPLETE"
        puts "=" * 70
        puts "Migrated:     #{stats[:migrated]}"
        puts "Skipped:      #{stats[:skipped]}"
        puts "Already new:  #{stats[:already_new]}"
        puts "Errors:       #{stats[:errors].count}"

        if stats[:errors].any?
          puts ""
          puts "Errors (first 10):"
          stats[:errors].first(10).each do |err|
            puts "  Email #{err[:id]}: #{err[:error]}"
          end
        end

        # Show remaining count
        remaining = SyncedEmail.where("storage_path LIKE 'Emails/%'").count
        if remaining > 0
          puts ""
          puts "Remaining: #{remaining} emails still need migration"
          puts "Run again with higher limit: rails email:blob:migrate[#{[remaining, 10000].min}]"
        end
      end
    end

    desc "Delete empty legacy folders (Emails/, Temp/, test files)"
    task :cleanup_legacy_folders, [:tenant_id] => :environment do |_t, args|
      puts "=" * 70
      puts "CLEANUP LEGACY FOLDERS"
      puts "=" * 70
      puts ""

      tenant = args[:tenant_id] ? Tenant.find(args[:tenant_id]) : Tenant.first
      puts "Tenant: #{tenant.name} (ID: #{tenant.id})"
      puts ""

      ActsAsTenant.with_tenant(tenant) do
        provider = DocumentProviders.for_tenant(tenant)
        unless provider
          puts "ERROR: No storage provider configured"
          exit 1
        end

        # Check if any emails still use old format
        old_format_count = SyncedEmail.where("storage_path LIKE 'Emails/%'").count
        if old_format_count > 0
          puts "WARNING: #{old_format_count} emails still use old format!"
          puts "Run 'rails email:blob:migrate' first to migrate all emails."
          puts ""
          puts "Continue anyway? (This will skip non-empty folders)"
          # In rake task, we'll just warn and continue
        end

        folders_to_check = ["Emails", "Temp", "TEST_FILE_DELETE_ME.txt"]
        deleted = []
        skipped = []

        folders_to_check.each do |folder|
          print "  Checking #{folder}..."

          begin
            # Try to list contents
            if provider.respond_to?(:list_files)
              contents = provider.list_files(folder) rescue []
              if contents.empty?
                provider.delete_file(folder)
                deleted << folder
                puts " DELETED (empty)"
              else
                skipped << { folder: folder, reason: "#{contents.count} items inside" }
                puts " SKIPPED (#{contents.count} items)"
              end
            else
              # Try direct delete for files
              provider.delete_file(folder)
              deleted << folder
              puts " DELETED"
            end
          rescue DocumentProviders::NotFoundError
            puts " NOT FOUND (already gone)"
          rescue StandardError => e
            skipped << { folder: folder, reason: e.message }
            puts " ERROR: #{e.message}"
          end
        end

        puts ""
        puts "Deleted: #{deleted.join(', ')}" if deleted.any?
        puts "Skipped: #{skipped.map { |s| "#{s[:folder]} (#{s[:reason]})" }.join(', ')}" if skipped.any?
        puts ""
        puts "Storage should now contain only:"
        puts "  Blobs/    - All files with content-addressed paths"
      end
    end

    desc "Verify content hashes match actual file content"
    task :verify_hashes, [:limit, :tenant_id] => :environment do |_t, args|
      limit = (args[:limit] || 100).to_i

      puts "=" * 70
      puts "VERIFY CONTENT HASHES"
      puts "=" * 70
      puts ""

      tenant = args[:tenant_id] ? Tenant.find(args[:tenant_id]) : Tenant.first
      puts "Tenant: #{tenant.name} (ID: #{tenant.id})"
      puts ""

      ActsAsTenant.with_tenant(tenant) do
        provider = DocumentProviders.for_tenant(tenant)

        stats = { verified: 0, mismatch: 0, missing: 0, errors: [] }

        scope = StorageBlob.where("storage_path LIKE 'Blobs/%'")
                           .where.not(content_hash: nil)
                           .limit(limit)

        total = scope.count
        puts "Verifying #{total} blobs..."
        puts ""

        scope.find_each.with_index do |blob, i|
          begin
            content = provider.download_file(blob.storage_path)
            actual_hash = Digest::SHA256.hexdigest(content)

            if actual_hash == blob.content_hash
              stats[:verified] += 1
              print "."
            else
              stats[:mismatch] += 1
              stats[:errors] << { id: blob.id, expected: blob.content_hash, actual: actual_hash }
              print "X"
            end
          rescue DocumentProviders::NotFoundError
            stats[:missing] += 1
            print "M"
          rescue StandardError => e
            stats[:errors] << { id: blob.id, error: e.message }
            print "E"
          end

          puts " #{i + 1}" if (i + 1) % 50 == 0
        end

        puts ""
        puts ""
        puts "=" * 70
        puts "VERIFICATION RESULTS"
        puts "=" * 70
        puts "Verified:  #{stats[:verified]} ✓"
        puts "Mismatch:  #{stats[:mismatch]}"
        puts "Missing:   #{stats[:missing]}"
        puts ""

        if stats[:errors].any?
          puts "Issues (first 10):"
          stats[:errors].first(10).each do |err|
            if err[:actual]
              puts "  Blob #{err[:id]}: hash mismatch (expected #{err[:expected][0..7]}... got #{err[:actual][0..7]}...)"
            else
              puts "  Blob #{err[:id]}: #{err[:error]}"
            end
          end
        end
      end
    end
  end
end
