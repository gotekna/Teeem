# frozen_string_literal: true

# One-time rake task to re-upload missing files for Task #2236
# Run after downloading files from SharePoint to a local folder
#
# Usage:
#   rails task2236:reupload[/path/to/folder]
#
# Expected files in folder:
#   - Standard Balance Sheet 2019 HFT.pdf
#   - Deed of Gift - Rachel - 15.03.21.pdf
#   - Deed of Gift - Sophie - 15.03.21.pdf
#   - Deed of Gift - Jared - 15.03.21.pdf
#   - Walan Settlement.pdf
#   - Deed of Gift - Grace - 15.03.21.pdf
#   - 24fy Rachel Paying Loan and Interest.pdf
#   - FY 25 Rachel Paying Interest and Loan.pdf
#   - Rachel Receiving Gen2612.pdf

namespace :task2236 do
  # Document ID to filename mapping
  MISSING_DOCS = {
    19934 => "Standard Balance Sheet 2019 HFT.pdf",
    19974 => "Deed of Gift - Rachel - 15.03.21.pdf",
    19975 => "Deed of Gift - Sophie - 15.03.21.pdf",
    19976 => "Deed of Gift - Jared - 15.03.21.pdf",
    19977 => "Walan Settlement.pdf",
    19978 => "Deed of Gift - Grace - 15.03.21.pdf",
    19980 => "24fy Rachel Paying Loan and Interest.pdf",
    19981 => "FY 25 Rachel Paying Interest and Loan.pdf",
    19982 => "Rachel Receiving Gen2612.pdf"
  }.freeze

  desc "List missing files for Task #2236"
  task list: :environment do
    puts "Missing files for Task #2236:"
    puts "-" * 60
    MISSING_DOCS.each do |id, filename|
      doc = CorporateCompanyDocument.find_by(id: id)
      if doc
        puts "ID #{id}: #{filename}"
        puts "  Current path: #{doc.storage_path}"
      else
        puts "ID #{id}: #{filename} - DOCUMENT NOT FOUND IN DB"
      end
    end
  end

  desc "Re-upload missing files from a folder"
  task :reupload, [:folder_path] => :environment do |_t, args|
    folder = args[:folder_path]
    unless folder && Dir.exist?(folder)
      puts "Usage: rails task2236:reupload[/path/to/downloaded/files]"
      puts ""
      puts "Download the files from SharePoint first:"
      puts "  https://gotekna-my.sharepoint.com/.../Robert Bankruptcy/SV Partners January 2026 Questions"
      exit 1
    end

    # Set tenant context - get from Task #2236
    task = SmTask.find_by(id: 2236)
    unless task&.tenant_id
      puts "ERROR: Task #2236 not found or has no tenant"
      exit 1
    end
    tenant = Tenant.find_by(id: task.tenant_id)
    unless tenant
      puts "ERROR: Tenant not found for tenant_id #{task.tenant_id}"
      exit 1
    end
    ActsAsTenant.current_tenant = tenant

    puts "=" * 60
    puts "Re-uploading missing files for Task #2236"
    puts "Tenant: #{tenant.name}"
    puts "Source folder: #{folder}"
    puts "=" * 60
    puts ""

    success = 0
    failed = 0
    skipped = 0

    MISSING_DOCS.each do |doc_id, filename|
      file_path = File.join(folder, filename)

      unless File.exist?(file_path)
        puts "SKIP: #{filename} - not found in folder"
        skipped += 1
        next
      end

      doc = CorporateCompanyDocument.find_by(id: doc_id)
      unless doc
        puts "ERROR: Document #{doc_id} not found in database"
        failed += 1
        next
      end

      puts "Uploading: #{filename}..."

      begin
        content = File.binread(file_path)
        content_type = Marcel::MimeType.for(Pathname.new(file_path))

        # Create new StorageBlob with content-addressed storage
        blob = StorageBlob.find_or_create_for_content!(
          content,
          filename: doc.file_name,
          content_type: content_type
        )

        # Update document to use new blob
        doc.storage_blob&.decrement_reference! if doc.storage_blob_id.present?
        doc.storage_blob = blob
        doc.content_hash = blob.content_hash
        doc.file_size = content.bytesize
        doc.storage_path = blob.storage_path
        doc.save!
        blob.increment_reference!

        # Update warehouse_document if exists
        if doc.warehouse_document
          doc.warehouse_document.update!(storage_blob: blob)
        end

        puts "  ✓ Uploaded to: #{blob.storage_path}"
        success += 1
      rescue => e
        puts "  ✗ Error: #{e.message}"
        failed += 1
      end
    end

    puts ""
    puts "=" * 60
    puts "Complete!"
    puts "  Success: #{success}"
    puts "  Failed:  #{failed}"
    puts "  Skipped: #{skipped}"
    puts "=" * 60
  end
end
