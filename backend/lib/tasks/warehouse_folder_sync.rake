# frozen_string_literal: true

namespace :warehouse do
  desc "Initialize/update StorageConfiguration with correct warehouse templates"
  task init: :environment do
    puts "=" * 60
    puts "WAREHOUSE CONFIGURATION INIT"
    puts "=" * 60

    config = StorageConfiguration.instance
    current = config.warehouse_root_folders || {}
    defaults = StorageConfiguration::WAREHOUSE_ROOT_DEFAULTS

    puts "\nCurrent warehouse_root_folders:"
    current.each { |k, v| puts "  #{k}: #{v}" }

    puts "\nMissing keys:"
    missing = defaults.keys - current.keys
    if missing.empty?
      puts "  (none)"
    else
      missing.each { |k| puts "  #{k}: #{defaults[k]}" }
    end

    # Merge in missing keys
    updated = current.merge(defaults) { |_key, old_val, _new_val| old_val } # Keep existing values
    config.update!(warehouse_root_folders: updated)

    puts "\nUpdated warehouse_root_folders:"
    config.reload.warehouse_root_folders.each { |k, v| puts "  #{k}: #{v}" }

    puts "\n" + "=" * 60
    puts "INIT COMPLETE"
    puts "=" * 60
  end

  # SSoT: Expected root folders per StorageConfiguration::WAREHOUSE_ROOT_DEFAULTS
  # - Jobs (from JobDocument → 'Jobs/{{JobCode}}')
  # - Contacts (from ContactDocument → 'Contacts/{{ContactName}}')
  # - Corporate (from CorporateCompanyDocument → 'Corporate/{{CompanyGroup}}')
  # - Emails (from SyncedEmail + EmailAttachment → 'Emails/{{Mailbox}}')
  # - Tasks (from SmTaskAttachment → 'Tasks/{{TaskId}}')
  # - Warehousing (from UserDocument → 'Warehousing/{{UserName}}')
  EXPECTED_ROOT_FOLDERS = %w[Jobs Contacts Corporate Emails Tasks Warehousing].freeze

  desc "Audit folder structure - show all root folders and their counts"
  task audit: :environment do
    puts "=" * 60
    puts "WAREHOUSE FOLDER AUDIT"
    puts "=" * 60

    # Get root folder distribution
    folders = WarehouseDocument.pluck(:folder).compact
    root_counts = Hash.new(0)

    folders.each do |folder|
      root = folder.split("/").first
      root_counts[root] += 1
    end

    puts "\nRoot Folder Distribution:"
    puts "-" * 40
    root_counts.sort_by { |_, count| -count }.each do |root, count|
      status = EXPECTED_ROOT_FOLDERS.include?(root) ? "✓" : "⚠️  UNEXPECTED"
      puts "  #{status} #{root.ljust(20)} #{count}"
    end

    # Check for case mismatches
    puts "\n\nCase Mismatch Analysis:"
    puts "-" * 40
    EXPECTED_ROOT_FOLDERS.each do |expected|
      variants = root_counts.keys.select { |k| k.downcase == expected.downcase && k != expected }
      if variants.any?
        total = variants.sum { |v| root_counts[v] }
        puts "  ⚠️  '#{expected}' has case variants: #{variants.join(', ')} (#{total} docs)"
      end
    end

    # Unexpected folders
    unexpected = root_counts.keys.select { |k| !EXPECTED_ROOT_FOLDERS.map(&:downcase).include?(k.downcase) }
    if unexpected.any?
      puts "\n\nUnexpected Root Folders:"
      puts "-" * 40
      unexpected.each do |folder|
        puts "  ⚠️  #{folder}: #{root_counts[folder]} documents"
        # Sample some paths
        samples = WarehouseDocument.where("folder LIKE ?", "#{folder}%").limit(3).pluck(:folder)
        samples.each { |s| puts "      → #{s}" }
      end
    end

    puts "\n" + "=" * 60
    puts "Expected root folders: #{EXPECTED_ROOT_FOLDERS.join(', ')}"
    puts "Run 'rails warehouse:fix_folders' to normalize folder names"
  end

  desc "Fix folder names - recalculate all folders from documentable.virtual_folder_path"
  task fix_folders: :environment do
    puts "=" * 60
    puts "WAREHOUSE FOLDER FIX"
    puts "=" * 60
    puts "Recalculating ALL folder values from documentable.virtual_folder_path"

    stats = { fixed: 0, skipped: 0, errors: [] }

    # Process all WarehouseDocuments with invalid root folders
    # This recalculates the folder from the documentable's virtual_folder_path
    total = WarehouseDocument.count
    puts "\nProcessing #{total} documents..."

    WarehouseDocument.includes(:documentable).find_each.with_index do |doc, i|
      print "." if (i + 1) % 1000 == 0
      print "\n#{i + 1}/#{total} processed..." if (i + 1) % 10000 == 0

      begin
        # Get the documentable and check if it can compute virtual_folder_path
        documentable = doc.documentable
        unless documentable
          stats[:skipped] += 1
          next
        end

        unless documentable.respond_to?(:virtual_folder_path)
          stats[:skipped] += 1
          next
        end

        new_folder = documentable.virtual_folder_path
        if new_folder.blank?
          stats[:skipped] += 1
          next
        end

        # Only update if folder has changed
        if doc.folder != new_folder
          doc.update_column(:folder, new_folder)
          stats[:fixed] += 1
        else
          stats[:skipped] += 1
        end
      rescue => e
        stats[:errors] << "Doc #{doc.id}: #{e.message}"
      end
    end

    puts "\n\n" + "=" * 60
    puts "FIX COMPLETE"
    puts "=" * 60
    puts "Folders fixed:       #{stats[:fixed]}"
    puts "Already correct:     #{stats[:skipped]}"
    puts "Errors:              #{stats[:errors].count}"
    if stats[:errors].any?
      puts "\nFirst 10 errors:"
      stats[:errors].first(10).each { |e| puts "  - #{e}" }
    end
    puts "\nRun 'rails warehouse:audit' to verify results"
  end

  desc "Preview folder fixes without applying (dry run - shows first 50 changes)"
  task fix_folders_preview: :environment do
    puts "=" * 60
    puts "WAREHOUSE FOLDER FIX - DRY RUN"
    puts "=" * 60

    changes = []
    checked = 0

    WarehouseDocument.includes(:documentable).find_each do |doc|
      checked += 1
      break if changes.count >= 50

      begin
        documentable = doc.documentable
        next unless documentable&.respond_to?(:virtual_folder_path)

        new_folder = documentable.virtual_folder_path
        next if new_folder.blank?

        if doc.folder != new_folder
          changes << {
            id: doc.id,
            type: doc.documentable_type,
            old: doc.folder || "(nil)",
            new: new_folder
          }
        end
      rescue => e
        # Skip errors in preview
      end
    end

    if changes.any?
      puts "\nFirst #{changes.count} folder changes:"
      puts "-" * 60
      changes.each do |c|
        puts "  Doc #{c[:id]} (#{c[:type]}):"
        puts "    OLD: #{c[:old]}"
        puts "    NEW: #{c[:new]}"
        puts ""
      end
    else
      puts "\nNo changes needed - all folders in sync!"
    end

    puts "\nRun 'rails warehouse:fix_folders' to apply changes."
  end

  desc "Sync all WarehouseDocument.folder values to match current StorageConfiguration templates"
  task sync_folders: :environment do
    puts "=" * 60
    puts "WAREHOUSE DOCUMENT FOLDER SYNC"
    puts "=" * 60

    stats = { job: 0, corporate: 0, email: 0, skipped: 0, errors: [] }

    # 1. Sync JobDocuments
    puts "\n[1/3] Syncing JobDocuments..."
    JobDocument.includes(:warehouse_document, :job).find_each do |doc|
      next unless doc.warehouse_document.present?

      begin
        new_folder = doc.virtual_folder_path
        if doc.warehouse_document.folder != new_folder
          doc.warehouse_document.update_column(:folder, new_folder)
          stats[:job] += 1
        else
          stats[:skipped] += 1
        end
      rescue => e
        stats[:errors] << "JobDocument #{doc.id}: #{e.message}"
      end
    end
    puts "   Updated: #{stats[:job]} job documents"

    # 2. Sync CorporateCompanyDocuments
    puts "\n[2/3] Syncing CorporateCompanyDocuments..."
    CorporateCompanyDocument.includes(:warehouse_document, :corporate_company).find_each do |doc|
      next unless doc.warehouse_document.present?

      begin
        new_folder = doc.virtual_folder_path
        if doc.warehouse_document.folder != new_folder
          doc.warehouse_document.update_column(:folder, new_folder)
          stats[:corporate] += 1
        else
          stats[:skipped] += 1
        end
      rescue => e
        stats[:errors] << "CorporateCompanyDocument #{doc.id}: #{e.message}"
      end
    end
    puts "   Updated: #{stats[:corporate]} corporate documents"

    # 3. Sync SyncedEmail (if it has virtual_folder_path)
    puts "\n[3/3] Syncing SyncedEmail..."
    if defined?(SyncedEmail) && SyncedEmail.instance_methods.include?(:virtual_folder_path)
      SyncedEmail.includes(:warehouse_document).find_each do |doc|
        next unless doc.warehouse_document.present?

        begin
          new_folder = doc.virtual_folder_path
          if doc.warehouse_document.folder != new_folder
            doc.warehouse_document.update_column(:folder, new_folder)
            stats[:email] += 1
          else
            stats[:skipped] += 1
          end
        rescue => e
          stats[:errors] << "SyncedEmail #{doc.id}: #{e.message}"
        end
      end
      puts "   Updated: #{stats[:email]} email documents"
    else
      puts "   Skipped (no virtual_folder_path method)"
    end

    puts "\n" + "=" * 60
    puts "SYNC COMPLETE"
    puts "=" * 60
    puts "Job documents updated:       #{stats[:job]}"
    puts "Corporate documents updated: #{stats[:corporate]}"
    puts "Email documents updated:     #{stats[:email]}"
    puts "Already in sync (skipped):   #{stats[:skipped]}"
    puts "Errors:                      #{stats[:errors].count}"
    if stats[:errors].any?
      puts "\nFirst 10 errors:"
      stats[:errors].first(10).each { |e| puts "  - #{e}" }
    end
  end

  desc "Backfill WarehouseDocument entries for Warehousing folder models"
  task backfill_warehousing: :environment do
    puts "=" * 60
    puts "BACKFILL WAREHOUSING DOCUMENTS"
    puts "=" * 60
    puts "Creating WarehouseDocument entries for BillInbox, ChatMessage, NotebookPageAttachment"

    stats = { bill_inbox: 0, chat_message: 0, notebook: 0, skipped: 0, errors: [] }

    # 1. BillInbox
    puts "\n[1/3] Backfilling BillInbox..."
    BillInbox.includes(:storage_blob, :warehouse_document).where.not(storage_blob_id: nil).find_each do |bill|
      next if bill.warehouse_document.present?

      begin
        bill.send(:create_warehouse_entry)
        stats[:bill_inbox] += 1
        print "." if stats[:bill_inbox] % 10 == 0
      rescue => e
        stats[:errors] << "BillInbox #{bill.id}: #{e.message}"
      end
    end
    puts "\n   Created: #{stats[:bill_inbox]} warehouse documents"

    # 2. ChatMessage
    puts "\n[2/3] Backfilling ChatMessage..."
    ChatMessage.includes(:storage_blob, :warehouse_document).where.not(storage_blob_id: nil).find_each do |msg|
      next if msg.warehouse_document.present?

      begin
        msg.send(:create_warehouse_entry)
        stats[:chat_message] += 1
        print "." if stats[:chat_message] % 10 == 0
      rescue => e
        stats[:errors] << "ChatMessage #{msg.id}: #{e.message}"
      end
    end
    puts "\n   Created: #{stats[:chat_message]} warehouse documents"

    # 3. NotebookPageAttachment
    puts "\n[3/3] Backfilling NotebookPageAttachment..."
    NotebookPageAttachment.includes(:storage_blob, :warehouse_document).where.not(storage_blob_id: nil).find_each do |att|
      next if att.warehouse_document.present?

      begin
        att.send(:create_warehouse_entry)
        stats[:notebook] += 1
        print "." if stats[:notebook] % 10 == 0
      rescue => e
        stats[:errors] << "NotebookPageAttachment #{att.id}: #{e.message}"
      end
    end
    puts "\n   Created: #{stats[:notebook]} warehouse documents"

    puts "\n" + "=" * 60
    puts "BACKFILL COMPLETE"
    puts "=" * 60
    puts "BillInbox:              #{stats[:bill_inbox]}"
    puts "ChatMessage:            #{stats[:chat_message]}"
    puts "NotebookPageAttachment: #{stats[:notebook]}"
    puts "Errors:                 #{stats[:errors].count}"
    if stats[:errors].any?
      puts "\nFirst 10 errors:"
      stats[:errors].first(10).each { |e| puts "  - #{e}" }
    end
  end

  desc "Backfill WarehouseDocument entries for CorporateCompanyDocument and EmailAttachment"
  task backfill_documents: :environment do
    puts "=" * 60
    puts "BACKFILL DOCUMENT WAREHOUSE ENTRIES"
    puts "=" * 60
    puts "Creating WarehouseDocument entries for CorporateCompanyDocument, EmailAttachment"

    stats = { corporate: 0, email_attachment: 0, errors: [] }

    # 1. CorporateCompanyDocument
    puts "\n[1/2] Backfilling CorporateCompanyDocument..."
    total_corp = CorporateCompanyDocument.where.not(storage_blob_id: nil).count
    puts "       Processing #{total_corp} documents..."

    CorporateCompanyDocument.includes(:storage_blob, :warehouse_document, :corporate_company)
                            .where.not(storage_blob_id: nil).find_each.with_index do |doc, i|
      next if doc.warehouse_document.present?

      begin
        doc.send(:create_warehouse_entry)
        stats[:corporate] += 1
        print "." if stats[:corporate] % 100 == 0
        puts " #{stats[:corporate]}/#{total_corp}" if stats[:corporate] % 1000 == 0
      rescue => e
        stats[:errors] << "CorporateCompanyDocument #{doc.id}: #{e.message}"
      end
    end
    puts "\n   Created: #{stats[:corporate]} warehouse documents"

    # 2. EmailAttachment
    puts "\n[2/2] Backfilling EmailAttachment..."
    total_email = EmailAttachment.where.not(storage_blob_id: nil).count
    puts "       Processing #{total_email} attachments..."

    EmailAttachment.includes(:storage_blob, :warehouse_document, :synced_email)
                   .where.not(storage_blob_id: nil).find_each.with_index do |att, i|
      next if att.warehouse_document.present?

      begin
        att.send(:create_warehouse_entry)
        stats[:email_attachment] += 1
        print "." if stats[:email_attachment] % 100 == 0
        puts " #{stats[:email_attachment]}/#{total_email}" if stats[:email_attachment] % 1000 == 0
      rescue => e
        stats[:errors] << "EmailAttachment #{att.id}: #{e.message}"
      end
    end
    puts "\n   Created: #{stats[:email_attachment]} warehouse documents"

    puts "\n" + "=" * 60
    puts "BACKFILL COMPLETE"
    puts "=" * 60
    puts "CorporateCompanyDocument: #{stats[:corporate]}"
    puts "EmailAttachment:          #{stats[:email_attachment]}"
    puts "Errors:                   #{stats[:errors].count}"
    if stats[:errors].any?
      puts "\nFirst 10 errors:"
      stats[:errors].first(10).each { |e| puts "  - #{e}" }
    end
  end

  desc "Preview folder changes without applying (dry run)"
  task sync_folders_preview: :environment do
    puts "=" * 60
    puts "WAREHOUSE FOLDER SYNC PREVIEW (DRY RUN)"
    puts "=" * 60

    changes = []

    # Sample JobDocuments
    puts "\n[JobDocuments - first 10 changes]"
    JobDocument.includes(:warehouse_document, :job).limit(1000).each do |doc|
      next unless doc.warehouse_document.present?

      new_folder = doc.virtual_folder_path rescue nil
      next if new_folder.nil?

      if doc.warehouse_document.folder != new_folder
        changes << {
          type: "Job",
          id: doc.id,
          old: doc.warehouse_document.folder,
          new: new_folder
        }
        break if changes.count >= 10
      end
    end

    changes.each do |c|
      puts "  #{c[:type]} #{c[:id]}:"
      puts "    OLD: #{c[:old]}"
      puts "    NEW: #{c[:new]}"
      puts ""
    end

    if changes.empty?
      puts "  No changes needed - all folders in sync!"
    end

    puts "\nRun 'rails warehouse:sync_folders' to apply changes."
  end
end
