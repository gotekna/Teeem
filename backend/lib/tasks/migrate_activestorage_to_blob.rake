# frozen_string_literal: true

# Migrate remaining ActiveStorage attachments to StorageBlob
# SSoT: StorageBlob is THE ONE storage pattern (Jan 2026)
#
# This task migrates:
# - ContactDocument.file (16 records with attachments)
# - User.signature (1 record)
# - User.photo (1 record)
# - JobDocument.file, PeopleDocument.file, UserDocument.file, etc. (0 records - code only)
#
# Usage:
#   rails storage:migrate_to_blob              # Run migration
#   rails storage:migrate_to_blob[dry_run]     # Preview without changes
#   rails storage:migrate_to_blob[execute]     # Actually run the migration
#
namespace :storage do
  desc "Migrate remaining ActiveStorage attachments to StorageBlob (SSoT)"
  task :migrate_to_blob, [:mode] => :environment do |_t, args|
    mode = args[:mode] || "dry_run"
    dry_run = mode != "execute"

    puts "=" * 60
    puts "ActiveStorage to StorageBlob Migration"
    puts "Mode: #{dry_run ? 'DRY RUN (preview only)' : 'EXECUTE (making changes)'}"
    puts "=" * 60
    puts

    total_migrated = 0
    total_skipped = 0
    total_errors = 0

    # ===========================================
    # Migrate ContactDocument files
    # ===========================================
    puts "\n1. Migrating ContactDocument files..."
    puts "-" * 40

    begin
      # Find ContactDocuments with ActiveStorage attachments but no StorageBlob
      contact_docs = ContactDocument
        .left_joins(:storage_blob)
        .joins("INNER JOIN active_storage_attachments ON active_storage_attachments.record_id = contact_documents.id AND active_storage_attachments.record_type = 'ContactDocument' AND active_storage_attachments.name = 'file'")
        .where(storage_blobs: { id: nil })
        .distinct

      puts "  Found #{contact_docs.count} ContactDocuments with ActiveStorage to migrate"

      contact_docs.find_each do |doc|
        begin
          # Check if ActiveStorage attachment exists
          unless doc.respond_to?(:file) && doc.file.attached?
            puts "  [SKIP] ContactDocument ##{doc.id} - No ActiveStorage attachment"
            total_skipped += 1
            next
          end

          if doc.storage_blob_id.present?
            puts "  [SKIP] ContactDocument ##{doc.id} - Already has StorageBlob"
            total_skipped += 1
            next
          end

          if dry_run
            puts "  [DRY RUN] Would migrate ContactDocument ##{doc.id}: #{doc.file_name}"
            total_migrated += 1
          else
            # Download content from ActiveStorage
            content = doc.file.download
            filename = doc.file.filename.to_s
            content_type = doc.file.content_type

            # Create or find StorageBlob
            blob = StorageBlob.find_or_create_for_content!(
              content,
              filename: filename,
              content_type: content_type
            )

            # Update document
            doc.update!(storage_blob: blob)
            blob.increment_reference!

            puts "  [OK] Migrated ContactDocument ##{doc.id}: #{filename} -> StorageBlob ##{blob.id}"
            total_migrated += 1
          end
        rescue => e
          puts "  [ERROR] ContactDocument ##{doc.id}: #{e.message}"
          total_errors += 1
        end
      end
    rescue => e
      puts "  [ERROR] Failed to query ContactDocuments: #{e.message}"
    end

    # ===========================================
    # Migrate User signatures
    # ===========================================
    puts "\n2. Migrating User signatures..."
    puts "-" * 40

    begin
      # Find Users with ActiveStorage signature but no StorageBlob
      users_with_sig = User
        .left_outer_joins(:signature_blob)
        .joins("INNER JOIN active_storage_attachments ON active_storage_attachments.record_id = users.id AND active_storage_attachments.record_type = 'User' AND active_storage_attachments.name = 'signature'")
        .where(storage_blobs: { id: nil })
        .distinct

      puts "  Found #{users_with_sig.count} Users with ActiveStorage signature to migrate"

      users_with_sig.find_each do |user|
        begin
          # Check if ActiveStorage attachment exists
          unless user.respond_to?(:signature) && user.signature.attached?
            puts "  [SKIP] User ##{user.id} - No ActiveStorage signature"
            total_skipped += 1
            next
          end

          if user.signature_blob_id.present?
            puts "  [SKIP] User ##{user.id} - Already has signature_blob"
            total_skipped += 1
            next
          end

          if dry_run
            puts "  [DRY RUN] Would migrate User ##{user.id} signature: #{user.signature.filename}"
            total_migrated += 1
          else
            # Download content from ActiveStorage
            content = user.signature.download
            filename = user.signature.filename.to_s
            content_type = user.signature.content_type

            # Create or find StorageBlob
            blob = StorageBlob.find_or_create_for_content!(
              content,
              filename: filename,
              content_type: content_type
            )

            # Update user
            user.update!(signature_blob: blob)
            blob.increment_reference!

            puts "  [OK] Migrated User ##{user.id} signature: #{filename} -> StorageBlob ##{blob.id}"
            total_migrated += 1
          end
        rescue => e
          puts "  [ERROR] User ##{user.id} signature: #{e.message}"
          total_errors += 1
        end
      end
    rescue => e
      puts "  [ERROR] Failed to query Users with signatures: #{e.message}"
    end

    # ===========================================
    # Migrate User photos
    # ===========================================
    puts "\n3. Migrating User photos..."
    puts "-" * 40

    begin
      # Find Users with ActiveStorage photo but no StorageBlob
      users_with_photo = User
        .left_outer_joins(:photo_blob)
        .joins("INNER JOIN active_storage_attachments ON active_storage_attachments.record_id = users.id AND active_storage_attachments.record_type = 'User' AND active_storage_attachments.name = 'photo'")
        .where(storage_blobs: { id: nil })
        .distinct

      puts "  Found #{users_with_photo.count} Users with ActiveStorage photo to migrate"

      users_with_photo.find_each do |user|
        begin
          # Check if ActiveStorage attachment exists
          unless user.respond_to?(:photo) && user.photo.attached?
            puts "  [SKIP] User ##{user.id} - No ActiveStorage photo"
            total_skipped += 1
            next
          end

          if user.photo_blob_id.present?
            puts "  [SKIP] User ##{user.id} - Already has photo_blob"
            total_skipped += 1
            next
          end

          if dry_run
            puts "  [DRY RUN] Would migrate User ##{user.id} photo: #{user.photo.filename}"
            total_migrated += 1
          else
            # Download content from ActiveStorage
            content = user.photo.download
            filename = user.photo.filename.to_s
            content_type = user.photo.content_type

            # Create or find StorageBlob
            blob = StorageBlob.find_or_create_for_content!(
              content,
              filename: filename,
              content_type: content_type
            )

            # Update user
            user.update!(photo_blob: blob)
            blob.increment_reference!

            puts "  [OK] Migrated User ##{user.id} photo: #{filename} -> StorageBlob ##{blob.id}"
            total_migrated += 1
          end
        rescue => e
          puts "  [ERROR] User ##{user.id} photo: #{e.message}"
          total_errors += 1
        end
      end
    rescue => e
      puts "  [ERROR] Failed to query Users with photos: #{e.message}"
    end

    # ===========================================
    # Check other models (should be 0 records)
    # ===========================================
    puts "\n4. Checking other models for ActiveStorage attachments..."
    puts "-" * 40

    models_to_check = [
      { model: "JobDocument", attachment: "file" },
      { model: "PeopleDocument", attachment: "file" },
      { model: "UserDocument", attachment: "file" },
      { model: "NotebookPageAttachment", attachment: "file" },
      { model: "DocumentTask", attachment: "document" },
      { model: "Asset", attachment: "photos" },
      { model: "AssetExpense", attachment: "receipt" },
      { model: "AssetOdometerReading", attachment: "photo" },
      { model: "AssetServiceHistory", attachment: "invoice" },
      { model: "AssetServiceHistory", attachment: "document" },
      { model: "FinancialTransaction", attachment: "receipt" },
      { model: "PayNowRequest", attachment: "invoice_file" },
      { model: "PayNowRequest", attachment: "proof_photos" }
    ]

    models_to_check.each do |check|
      count = ActiveStorage::Attachment
        .where(record_type: check[:model], name: check[:attachment])
        .count
      if count > 0
        puts "  [WARN] #{check[:model]}.#{check[:attachment]}: #{count} ActiveStorage attachments (may need migration)"
      else
        puts "  [OK] #{check[:model]}.#{check[:attachment]}: 0 attachments"
      end
    end

    # ===========================================
    # Summary
    # ===========================================
    puts "\n" + "=" * 60
    puts "Migration Summary"
    puts "=" * 60
    puts "  Migrated: #{total_migrated}"
    puts "  Skipped:  #{total_skipped}"
    puts "  Errors:   #{total_errors}"
    puts

    if dry_run
      puts "This was a DRY RUN. To execute the migration, run:"
      puts "  rails storage:migrate_to_blob[execute]"
    else
      puts "Migration complete!"
      puts "You can safely remove ActiveStorage attachments with:"
      puts "  rails storage:cleanup_activestorage"
    end
    puts
  end

  desc "Cleanup orphaned ActiveStorage attachments after migration"
  task cleanup_activestorage: :environment do
    puts "=" * 60
    puts "ActiveStorage Cleanup (post-migration)"
    puts "=" * 60
    puts
    puts "This task is a placeholder for cleaning up ActiveStorage"
    puts "after confirming StorageBlob migration is complete."
    puts
    puts "Before running cleanup, verify:"
    puts "1. All files are accessible via StorageBlob"
    puts "2. No errors in application logs"
    puts "3. File downloads work correctly"
    puts
    puts "To implement: Delete from active_storage_attachments and active_storage_blobs"
    puts "where records have been migrated to StorageBlob."
  end

  desc "Show ActiveStorage vs StorageBlob statistics"
  task stats: :environment do
    puts "=" * 60
    puts "Storage Statistics"
    puts "=" * 60

    puts "\nActiveStorage:"
    puts "-" * 40
    attachments_by_type = ActiveStorage::Attachment
      .group(:record_type, :name)
      .count
      .sort_by { |k, v| -v }

    attachments_by_type.each do |(type, name), count|
      puts "  #{type}.#{name}: #{count}"
    end
    puts "  TOTAL: #{ActiveStorage::Attachment.count} attachments"
    puts "  BLOBS: #{ActiveStorage::Blob.count} blobs"

    puts "\nStorageBlob:"
    puts "-" * 40
    puts "  Total blobs: #{StorageBlob.count}"
    puts "  Total references: #{StorageBlob.sum(:reference_count)}"
    puts "  Unique content (by hash): #{StorageBlob.distinct.count(:content_hash)}"

    puts "\nMigration Progress:"
    puts "-" * 40

    # Check each model
    [
      { model: ContactDocument, blob_col: :storage_blob_id },
      { model: User, blob_col: :signature_blob_id, name: "signature" },
      { model: User, blob_col: :photo_blob_id, name: "photo" }
    ].each do |check|
      model = check[:model]
      blob_col = check[:blob_col]
      name = check[:name] || "file"

      total = model.count
      with_blob = model.where.not(blob_col => nil).count
      without_blob = total - with_blob

      puts "  #{model.name}.#{name}:"
      puts "    With StorageBlob: #{with_blob}"
      puts "    Without StorageBlob: #{without_blob}"
    end
  end
end
