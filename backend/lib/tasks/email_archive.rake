# frozen_string_literal: true

# Email Archive Tasks - Prepare for Outlook shutdown
#
# These tasks ensure all email data is fully archived to S3 before
# losing access to Microsoft 365.
#
# Usage:
#   rails email:archive:status           # Check current state
#   rails email:archive:attachments      # Download missing attachments (needs Outlook)
#   rails email:archive:generate_eml     # Generate .eml files from DB (no Outlook needed)
#   rails email:archive:all              # Run both steps

namespace :email do
  namespace :archive do
    desc "Check email archive status"
    task status: :environment do
      puts "=" * 60
      puts "EMAIL ARCHIVE STATUS"
      puts "=" * 60
      puts ""

      # Email counts
      total_emails = SyncedEmail.count
      with_storage = SyncedEmail.where.not(storage_path: [nil, ""]).count
      without_storage = total_emails - with_storage

      puts "EMAILS:"
      puts "  Total:                    #{total_emails.to_s.rjust(10)}"
      puts "  With .eml in S3:          #{with_storage.to_s.rjust(10)} ✓"
      puts "  Need .eml generated:      #{without_storage.to_s.rjust(10)} ⚠"
      puts ""

      # Attachment counts
      total_attachments = EmailAttachment.count
      with_blob = EmailAttachment.where.not(storage_blob_id: nil).count
      without_blob = total_attachments - with_blob

      puts "ATTACHMENTS:"
      puts "  Total:                    #{total_attachments.to_s.rjust(10)}"
      puts "  In S3:                    #{with_blob.to_s.rjust(10)} ✓"
      puts "  Need download (Outlook):  #{without_blob.to_s.rjust(10)} ⚠"
      puts ""

      # Warehouse documents
      warehouse_docs = WarehouseDocument.where(documentable_type: "SyncedEmail").count
      puts "WAREHOUSE DOCUMENTS:"
      puts "  Email documents:          #{warehouse_docs.to_s.rjust(10)}"
      puts ""

      puts "=" * 60
      if without_blob > 0
        puts "⚠️  ACTION REQUIRED: Run 'rails email:archive:attachments' BEFORE Outlook shutdown"
      else
        puts "✓  All attachments downloaded - safe to proceed without Outlook"
      end

      if without_storage > 0
        puts "ℹ️  Run 'rails email:archive:generate_eml' to create .eml files (no Outlook needed)"
      end
      puts "=" * 60
    end

    desc "Download missing attachments from Outlook (REQUIRES OUTLOOK ACCESS)"
    task attachments: :environment do
      missing = EmailAttachment.where(storage_blob_id: nil)
      total = missing.count

      if total == 0
        puts "✓ All attachments already downloaded!"
        exit 0
      end

      puts "=" * 60
      puts "DOWNLOADING MISSING ATTACHMENTS"
      puts "=" * 60
      puts "Total to download: #{total}"
      puts ""
      puts "⚠️  This requires Outlook access. Run BEFORE shutdown!"
      puts ""

      downloaded = 0
      failed = 0
      errors = []

      missing.find_each.with_index do |attachment, index|
        email = attachment.synced_email
        unless email
          puts "  [#{index + 1}/#{total}] ✗ Orphaned attachment #{attachment.id} - no email"
          failed += 1
          next
        end

        print "  [#{index + 1}/#{total}] #{attachment.filename&.truncate(40)}... "

        begin
          # Re-sync attachments for this email (force: true to re-download even if records exist)
          email.sync_attachments!(force: true)

          # Check if this attachment now has a blob
          attachment.reload
          if attachment.storage_blob_id.present?
            puts "✓"
            downloaded += 1
          else
            puts "✗ (no blob after sync)"
            failed += 1
            errors << { id: attachment.id, filename: attachment.filename, error: "No blob after sync" }
          end
        rescue StandardError => e
          puts "✗ (#{e.message.truncate(50)})"
          failed += 1
          errors << { id: attachment.id, filename: attachment.filename, error: e.message }
        end
      end

      puts ""
      puts "=" * 60
      puts "RESULTS:"
      puts "  Downloaded: #{downloaded}"
      puts "  Failed:     #{failed}"
      puts "=" * 60

      if errors.any?
        puts ""
        puts "ERRORS:"
        errors.first(10).each do |err|
          puts "  - #{err[:filename]}: #{err[:error]}"
        end
        puts "  ... and #{errors.count - 10} more" if errors.count > 10
      end
    end

    desc "Generate .eml files from database (NO Outlook needed)"
    task generate_eml: :environment do
      generate_eml_files(dry_run: false)
    end

    desc "Generate .eml files - DRY RUN (show what would be done)"
    task generate_eml_dry_run: :environment do
      generate_eml_files(dry_run: true)
    end

    desc "Run full archive: attachments then .eml generation"
    task all: :environment do
      puts "=" * 60
      puts "FULL EMAIL ARCHIVE"
      puts "=" * 60
      puts ""

      # Step 1: Attachments
      puts "STEP 1: Downloading missing attachments..."
      Rake::Task["email:archive:attachments"].invoke
      puts ""

      # Step 2: Generate .eml
      puts "STEP 2: Generating .eml files..."
      Rake::Task["email:archive:generate_eml"].invoke
      puts ""

      # Final status
      puts "STEP 3: Final status check..."
      Rake::Task["email:archive:status"].invoke
    end

    private

    def generate_eml_files(dry_run: false)
      # Find emails without storage_path (no .eml in S3)
      missing = SyncedEmail.where(storage_path: [nil, ""])
      total = missing.count

      if total == 0
        puts "✓ All emails already have .eml files in S3!"
        return
      end

      puts "=" * 60
      puts dry_run ? "GENERATE .EML FILES (DRY RUN)" : "GENERATING .EML FILES"
      puts "=" * 60
      puts "Total to generate: #{total}"
      puts "This does NOT require Outlook - uses data from database."
      puts ""

      if dry_run
        puts "DRY RUN - No files will be created"
        puts ""
        puts "Sample of emails to process:"
        missing.limit(10).each do |email|
          att_count = email.email_attachments.count
          att_status = email.email_attachments.where(storage_blob_id: nil).count
          att_warning = att_status > 0 ? " (#{att_status} attachments missing!)" : ""
          puts "  - #{email.subject&.truncate(50)} (#{email.received_at&.strftime('%Y-%m-%d')})#{att_warning}"
        end
        puts "  ... and #{total - 10} more" if total > 10
        puts ""
        puts "Run 'rails email:archive:generate_eml' to actually generate files."
        return
      end

      generated = 0
      failed = 0
      errors = []

      # Process in batches for memory efficiency
      batch_size = 100
      batch_num = 0

      missing.find_in_batches(batch_size: batch_size) do |batch|
        batch_num += 1
        batch_start = (batch_num - 1) * batch_size + 1
        batch_end = [batch_num * batch_size, total].min

        puts "Processing batch #{batch_num} (#{batch_start}-#{batch_end} of #{total})..."

        batch.each do |email|
          begin
            result = EmlGeneratorService.generate_and_upload(email)

            if result
              generated += 1
            else
              failed += 1
              errors << { id: email.id, subject: email.subject, error: "generate_and_upload returned nil" }
            end
          rescue StandardError => e
            failed += 1
            errors << { id: email.id, subject: email.subject, error: e.message }
            Rails.logger.error("[EmailArchive] Failed to generate .eml for #{email.id}: #{e.message}")
          end
        end

        # Progress update
        progress = ((batch_end.to_f / total) * 100).round(1)
        puts "  Batch complete. Progress: #{progress}% (#{generated} generated, #{failed} failed)"
      end

      puts ""
      puts "=" * 60
      puts "RESULTS:"
      puts "  Generated: #{generated}"
      puts "  Failed:    #{failed}"
      puts "=" * 60

      if errors.any?
        puts ""
        puts "ERRORS (first 20):"
        errors.first(20).each do |err|
          puts "  - [#{err[:id]}] #{err[:subject]&.truncate(40)}: #{err[:error].truncate(50)}"
        end
        puts "  ... and #{errors.count - 20} more" if errors.count > 20
      end
    end
  end
end
