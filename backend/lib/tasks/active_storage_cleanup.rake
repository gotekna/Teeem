# frozen_string_literal: true

# ActiveStorage Cleanup - Remove orphan attachments and blobs
#
# After migrating to StorageBlob, this task cleans up:
# - ActiveStorage::Attachment records for migrated models
# - Orphan ActiveStorage::Blob records (no attachments)
#
# Usage:
#   # Dry run (show what would be deleted)
#   rails active_storage:cleanup
#
#   # Actually delete
#   rails active_storage:cleanup[execute]
#
namespace :active_storage do
  desc "Clean up ActiveStorage records for models migrated to StorageBlob"
  task :cleanup, [:mode] => :environment do |_t, args|
    mode = args[:mode] || "dry_run"
    execute = mode == "execute"

    puts "=" * 70
    puts "ActiveStorage Cleanup"
    puts "Mode: #{execute ? 'EXECUTE' : 'DRY RUN (preview only)'}"
    puts "=" * 70
    puts ""

    # Models that have been migrated to StorageBlob
    migrated_models = %w[
      CorporateCompanyDocument
      ChatMessage
      BillInbox
      EmailWarehouse
      SmTask
    ]

    total_attachments = 0
    total_blobs = 0

    puts "-" * 70
    puts "Attachment Records to Delete"
    puts "-" * 70

    migrated_models.each do |model_name|
      count = ActiveStorage::Attachment.where(record_type: model_name).count
      puts "  #{model_name}: #{count} attachments"
      total_attachments += count

      if execute && count > 0
        ActiveStorage::Attachment.where(record_type: model_name).delete_all
        puts "    [DELETED]"
      end
    end

    puts ""
    puts "Total attachments: #{total_attachments}"

    puts ""
    puts "-" * 70
    puts "Orphan Blobs (No Attachments)"
    puts "-" * 70

    orphan_blobs = ActiveStorage::Blob.where.not(
      id: ActiveStorage::Attachment.select(:blob_id)
    )
    orphan_count = orphan_blobs.count
    puts "  Orphan blobs: #{orphan_count}"

    if execute && orphan_count > 0
      # Delete blobs in batches to avoid memory issues
      orphan_blobs.find_each do |blob|
        begin
          # Just delete the record, don't try to delete from storage
          # (files may already be moved or storage unavailable)
          blob.delete
        rescue StandardError => e
          puts "  ERROR deleting blob #{blob.id}: #{e.message}"
        end
      end
      puts "    [DELETED]"
    end

    puts ""
    puts "=" * 70
    puts "Summary"
    puts "=" * 70
    puts "Attachments #{execute ? 'deleted' : 'to delete'}: #{total_attachments}"
    puts "Orphan blobs #{execute ? 'deleted' : 'to delete'}: #{orphan_count}"
    puts ""

    unless execute
      puts "To execute the cleanup, run:"
      puts "  rails active_storage:cleanup[execute]"
    end
  end

  desc "Show ActiveStorage usage statistics"
  task stats: :environment do
    puts "=" * 70
    puts "ActiveStorage Statistics"
    puts "=" * 70
    puts ""

    puts "Attachments by record type:"
    ActiveStorage::Attachment.group(:record_type).count.each do |type, count|
      puts "  #{type}: #{count}"
    end

    puts ""
    puts "Total attachments: #{ActiveStorage::Attachment.count}"
    puts "Total blobs: #{ActiveStorage::Blob.count}"

    orphan_count = ActiveStorage::Blob.where.not(
      id: ActiveStorage::Attachment.select(:blob_id)
    ).count
    puts "Orphan blobs: #{orphan_count}"

    puts ""
    puts "Blob storage size:"
    total_size = ActiveStorage::Blob.sum(:byte_size)
    puts "  Total: #{(total_size.to_f / 1024 / 1024 / 1024).round(2)} GB"
  end
end
