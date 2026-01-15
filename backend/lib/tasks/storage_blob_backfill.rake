# frozen_string_literal: true

# Storage Blob Backfill - Migrate ActiveStorage files to StorageBlob (SSoT)
#
# This migrates existing ActiveStorage attachments to the StorageBlob system:
# - Downloads content from ActiveStorage
# - Computes SHA256 content_hash for deduplication
# - Creates or finds existing StorageBlob
# - Links document to storage_blob_id
#
# SSoT Architecture:
#   Document → StorageBlob (deduplicated by content_hash)
#
# Usage:
#   # Dry run (show what would be migrated)
#   rails storage_blob:backfill
#
#   # Actually migrate (start with small batch)
#   rails storage_blob:backfill[execute,100]
#
#   # Full migration
#   rails storage_blob:backfill[execute]
#
namespace :storage_blob do
  desc "Backfill StorageBlob from ActiveStorage attachments"
  task :backfill, [:mode, :limit] => :environment do |_t, args|
    mode = args[:mode] || "dry_run"
    limit = args[:limit]&.to_i
    execute = mode == "execute"

    puts "=" * 70
    puts "StorageBlob Backfill from ActiveStorage"
    puts "Mode: #{execute ? 'EXECUTE' : 'DRY RUN (preview only)'}"
    puts "Limit: #{limit || 'No limit'}"
    puts "=" * 70
    puts ""

    total_migrated = 0
    total_deduplicated = 0
    total_errors = 0
    total_skipped = 0

    # Process CorporateCompanyDocument
    # Strategy: Use content_hash + storage_path (already in S3) - no ActiveStorage download needed
    puts "-" * 70
    puts "Processing CorporateCompanyDocument"
    puts "-" * 70

    # SSoT: Process documents that have storage_path (already in S3) but no storage_blob_id
    scope = CorporateCompanyDocument.where(storage_blob_id: nil).where.not(storage_path: nil).where.not(content_hash: nil)
    scope = scope.limit(limit) if limit.present?

    total_to_process = scope.count
    puts "Found #{total_to_process} documents with storage_path+content_hash (no storage_blob_id)"

    if total_to_process == 0
      puts "  Nothing to process"
    else
      scope.find_each.with_index do |doc, index|
        # Progress indicator
        if (index + 1) % 100 == 0 || index == 0
          puts "  Progress: #{index + 1}/#{total_to_process}"
        end

        begin
          if execute
            # Check if blob with this hash already exists (deduplication)
            existing_blob = StorageBlob.find_by(content_hash: doc.content_hash)

            if existing_blob
              # Dedupe - reuse existing blob
              doc.update_column(:storage_blob_id, existing_blob.id)
              existing_blob.increment_reference!
              total_deduplicated += 1
              total_migrated += 1
            else
              # Create new blob from existing S3 data (no download needed!)
              blob = StorageBlob.create!(
                content_hash: doc.content_hash,
                storage_path: doc.storage_path,
                file_size: doc.file_size,
                original_filename: doc.file_name,
                content_type: doc.mime_type,
                reference_count: 1
              )
              doc.update_column(:storage_blob_id, blob.id)
              total_migrated += 1
            end
          else
            # Dry run
            existing = StorageBlob.find_by(content_hash: doc.content_hash)
            if existing
              puts "  Doc #{doc.id}: Would dedupe to blob #{existing.id}" if index < 5
              total_deduplicated += 1
            else
              puts "  Doc #{doc.id}: Would create new blob" if index < 5
            end
            total_migrated += 1
          end

        rescue StandardError => e
          puts "  ERROR Doc #{doc.id}: #{e.message}"
          total_errors += 1
        end
      end
    end

    # Process ChatMessage (5 records)
    puts ""
    puts "-" * 70
    puts "Processing ChatMessage"
    puts "-" * 70

    chat_scope = ChatMessage.where(storage_blob_id: nil)
    chat_total = chat_scope.count
    puts "Found #{chat_total} chat messages without storage_blob_id"

    chat_scope.find_each do |msg|
      begin
        unless msg.file.attached?
          total_skipped += 1
          next
        end

        content = msg.file.download

        if execute
          blob = StorageBlob.find_or_create_for_content!(
            content,
            filename: msg.file.filename.to_s,
            content_type: msg.file.content_type
          )
          msg.update_column(:storage_blob_id, blob.id)
          blob.increment_reference!
          total_migrated += 1
          total_deduplicated += 1 if blob.reference_count > 1
        else
          total_migrated += 1
        end
      rescue StandardError => e
        puts "  ERROR ChatMessage #{msg.id}: #{e.message}"
        total_errors += 1
      end
    end

    # Process BillInbox (2 records)
    puts ""
    puts "-" * 70
    puts "Processing BillInbox"
    puts "-" * 70

    bill_scope = BillInbox.where(storage_blob_id: nil)
    bill_total = bill_scope.count
    puts "Found #{bill_total} bill inbox items without storage_blob_id"

    bill_scope.find_each do |bill|
      begin
        unless bill.invoice_file.attached?
          total_skipped += 1
          next
        end

        content = bill.invoice_file.download

        if execute
          blob = StorageBlob.find_or_create_for_content!(
            content,
            filename: bill.invoice_file.filename.to_s,
            content_type: bill.invoice_file.content_type
          )
          bill.update_column(:storage_blob_id, blob.id)
          blob.increment_reference!
          total_migrated += 1
          total_deduplicated += 1 if blob.reference_count > 1
        else
          total_migrated += 1
        end
      rescue StandardError => e
        puts "  ERROR BillInbox #{bill.id}: #{e.message}"
        total_errors += 1
      end
    end

    puts ""
    puts "=" * 70
    puts "Summary"
    puts "=" * 70
    puts "Total #{execute ? 'migrated' : 'to migrate'}: #{total_migrated}"
    puts "Total deduplicated: #{total_deduplicated}"
    puts "Total errors: #{total_errors}"
    puts "Total skipped (no file): #{total_skipped}"
    puts ""

    unless execute
      puts "To execute the migration, run:"
      puts "  rails storage_blob:backfill[execute]"
      puts ""
      puts "Or start with a small batch:"
      puts "  rails storage_blob:backfill[execute,100]"
    end
  end

  desc "Check StorageBlob migration status"
  task status: :environment do
    puts "=" * 70
    puts "StorageBlob Migration Status"
    puts "=" * 70
    puts ""

    {
      "CorporateCompanyDocument" => CorporateCompanyDocument,
      "ChatMessage" => ChatMessage,
      "BillInbox" => BillInbox
    }.each do |name, model|
      total = model.count
      with_blob = model.where.not(storage_blob_id: nil).count
      with_active_storage = model.joins(:file_attachment).count rescue 0

      puts "#{name}:"
      puts "  Total records: #{total}"
      puts "  With storage_blob_id: #{with_blob} (#{(with_blob.to_f / total * 100).round(1)}%)"
      puts "  With ActiveStorage: #{with_active_storage}"
      puts "  Remaining to migrate: #{total - with_blob}"
      puts ""
    end

    puts "StorageBlob stats:"
    puts "  Total blobs: #{StorageBlob.count}"
    puts "  Total references: #{StorageBlob.sum(:reference_count)}"
    puts "  Orphaned blobs: #{StorageBlob.orphaned.count}"
    puts ""

    # Deduplication stats
    total_docs = CorporateCompanyDocument.where.not(storage_blob_id: nil).count
    unique_blobs = CorporateCompanyDocument.where.not(storage_blob_id: nil).distinct.count(:storage_blob_id)
    if unique_blobs > 0 && total_docs > 0
      dedup_ratio = ((total_docs - unique_blobs).to_f / total_docs * 100).round(1)
      puts "Deduplication:"
      puts "  Documents with blobs: #{total_docs}"
      puts "  Unique blobs: #{unique_blobs}"
      puts "  Deduplication ratio: #{dedup_ratio}%"
    end
  end

  private

  def find_or_create_blob_from_existing(doc)
    return nil unless doc.content_hash.present?

    # Check if blob already exists with this hash
    existing = StorageBlob.find_by(content_hash: doc.content_hash)
    return existing if existing

    # Need to download content to create blob
    # Try SharePoint if we have the reference
    if doc.storage_reference.present?
      begin
        content = download_from_storage(doc)
        return nil unless content

        StorageBlob.find_or_create_for_content!(
          content,
          filename: doc.file_name,
          content_type: doc.mime_type
        )
      rescue StandardError => e
        Rails.logger.error "[StorageBlobBackfill] Failed to create blob from storage: #{e.message}"
        nil
      end
    end
  end

  def download_from_storage(doc)
    config = StorageConfiguration.instance
    provider = case config.provider_type
    when "wasabi", "s3"
      credential = S3CompatibleCredential.active.first
      DocumentProviders::S3Compatible.new(credential)
    when "sharepoint"
      credential = MicrosoftCredential.sharepoint_credential
      DocumentProviders::SharePoint.new(credential)
    else
      raise "Unknown storage provider: #{config.provider_type}"
    end

    result = provider.download_file(doc.storage_path || doc.storage_reference)
    result[:success] ? result[:content] : nil
  end
end
