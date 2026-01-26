# frozen_string_literal: true

# Blob Migration Tasks - Phase 0: File Recovery & Multi-tenancy
#
# Problem: StorageBlob records exist but files don't exist in bucket
# - 93.4% of email bodies missing
# - 99.9% of corporate/contact docs missing
# - Files likely in old bucket (teeem-documents) not new bucket (teeem-tekna)
#
# Execution Order:
#   1. rails blob:audit_files         - Audit what exists where
#   2. rails blob:copy_from_old       - Copy missing files from old bucket
#   3. rails blob:cleanup_orphans     - Handle true orphans
#   4. rails email:blob:migrate       - Migrate email paths (existing task)
#   5. rails blob:cleanup_legacy      - Clean up legacy paths
#   6. rails blob:verify              - Verify all blobs (existing task)
#
# SSoT: All blob operations go through DocumentProviders
#
namespace :blob do
  desc "Audit files - check what exists in old vs new bucket"
  task :audit_files, [:old_bucket] => :environment do |_t, args|
    require "aws-sdk-s3"

    puts "=" * 70
    puts "BLOB FILE AUDIT"
    puts "=" * 70
    puts ""

    tenant = Tenant.find_by(name: "Tekna") || Tenant.first
    unless tenant
      puts "ERROR: No tenant found"
      exit 1
    end

    ActsAsTenant.with_tenant(tenant) do
      cred = S3CompatibleCredential.active.first
      unless cred
        puts "ERROR: No S3 credential found"
        exit 1
      end

      config = StorageConfiguration.for_tenant(tenant)
      new_bucket = config.bucket || config.connection_config["bucket"]
      old_bucket = args[:old_bucket] || "teeem-documents"

      puts "Tenant:     #{tenant.name} (ID: #{tenant.id})"
      puts "New bucket: #{new_bucket}"
      puts "Old bucket: #{old_bucket}"
      puts ""

      client = Aws::S3::Client.new(
        access_key_id: cred.access_key_id,
        secret_access_key: cred.secret_access_key,
        endpoint: cred.endpoint,
        region: cred.region || "ap-southeast-2",
        force_path_style: true
      )

      # Build set of files in new bucket
      puts "Building list of files in new bucket..."
      new_bucket_keys = Set.new
      begin
        token = nil
        loop do
          resp = client.list_objects_v2(bucket: new_bucket, max_keys: 1000, continuation_token: token)
          resp.contents.each do |obj|
            key = obj.key.sub(%r{^/+}, "") # Normalize: remove leading slash
            new_bucket_keys << key
          end
          print "\r  Found #{new_bucket_keys.size} files..."
          break unless resp.is_truncated
          token = resp.next_continuation_token
        end
        puts "\n  Total: #{new_bucket_keys.size} files in new bucket"
      rescue Aws::S3::Errors::NoSuchBucket
        puts "\n  ERROR: New bucket #{new_bucket} does not exist!"
        exit 1
      end

      # Build set of files in old bucket
      puts ""
      puts "Building list of files in old bucket..."
      old_bucket_keys = Set.new
      begin
        token = nil
        loop do
          resp = client.list_objects_v2(bucket: old_bucket, max_keys: 1000, continuation_token: token)
          resp.contents.each do |obj|
            key = obj.key.sub(%r{^/+}, "") # Normalize: remove leading slash
            old_bucket_keys << key
          end
          print "\r  Found #{old_bucket_keys.size} files..."
          break unless resp.is_truncated
          token = resp.next_continuation_token
        end
        puts "\n  Total: #{old_bucket_keys.size} files in old bucket"
      rescue Aws::S3::Errors::NoSuchBucket
        puts "\n  WARNING: Old bucket #{old_bucket} does not exist"
        old_bucket_keys = Set.new
      end

      # Audit each StorageBlob
      puts ""
      puts "Auditing StorageBlob records..."
      stats = {
        found_new: 0,
        found_old: 0,
        missing_both: 0,
        total: 0
      }

      StorageBlob.find_each do |blob|
        stats[:total] += 1
        path = blob.storage_path.to_s.sub(%r{^/+}, "") # Normalize

        if new_bucket_keys.include?(path)
          stats[:found_new] += 1
          # File is in correct location
          blob.update_columns(needs_migration: false, file_missing: false) unless blob.persisted? && !blob.needs_migration && !blob.file_missing
        elsif old_bucket_keys.include?(path)
          stats[:found_old] += 1
          # File in old bucket - mark for migration
          blob.update_columns(needs_migration: true, file_missing: false)
        else
          stats[:missing_both] += 1
          # File truly missing
          blob.update_columns(needs_migration: false, file_missing: true)
        end

        print "\r  Audited #{stats[:total]} blobs..." if stats[:total] % 1000 == 0
      end

      puts ""
      puts ""
      puts "=" * 70
      puts "AUDIT RESULTS"
      puts "=" * 70
      puts "Total blobs:            #{stats[:total]}"
      puts ""
      puts "Found in new bucket:    #{stats[:found_new]} ✓"
      puts "Found in old bucket:    #{stats[:found_old]} ← Need copy"
      puts "Missing from both:      #{stats[:missing_both]} ← Orphans"
      puts ""

      if stats[:found_old] > 0
        puts "Next step: rails blob:copy_from_old[#{old_bucket}]"
      end
      if stats[:missing_both] > 0
        puts "Then: rails blob:cleanup_orphans"
      end
    end
  end

  desc "Copy missing files from old bucket to new bucket"
  task :copy_from_old, [:old_bucket, :limit] => :environment do |_t, args|
    require "aws-sdk-s3"

    puts "=" * 70
    puts "COPY FILES FROM OLD BUCKET"
    puts "=" * 70
    puts ""

    tenant = Tenant.find_by(name: "Tekna") || Tenant.first
    unless tenant
      puts "ERROR: No tenant found"
      exit 1
    end

    ActsAsTenant.with_tenant(tenant) do
      cred = S3CompatibleCredential.active.first
      unless cred
        puts "ERROR: No S3 credential found"
        exit 1
      end

      config = StorageConfiguration.for_tenant(tenant)
      new_bucket = config.bucket || config.connection_config["bucket"]
      old_bucket = args[:old_bucket] || "teeem-documents"
      limit = args[:limit]&.to_i || 10_000

      puts "Tenant:     #{tenant.name}"
      puts "Old bucket: #{old_bucket}"
      puts "New bucket: #{new_bucket}"
      puts "Limit:      #{limit}"
      puts ""

      client = Aws::S3::Client.new(
        access_key_id: cred.access_key_id,
        secret_access_key: cred.secret_access_key,
        endpoint: cred.endpoint,
        region: cred.region || "ap-southeast-2",
        force_path_style: true
      )

      stats = { copied: 0, errors: 0, skipped: 0 }
      error_samples = []

      scope = StorageBlob.needing_migration.limit(limit)
      total = scope.count

      if total == 0
        puts "No blobs need migration!"
        puts "Run 'rails blob:audit_files' first to identify files needing copy."
        exit 0
      end

      puts "Found #{total} blobs needing migration"
      puts ""

      scope.find_each.with_index do |blob, i|
        path = blob.storage_path.to_s.sub(%r{^/+}, "")
        print "  [#{i + 1}/#{total}] #{path[0..50]}..."

        begin
          # Copy from old bucket to new bucket
          client.copy_object(
            bucket: new_bucket,
            key: path,
            copy_source: "#{old_bucket}/#{path}"
          )
          blob.update_columns(needs_migration: false, file_missing: false)
          stats[:copied] += 1
          puts " OK"
        rescue Aws::S3::Errors::NoSuchKey
          # File doesn't exist in old bucket either
          blob.update_columns(needs_migration: false, file_missing: true)
          stats[:skipped] += 1
          puts " MISSING"
        rescue StandardError => e
          stats[:errors] += 1
          error_samples << { id: blob.id, path: path, error: e.message } if error_samples.size < 10
          puts " ERROR: #{e.message[0..50]}"
        end
      end

      puts ""
      puts "=" * 70
      puts "COPY COMPLETE"
      puts "=" * 70
      puts "Copied:  #{stats[:copied]}"
      puts "Missing: #{stats[:skipped]}"
      puts "Errors:  #{stats[:errors]}"

      if error_samples.any?
        puts ""
        puts "Sample errors:"
        error_samples.each do |err|
          puts "  Blob #{err[:id]}: #{err[:error]}"
        end
      end

      remaining = StorageBlob.needing_migration.count
      if remaining > 0
        puts ""
        puts "Remaining: #{remaining} blobs still need migration"
        puts "Run again: rails blob:copy_from_old[#{old_bucket},#{remaining}]"
      end
    end
  end

  desc "Handle orphan blobs (files missing from both buckets)"
  task :cleanup_orphans, [:mode] => :environment do |_t, args|
    mode = args[:mode] || "report"

    puts "=" * 70
    puts "CLEANUP ORPHAN BLOBS"
    puts "=" * 70
    puts "Mode: #{mode} (use 'execute' to actually delete)"
    puts ""

    tenant = Tenant.find_by(name: "Tekna") || Tenant.first
    unless tenant
      puts "ERROR: No tenant found"
      exit 1
    end

    ActsAsTenant.with_tenant(tenant) do
      orphans = StorageBlob.missing_file
      total = orphans.count

      if total == 0
        puts "No orphan blobs found!"
        exit 0
      end

      puts "Found #{total} orphan blobs (file_missing = true)"
      puts ""

      # Categorize by source
      categories = {}
      orphans.joins("LEFT JOIN warehouse_documents ON warehouse_documents.storage_blob_id = storage_blobs.id")
             .group("warehouse_documents.source_type")
             .count
             .each do |source_type, count|
        categories[source_type || "(no warehouse_doc)"] = count
      end

      puts "By source type:"
      categories.each do |source, count|
        puts "  #{source}: #{count}"
      end
      puts ""

      if mode == "execute"
        puts "DELETING ORPHAN BLOBS (bulk mode)..."

        # Get all orphan IDs upfront
        orphan_ids = orphans.pluck(:id)
        puts "  Collected #{orphan_ids.size} orphan IDs"

        # Bulk unlink from WarehouseDocuments
        puts "  Unlinking warehouse documents..."
        unlinked = WarehouseDocument.where(storage_blob_id: orphan_ids).update_all(storage_blob_id: nil)
        puts "  Unlinked: #{unlinked} warehouse documents"

        # Bulk unlink from EmailAttachments
        puts "  Unlinking email attachments..."
        EmailAttachment.where(storage_blob_id: orphan_ids).update_all(storage_blob_id: nil) rescue nil

        # Bulk unlink from other associations
        puts "  Unlinking other associations..."
        CorporateCompanyDocument.where(storage_blob_id: orphan_ids).update_all(storage_blob_id: nil) rescue nil
        ChatMessage.where(storage_blob_id: orphan_ids).update_all(storage_blob_id: nil) rescue nil
        BillInbox.where(storage_blob_id: orphan_ids).update_all(storage_blob_id: nil) rescue nil

        # Bulk delete orphan blobs in batches (bypass tenant scope)
        puts "  Deleting orphan blobs in batches..."
        deleted = 0
        orphan_ids.each_slice(1000) do |batch_ids|
          deleted += StorageBlob.unscoped.where(id: batch_ids).delete_all
          print "\r  Deleted: #{deleted}/#{orphan_ids.size}..."
        end

        puts ""
        puts ""
        puts "Unlinked: #{unlinked} warehouse documents"
        puts "Deleted:  #{deleted} storage blobs"
      else
        puts "To delete orphan blobs, run:"
        puts "  rails blob:cleanup_orphans[execute]"
        puts ""
        puts "WARNING: This will:"
        puts "  - Set storage_blob_id = NULL on #{WarehouseDocument.where(storage_blob_id: orphans.pluck(:id)).count} warehouse documents"
        puts "  - Delete #{total} storage_blob records"
      end
    end
  end

  desc "Migrate emails from Emails/ to Blobs/ structure"
  task :migrate_emails, [:limit, :cleanup] => :environment do |_t, args|
    # Delegate to existing email:blob:migrate task
    puts "Delegating to email:blob:migrate..."
    puts ""
    Rake::Task["email:blob:migrate"].invoke(args[:limit], args[:cleanup])
  end

  desc "Clean up legacy storage paths (non-standard paths)"
  task :cleanup_legacy, [:mode] => :environment do |_t, args|
    mode = args[:mode] || "report"

    puts "=" * 70
    puts "CLEANUP LEGACY PATHS"
    puts "=" * 70
    puts "Mode: #{mode} (use 'execute' to actually migrate)"
    puts ""

    tenant = Tenant.find_by(name: "Tekna") || Tenant.first
    unless tenant
      puts "ERROR: No tenant found"
      exit 1
    end

    ActsAsTenant.with_tenant(tenant) do
      provider = DocumentProviders.for_tenant(tenant)

      # Find blobs with non-standard paths (not Blobs/ and not Emails/)
      legacy = StorageBlob.where("storage_path NOT LIKE '%Blobs/%' AND storage_path NOT LIKE '%Emails/%'")
                          .where(file_missing: false)
      total = legacy.count

      if total == 0
        puts "No legacy paths found!"
        exit 0
      end

      puts "Found #{total} blobs with legacy paths"

      # Sample paths
      puts ""
      puts "Sample legacy paths (first 10):"
      legacy.limit(10).pluck(:id, :storage_path).each do |id, path|
        puts "  #{id}: #{path}"
      end
      puts ""

      if mode == "execute"
        stats = { migrated: 0, deduplicated: 0, errors: 0 }
        error_samples = []

        legacy.find_each.with_index do |blob, i|
          old_path = blob.storage_path.to_s.sub(%r{^/+}, "")
          print "  [#{i + 1}/#{total}] #{old_path[0..40]}..."

          begin
            # Download file
            content = provider.download_file(old_path)
            unless content.present?
              puts " SKIP (no content)"
              next
            end

            # Compute hash
            hash = Digest::SHA256.hexdigest(content)
            ext = File.extname(blob.original_filename || old_path)
            ext = ".bin" if ext.blank?
            new_path = "Blobs/#{hash[0..1]}/#{hash}#{ext}"

            # Check for existing blob with same hash (deduplication)
            existing = StorageBlob.find_by(content_hash: hash)
            if existing && existing.id != blob.id
              # Deduplicate: point references to existing blob
              WarehouseDocument.where(storage_blob_id: blob.id)
                               .update_all(storage_blob_id: existing.id)
              existing.increment!(:reference_count)
              blob.destroy
              provider.delete_file(old_path) rescue nil
              stats[:deduplicated] += 1
              puts " DEDUP → blob #{existing.id}"
            else
              # Upload to new location
              result = provider.upload_file(
                "Blobs/#{hash[0..1]}",
                content,
                "#{hash}#{ext}",
                content_type: blob.content_type
              )

              # Update blob record
              blob.update!(
                storage_path: new_path,
                content_hash: hash
              )

              # Delete old file
              provider.delete_file(old_path) rescue nil
              stats[:migrated] += 1
              puts " OK → #{new_path}"
            end
          rescue DocumentProviders::NotFoundError
            blob.update_columns(file_missing: true)
            puts " NOT FOUND"
          rescue StandardError => e
            stats[:errors] += 1
            error_samples << { id: blob.id, path: old_path, error: e.message } if error_samples.size < 10
            puts " ERROR: #{e.message[0..40]}"
          end
        end

        puts ""
        puts "=" * 70
        puts "LEGACY CLEANUP COMPLETE"
        puts "=" * 70
        puts "Migrated:     #{stats[:migrated]}"
        puts "Deduplicated: #{stats[:deduplicated]}"
        puts "Errors:       #{stats[:errors]}"

        if error_samples.any?
          puts ""
          puts "Sample errors:"
          error_samples.each do |err|
            puts "  Blob #{err[:id]}: #{err[:error]}"
          end
        end
      else
        puts "To migrate legacy paths, run:"
        puts "  rails blob:cleanup_legacy[execute]"
      end
    end
  end

  desc "Migrate VALID emails (exclude corrupted /eml/ paths) to Blobs/ format"
  task :migrate_valid_emails, [:limit, :dry_run] => :environment do |_t, args|
    limit = (args[:limit] || 100).to_i
    dry_run = args[:dry_run] != "false"

    puts "=" * 70
    puts "MIGRATE VALID EMAILS TO BLOBS/"
    puts "=" * 70
    puts "Mode: #{dry_run ? 'DRY RUN (use false for execute)' : 'EXECUTE'}"
    puts "Limit: #{limit}"
    puts ""

    tenant = Tenant.find_by(name: "Tekna") || Tenant.first
    unless tenant
      puts "ERROR: No tenant found"
      exit 1
    end

    ActsAsTenant.with_tenant(tenant) do
      provider = DocumentProviders.for_tenant(tenant)

      # Find emails with VALID paths (not corrupted /eml/ paths)
      # Valid: /Emails/aaron/2023/... or /Emails/rob/2024/...
      # Invalid: /Emails/eml/2021/... (these are corrupted)
      valid_emails = StorageBlob.where("storage_path LIKE '%Emails/%'")
                                .where("storage_path NOT LIKE '%/eml/%'")
                                .where(file_missing: false)
                                .limit(limit)

      total_valid = StorageBlob.where("storage_path LIKE '%Emails/%'")
                               .where("storage_path NOT LIKE '%/eml/%'")
                               .where(file_missing: false)
                               .count
      corrupted = StorageBlob.where("storage_path LIKE '%/eml/%'").count

      puts "Valid email paths:    #{total_valid}"
      puts "Corrupted /eml/ paths: #{corrupted} (SKIPPED - files don't exist)"
      puts ""

      if total_valid == 0
        puts "No valid emails to migrate!"
        exit 0
      end

      batch = valid_emails.to_a
      puts "Processing batch of #{batch.size} emails..."
      puts ""

      stats = { migrated: 0, deduplicated: 0, errors: 0, not_found: 0 }
      error_samples = []

      batch.each_with_index do |blob, i|
        old_path = blob.storage_path.to_s.sub(%r{^/+}, "")
        print "  [#{i + 1}/#{batch.size}] #{old_path[0..50]}..."

        if dry_run
          puts " [DRY RUN]"
          stats[:migrated] += 1
          next
        end

        begin
          # Download file
          content = provider.download_file(old_path)
          unless content.present?
            puts " SKIP (no content)"
            next
          end

          # Compute hash
          hash = Digest::SHA256.hexdigest(content)
          ext = File.extname(blob.original_filename || old_path)
          ext = ".eml" if ext.blank?
          new_path = "Blobs/#{hash[0..1]}/#{hash}#{ext}"

          # Check for existing blob with same hash (deduplication)
          existing = StorageBlob.find_by(content_hash: hash)
          if existing && existing.id != blob.id
            # Deduplicate: point references to existing blob
            WarehouseDocument.where(storage_blob_id: blob.id)
                             .update_all(storage_blob_id: existing.id)
            existing.increment!(:reference_count)
            blob.destroy
            provider.delete_file(old_path) rescue nil
            stats[:deduplicated] += 1
            puts " DEDUP → blob #{existing.id}"
          else
            # Upload to new location
            provider.upload_file(
              "Blobs/#{hash[0..1]}",
              content,
              "#{hash}#{ext}",
              content_type: blob.content_type || "message/rfc822"
            )

            # Update blob record
            blob.update!(
              storage_path: new_path,
              content_hash: hash
            )

            # Delete old file
            provider.delete_file(old_path) rescue nil
            stats[:migrated] += 1
            puts " OK → #{new_path[0..40]}"
          end
        rescue DocumentProviders::NotFoundError
          blob.update_columns(file_missing: true)
          stats[:not_found] += 1
          puts " NOT FOUND"
        rescue StandardError => e
          stats[:errors] += 1
          error_samples << { id: blob.id, path: old_path, error: e.message } if error_samples.size < 10
          puts " ERROR: #{e.message[0..40]}"
        end
      end

      puts ""
      puts "=" * 70
      puts "MIGRATION COMPLETE"
      puts "=" * 70
      puts "Migrated:     #{stats[:migrated]}"
      puts "Deduplicated: #{stats[:deduplicated]}"
      puts "Not found:    #{stats[:not_found]}"
      puts "Errors:       #{stats[:errors]}"

      if error_samples.any?
        puts ""
        puts "Sample errors:"
        error_samples.each do |err|
          puts "  Blob #{err[:id]}: #{err[:error]}"
        end
      end

      remaining = total_valid - batch.size
      if remaining > 0
        puts ""
        puts "Remaining: #{remaining} valid emails still need migration"
        puts "Run again: rails blob:migrate_valid_emails[#{[remaining, 1000].min},false]"
      end
    end
  end

  desc "Mark corrupted email blobs (/eml/ paths) as file_missing"
  task mark_corrupted_emails: :environment do
    puts "=" * 70
    puts "MARK CORRUPTED EMAIL BLOBS"
    puts "=" * 70
    puts ""

    tenant = Tenant.find_by(name: "Tekna") || Tenant.first
    unless tenant
      puts "ERROR: No tenant found"
      exit 1
    end

    ActsAsTenant.with_tenant(tenant) do
      corrupted = StorageBlob.where("storage_path LIKE '%/eml/%'")
                             .where(file_missing: false)

      count = corrupted.count
      puts "Found #{count} corrupted email blobs with /eml/ paths"

      if count > 0
        puts "Marking as file_missing..."
        updated = corrupted.update_all(file_missing: true)
        puts "Marked #{updated} blobs as file_missing"
      end
    end
  end

  desc "Show blob storage health status"
  task health: :environment do
    puts "=" * 70
    puts "BLOB STORAGE HEALTH"
    puts "=" * 70
    puts ""

    tenant = Tenant.find_by(name: "Tekna") || Tenant.first
    unless tenant
      puts "ERROR: No tenant found"
      exit 1
    end

    ActsAsTenant.with_tenant(tenant) do
      config = StorageConfiguration.for_tenant(tenant)

      puts "Tenant:   #{tenant.name} (ID: #{tenant.id})"
      puts "Provider: #{config.provider_type}"
      puts "Bucket:   #{config.bucket || config.connection_config['bucket']}"
      puts ""

      # Total counts
      total = StorageBlob.count
      puts "Total StorageBlobs: #{total}"
      puts ""

      # Path format breakdown
      blobs_path = StorageBlob.where("storage_path LIKE '%Blobs/%'").count
      emails_path = StorageBlob.where("storage_path LIKE '%Emails/%'").count
      legacy_path = total - blobs_path - emails_path

      puts "Path formats:"
      puts "  Blobs/ (correct):  #{blobs_path} (#{(blobs_path.to_f / total * 100).round(1)}%)"
      puts "  Emails/ (legacy):  #{emails_path} (#{(emails_path.to_f / total * 100).round(1)}%)"
      puts "  Other (legacy):    #{legacy_path} (#{(legacy_path.to_f / total * 100).round(1)}%)"
      puts ""

      # Migration status
      needs_migration = StorageBlob.needing_migration.count
      file_missing = StorageBlob.missing_file.count
      verified = StorageBlob.verified.count

      puts "Migration status:"
      puts "  Needs migration:   #{needs_migration}"
      puts "  File missing:      #{file_missing}"
      puts "  Verified:          #{verified}"
      puts ""

      # Content hash status
      with_hash = StorageBlob.where.not(content_hash: nil).count
      without_hash = total - with_hash

      puts "Content hash:"
      puts "  With hash:         #{with_hash} (#{(with_hash.to_f / total * 100).round(1)}%)"
      puts "  Without hash:      #{without_hash} (#{(without_hash.to_f / total * 100).round(1)}%)"
      puts ""

      # Multi-tenancy
      with_tenant = StorageBlob.where.not(tenant_id: nil).count rescue 0
      with_org = StorageBlob.where.not(organization_id: nil).count rescue 0

      puts "Multi-tenancy:"
      puts "  With tenant_id:    #{with_tenant}"
      puts "  With org_id:       #{with_org}"
      puts ""

      # Recommendations
      puts "=" * 70
      puts "RECOMMENDATIONS"
      puts "=" * 70

      if needs_migration > 0
        puts "⚠️  #{needs_migration} blobs need file copy from old bucket"
        puts "   Run: rails blob:copy_from_old"
      end

      if file_missing > 0
        puts "⚠️  #{file_missing} blobs have missing files (orphans)"
        puts "   Run: rails blob:cleanup_orphans[execute]"
      end

      if emails_path > 0
        puts "⚠️  #{emails_path} blobs use Emails/ path format"
        puts "   Run: rails email:blob:migrate[1000]"
      end

      if legacy_path > 0
        puts "⚠️  #{legacy_path} blobs use legacy paths"
        puts "   Run: rails blob:cleanup_legacy[execute]"
      end

      if without_hash > 0
        puts "ℹ️  #{without_hash} blobs without content_hash"
        puts "   These are legacy records - hash computed on next access"
      end

      if needs_migration == 0 && file_missing == 0 && emails_path == 0 && legacy_path == 0
        puts "✅ All blobs are healthy!"
      end
    end
  end
end
