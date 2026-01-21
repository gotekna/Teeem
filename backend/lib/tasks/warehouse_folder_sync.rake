# frozen_string_literal: true

namespace :warehouse do
  # SSoT: Expected root folders per StorageConfiguration::WAREHOUSE_ROOT_DEFAULTS
  # - Jobs (from job → 'Jobs/{{JobCode}}')
  # - Contacts (from contact → 'Contacts/{{ContactName}}')
  # - Corporate (from corporate_entity → 'Corporate/{{CompanyGroup}}')
  # - Emails (from email → 'Emails/{{Mailbox}}')
  # - Warehousing (from warehouse → 'Warehousing')
  # - Tasks (from task → 'Jobs/{{JobCode}}/Tasks' but some legacy may be standalone)
  EXPECTED_ROOT_FOLDERS = %w[Jobs Contacts Corporate Emails Warehousing Tasks].freeze

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

  desc "Fix folder names - normalize case and re-parent orphaned folders"
  task fix_folders: :environment do
    puts "=" * 60
    puts "WAREHOUSE FOLDER FIX"
    puts "=" * 60

    stats = { case_fixed: 0, reparented: 0, errors: [] }

    # 1. Fix case mismatches (jobs → Jobs, etc.)
    puts "\n[1/3] Fixing case mismatches..."
    EXPECTED_ROOT_FOLDERS.each do |expected|
      # Find all case variants
      WarehouseDocument.where("folder ~* ?", "^#{expected.downcase}/").find_each do |doc|
        old_folder = doc.folder
        root = old_folder.split("/").first
        next if root == expected # Already correct case

        new_folder = old_folder.sub(/^#{Regexp.escape(root)}/, expected)
        doc.update_column(:folder, new_folder)
        stats[:case_fixed] += 1
      end

      # Also fix root-only folders
      WarehouseDocument.where("LOWER(folder) = ?", expected.downcase).where.not(folder: expected).find_each do |doc|
        doc.update_column(:folder, expected)
        stats[:case_fixed] += 1
      end
    end
    puts "   Fixed #{stats[:case_fixed]} case mismatches"

    # 2. Handle "Users" folder (removed in Jan 2026 - Users are auth only)
    puts "\n[2/3] Handling 'Users' folder..."
    users_count = WarehouseDocument.where("folder LIKE 'Users%'").count
    if users_count > 0
      # Re-parent to Contacts if possible via documentable
      WarehouseDocument.where("folder LIKE 'Users%'").find_each do |doc|
        begin
          # Try to compute new path from documentable
          if doc.documentable.respond_to?(:virtual_folder_path)
            new_folder = doc.documentable.virtual_folder_path
            doc.update_column(:folder, new_folder)
            stats[:reparented] += 1
          else
            # Fallback: Move to Warehousing/Legacy
            new_folder = "Warehousing/Legacy/Users/#{doc.folder.sub('Users/', '')}"
            doc.update_column(:folder, new_folder)
            stats[:reparented] += 1
          end
        rescue => e
          stats[:errors] << "Doc #{doc.id}: #{e.message}"
        end
      end
      puts "   Reparented #{stats[:reparented]} from Users folder"
    else
      puts "   No Users folder documents found"
    end

    # 3. Handle "Attachments" folder (legacy - should be under source folder)
    puts "\n[3/3] Handling 'Attachments' folder..."
    attachments_count = WarehouseDocument.where("folder LIKE 'Attachments%'").count
    if attachments_count > 0
      reparented_attachments = 0
      WarehouseDocument.where("folder LIKE 'Attachments%'").find_each do |doc|
        begin
          if doc.documentable.respond_to?(:virtual_folder_path)
            new_folder = doc.documentable.virtual_folder_path
            doc.update_column(:folder, new_folder)
            reparented_attachments += 1
          else
            # Fallback: Move to Warehousing/Legacy
            new_folder = "Warehousing/Legacy/#{doc.folder}"
            doc.update_column(:folder, new_folder)
            reparented_attachments += 1
          end
        rescue => e
          stats[:errors] << "Attachment doc #{doc.id}: #{e.message}"
        end
      end
      puts "   Reparented #{reparented_attachments} from Attachments folder"
    else
      puts "   No Attachments folder documents found"
    end

    puts "\n" + "=" * 60
    puts "FIX COMPLETE"
    puts "=" * 60
    puts "Case mismatches fixed: #{stats[:case_fixed]}"
    puts "Documents reparented:  #{stats[:reparented]}"
    puts "Errors:                #{stats[:errors].count}"
    if stats[:errors].any?
      puts "\nFirst 10 errors:"
      stats[:errors].first(10).each { |e| puts "  - #{e}" }
    end
    puts "\nRun 'rails warehouse:audit' to verify results"
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
