# frozen_string_literal: true

namespace :warehouse do
  desc "Backfill warehouse_documents for all document types"
  task backfill_all: :environment do
    # Set tenant context
    org = Organization.first
    unless org
      puts "ERROR: No organization found"
      exit 1
    end
    ActsAsTenant.current_tenant = org
    puts "Using organization: #{org.name}\n\n"

    Rake::Task["warehouse:backfill_emails"].invoke
    Rake::Task["warehouse:backfill_corporate_docs"].invoke
    Rake::Task["warehouse:backfill_task_attachments"].invoke
  end

  desc "Backfill warehouse_documents for SyncedEmails"
  task backfill_emails: :environment do
    org = Organization.first
    ActsAsTenant.current_tenant = org if org

    puts "=== Backfilling SyncedEmail Warehouse Documents ==="

    without_wd = SyncedEmail.left_joins(:warehouse_document)
                            .where(warehouse_documents: { id: nil })
                            .where.not(storage_path: [nil, ''])

    total = without_wd.count
    puts "Emails without warehouse_document (with storage_path): #{total}"

    if total == 0
      puts "Nothing to backfill!"
      return
    end

    created = 0
    skipped = 0
    errors = 0

    without_wd.find_each do |email|
      begin
        # Find or create storage blob
        blob = email.storage_blob || StorageBlob.find_by(storage_path: email.storage_path)
        unless blob
          skipped += 1
          next
        end

        email.create_warehouse_document!(
          source_type: "email",
          folder: email.virtual_folder_path,
          display_name: email.subject.presence || "(No subject)",
          original_filename: "#{email.id}.eml",
          storage_blob: blob,
          metadata: {
            email_id: email.id,
            subject: email.subject,
            from_address: email.from_address,
            received_at: email.received_at&.iso8601,
            backfilled: true
          }
        )
        created += 1
        print "." if (created % 100) == 0
      rescue => e
        errors += 1
        puts "\n  Error email #{email.id}: #{e.message}" if errors <= 5
      end
    end

    puts "\n\nEmails: Created #{created}, Skipped #{skipped}, Errors #{errors}"
  end

  desc "Backfill warehouse_documents for CorporateCompanyDocuments"
  task backfill_corporate_docs: :environment do
    org = Organization.first
    ActsAsTenant.current_tenant = org if org

    puts "\n=== Backfilling CorporateCompanyDocument Warehouse Documents ==="

    without_wd = CorporateCompanyDocument.left_joins(:warehouse_document)
                                         .where(warehouse_documents: { id: nil })

    total = without_wd.count
    puts "Corporate docs without warehouse_document: #{total}"

    if total == 0
      puts "Nothing to backfill!"
      return
    end

    created = 0
    skipped = 0
    errors = 0

    without_wd.find_each do |doc|
      begin
        blob = doc.storage_blob
        unless blob
          skipped += 1
          next
        end

        doc.create_warehouse_document!(
          source_type: "corporate",
          folder: doc.respond_to?(:virtual_folder_path) ? doc.virtual_folder_path : "Corporate/#{doc.corporate_company_id}",
          display_name: doc.display_name.presence || doc.file_name,
          original_filename: doc.file_name,
          storage_blob: blob,
          metadata: {
            document_id: doc.id,
            document_type: doc.document_type,
            corporate_company_id: doc.corporate_company_id,
            backfilled: true
          }
        )
        created += 1
        print "."
      rescue => e
        errors += 1
        puts "\n  Error doc #{doc.id}: #{e.message}" if errors <= 5
      end
    end

    puts "\n\nCorporate docs: Created #{created}, Skipped #{skipped}, Errors #{errors}"
  end

  desc "Backfill warehouse_documents for SmTaskAttachments"
  task backfill_task_attachments: :environment do
    org = Organization.first
    ActsAsTenant.current_tenant = org if org

    puts "\n=== Backfilling SmTaskAttachment Warehouse Documents ==="

    without_wd = SmTaskAttachment.left_joins(:warehouse_document)
                                 .where(warehouse_documents: { id: nil })
                                 .includes(:attachable, :sm_task)

    total = without_wd.count
    puts "Task attachments without warehouse_document: #{total}"

    if total == 0
      puts "Nothing to backfill!"
      return
    end

    created = 0
    skipped = 0
    errors = 0

    without_wd.find_each do |att|
      begin
        blob = att.storage_blob
        unless blob
          skipped += 1
          next
        end

        folder = begin
          att.virtual_folder_path
        rescue
          "Tasks/#{att.sm_task_id}"
        end

        att.create_warehouse_document!(
          source_type: "task",
          folder: folder,
          display_name: att.display_name,
          original_filename: att.attachable&.try(:file_name) || att.attachable&.try(:filename),
          storage_blob: blob,
          metadata: {
            task_id: att.sm_task_id,
            category: att.category,
            attachable_type: att.attachable_type,
            backfilled: true
          }
        )
        created += 1
        print "."
      rescue => e
        errors += 1
        puts "\n  Error att #{att.id}: #{e.message}" if errors <= 5
      end
    end

    puts "\n\nTask attachments: Created #{created}, Skipped #{skipped}, Errors #{errors}"
  end

  desc "Clean up orphaned documents (no storage_blob, not used anywhere)"
  task cleanup_orphans: :environment do
    org = Organization.first
    ActsAsTenant.current_tenant = org if org

    puts "=== Cleaning Up Orphaned Documents ==="

    # Find CorporateCompanyDocuments without storage_blob
    orphans = CorporateCompanyDocument.where(storage_blob_id: nil)
    puts "\nCorporateCompanyDocument orphans (no storage_blob): #{orphans.count}"

    deleted = 0
    skipped = 0

    orphans.find_each do |doc|
      # Check if used in tasks
      task_count = SmTaskAttachment.where(attachable: doc).count
      if task_count > 0
        puts "  SKIP ID #{doc.id}: #{doc.file_name} - used in #{task_count} tasks"
        skipped += 1
      else
        puts "  DELETE ID #{doc.id}: #{doc.file_name}"
        doc.destroy
        deleted += 1
      end
    end

    puts "\nDeleted: #{deleted}, Skipped: #{skipped}"
  end

  desc "Show warehouse document coverage stats"
  task stats: :environment do
    puts "=== WAREHOUSE DOCUMENT COVERAGE ==="

    puts "\nSyncedEmail:"
    total = SyncedEmail.count
    with_wd = SyncedEmail.joins(:warehouse_document).count
    puts "  Total: #{total}, With WD: #{with_wd}, Without: #{total - with_wd}"

    puts "\nCorporateCompanyDocument:"
    total = CorporateCompanyDocument.count
    with_wd = CorporateCompanyDocument.joins(:warehouse_document).count
    puts "  Total: #{total}, With WD: #{with_wd}, Without: #{total - with_wd}"

    puts "\nSmTaskAttachment:"
    total = SmTaskAttachment.count
    with_wd = SmTaskAttachment.joins(:warehouse_document).count
    puts "  Total: #{total}, With WD: #{with_wd}, Without: #{total - with_wd}"

    puts "\nJobDocument:"
    total = JobDocument.count
    with_wd = JobDocument.joins(:warehouse_document).count rescue 0
    puts "  Total: #{total}, With WD: #{with_wd}, Without: #{total - with_wd}"

    puts "\n=== BY SOURCE TYPE ==="
    WarehouseDocument.group(:source_type).count.sort_by { |_, v| -v }.each do |source, count|
      puts "  #{source}: #{count}"
    end
  end
end
