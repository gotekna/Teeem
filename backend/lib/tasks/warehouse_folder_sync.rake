# frozen_string_literal: true

namespace :warehouse do
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

    # 3. Sync EmailWarehouse (if it has virtual_folder_path)
    puts "\n[3/3] Syncing EmailWarehouse..."
    if defined?(EmailWarehouse) && EmailWarehouse.instance_methods.include?(:virtual_folder_path)
      EmailWarehouse.includes(:warehouse_document).find_each do |doc|
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
          stats[:errors] << "EmailWarehouse #{doc.id}: #{e.message}"
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
