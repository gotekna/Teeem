# frozen_string_literal: true

# Phase 3: Warehouse Document Migration Tasks
#
# Migrates existing documents to the universal warehouse_documents table.
# Each task creates WarehouseDocument records linking documents to StorageBlob.
#
# Usage:
#   rake phase3:migrate:corporate_documents
#   rake phase3:migrate:email_attachments
#   rake phase3:migrate:email_warehouses
#   rake phase3:migrate:job_documents
#   rake phase3:migrate:people_documents
#   rake phase3:migrate:contact_documents
#   rake phase3:migrate:all
#   rake phase3:migrate:stats
#
namespace :phase3 do
  namespace :migrate do
    desc "Migrate CorporateCompanyDocuments to warehouse_documents"
    task corporate_documents: :environment do
      puts "=" * 60
      puts "Migrating CorporateCompanyDocuments to WarehouseDocuments"
      puts "=" * 60

      total = CorporateCompanyDocument.count
      migrated = 0
      skipped = 0
      errors = []

      CorporateCompanyDocument.includes(:storage_blob, :corporate_company, :document_type_record, :warehouse_document)
                              .find_each.with_index do |doc, index|
        # Skip if already has warehouse_document
        if doc.warehouse_document.present?
          skipped += 1
          next
        end

        begin
          WarehouseDocument.create!(
            documentable: doc,
            storage_blob_id: doc.storage_blob_id,
            display_name: doc.display_name.presence || doc.file_name || "Untitled",
            send_name: nil, # Will use template expansion via SendNameResolver
            folder: build_corporate_folder(doc),
            source_type: "corporate",
            original_filename: doc.file_name,
            file_size: doc.file_size,
            content_type: doc.storage_blob&.content_type || infer_content_type(doc.file_name)
          )
          migrated += 1
        rescue ActiveRecord::RecordInvalid => e
          errors << { id: doc.id, error: e.message }
        end

        # Progress indicator
        if (index + 1) % 100 == 0
          puts "  Processed #{index + 1}/#{total} (#{migrated} migrated, #{skipped} skipped)"
        end
      end

      puts "-" * 60
      puts "Complete: #{migrated} migrated, #{skipped} skipped, #{errors.size} errors"
      if errors.any?
        puts "Errors:"
        errors.first(10).each { |e| puts "  - ID #{e[:id]}: #{e[:error]}" }
        puts "  ... and #{errors.size - 10} more" if errors.size > 10
      end
    end

    desc "Migrate EmailAttachments to warehouse_documents"
    task email_attachments: :environment do
      puts "=" * 60
      puts "Migrating EmailAttachments to WarehouseDocuments"
      puts "=" * 60

      total = EmailAttachment.count
      migrated = 0
      skipped = 0
      errors = []

      EmailAttachment.includes(:storage_blob, :email_warehouse, :warehouse_document)
                     .find_each.with_index do |att, index|
        # Skip if already has warehouse_document
        if att.warehouse_document.present?
          skipped += 1
          next
        end

        # Skip if no storage
        unless att.storage_blob_id.present?
          skipped += 1
          next
        end

        begin
          email = att.email_warehouse
          WarehouseDocument.create!(
            documentable: att,
            storage_blob_id: att.storage_blob_id,
            display_name: att.filename.presence || "Attachment",
            send_name: nil, # Will use template expansion
            folder: build_email_folder(email),
            source_type: "email",
            original_filename: att.filename,
            file_size: att.storage_blob&.file_size,
            content_type: att.storage_blob&.content_type
          )
          migrated += 1
        rescue ActiveRecord::RecordInvalid => e
          errors << { id: att.id, error: e.message }
        end

        # Progress indicator
        if (index + 1) % 100 == 0
          puts "  Processed #{index + 1}/#{total} (#{migrated} migrated, #{skipped} skipped)"
        end
      end

      puts "-" * 60
      puts "Complete: #{migrated} migrated, #{skipped} skipped, #{errors.size} errors"
      if errors.any?
        puts "Errors:"
        errors.first(10).each { |e| puts "  - ID #{e[:id]}: #{e[:error]}" }
        puts "  ... and #{errors.size - 10} more" if errors.size > 10
      end
    end

    desc "Migrate EmailWarehouses (email bodies) to warehouse_documents"
    task email_warehouses: :environment do
      puts "=" * 60
      puts "Migrating EmailWarehouses (email bodies) to WarehouseDocuments"
      puts "=" * 60

      # Only migrate emails that have storage (eml file stored)
      total = EmailWarehouse.where.not(storage_path: [nil, ""]).count
      migrated = 0
      skipped = 0
      errors = []

      EmailWarehouse.where.not(storage_path: [nil, ""])
                    .includes(:warehouse_document)
                    .find_each.with_index do |email, index|
        # Skip if already has warehouse_document
        if email.warehouse_document.present?
          skipped += 1
          next
        end

        begin
          # Try to find or create StorageBlob for the email
          blob = find_or_create_blob_for_email(email)

          WarehouseDocument.create!(
            documentable: email,
            storage_blob_id: blob&.id,
            display_name: email.subject.presence || "Email",
            send_name: nil, # Uses template "{Subject} - {ReceivedDate}.eml"
            folder: build_email_folder(email),
            source_type: "email",
            original_filename: "#{email.id}.eml",
            file_size: blob&.file_size,
            content_type: "message/rfc822"
          )
          migrated += 1
        rescue ActiveRecord::RecordInvalid => e
          errors << { id: email.id, error: e.message }
        rescue StandardError => e
          errors << { id: email.id, error: e.message }
        end

        # Progress indicator
        if (index + 1) % 100 == 0
          puts "  Processed #{index + 1}/#{total} (#{migrated} migrated, #{skipped} skipped)"
        end
      end

      puts "-" * 60
      puts "Complete: #{migrated} migrated, #{skipped} skipped, #{errors.size} errors"
      if errors.any?
        puts "Errors:"
        errors.first(10).each { |e| puts "  - ID #{e[:id]}: #{e[:error]}" }
        puts "  ... and #{errors.size - 10} more" if errors.size > 10
      end
    end

    desc "Migrate JobDocuments to warehouse_documents"
    task job_documents: :environment do
      puts "=" * 60
      puts "Migrating JobDocuments to WarehouseDocuments"
      puts "=" * 60

      total = JobDocument.count
      migrated = 0
      skipped = 0
      errors = []

      JobDocument.includes(:job, :document_type, :warehouse_document)
                 .find_each.with_index do |doc, index|
        # Skip if already has warehouse_document
        if doc.warehouse_document.present?
          skipped += 1
          next
        end

        begin
          # Try to find or create StorageBlob for the document
          blob = find_or_create_blob_for_job_document(doc)

          WarehouseDocument.create!(
            documentable: doc,
            storage_blob_id: blob&.id,
            display_name: doc.file_name.presence || "Document",
            send_name: nil, # Will use template expansion
            folder: doc.folder_path,
            source_type: "job",
            original_filename: doc.file_name,
            file_size: doc.file_size,
            content_type: blob&.content_type || infer_content_type(doc.file_name)
          )
          migrated += 1
        rescue ActiveRecord::RecordInvalid => e
          errors << { id: doc.id, error: e.message }
        rescue StandardError => e
          errors << { id: doc.id, error: e.message }
        end

        # Progress indicator
        if (index + 1) % 100 == 0
          puts "  Processed #{index + 1}/#{total} (#{migrated} migrated, #{skipped} skipped)"
        end
      end

      puts "-" * 60
      puts "Complete: #{migrated} migrated, #{skipped} skipped, #{errors.size} errors"
      if errors.any?
        puts "Errors:"
        errors.first(10).each { |e| puts "  - ID #{e[:id]}: #{e[:error]}" }
        puts "  ... and #{errors.size - 10} more" if errors.size > 10
      end
    end

    desc "Migrate PeopleDocuments to warehouse_documents"
    task people_documents: :environment do
      puts "=" * 60
      puts "Migrating PeopleDocuments to WarehouseDocuments"
      puts "=" * 60

      total = PeopleDocument.count
      migrated = 0
      skipped = 0
      errors = []

      PeopleDocument.includes(:contact, :warehouse_document)
                    .find_each.with_index do |doc, index|
        # Skip if already has warehouse_document
        if doc.warehouse_document.present?
          skipped += 1
          next
        end

        begin
          # Try to get StorageBlob from ActiveStorage if present
          blob = find_or_create_blob_for_people_document(doc)

          WarehouseDocument.create!(
            documentable: doc,
            storage_blob_id: blob&.id,
            display_name: doc.file_name.presence || doc.try(:description).presence || "Document",
            send_name: nil,
            folder: build_people_folder(doc),
            source_type: "people",
            original_filename: doc.file_name,
            file_size: doc.try(:file_size) || blob&.file_size,
            content_type: doc.try(:content_type) || blob&.content_type
          )
          migrated += 1
        rescue ActiveRecord::RecordInvalid => e
          errors << { id: doc.id, error: e.message }
        rescue StandardError => e
          errors << { id: doc.id, error: e.message }
        end

        # Progress indicator
        if (index + 1) % 100 == 0
          puts "  Processed #{index + 1}/#{total} (#{migrated} migrated, #{skipped} skipped)"
        end
      end

      puts "-" * 60
      puts "Complete: #{migrated} migrated, #{skipped} skipped, #{errors.size} errors"
      if errors.any?
        puts "Errors:"
        errors.first(10).each { |e| puts "  - ID #{e[:id]}: #{e[:error]}" }
        puts "  ... and #{errors.size - 10} more" if errors.size > 10
      end
    end

    desc "Migrate ContactDocuments to warehouse_documents"
    task contact_documents: :environment do
      puts "=" * 60
      puts "Migrating ContactDocuments to WarehouseDocuments"
      puts "=" * 60

      total = ContactDocument.count
      migrated = 0
      skipped = 0
      errors = []

      ContactDocument.includes(:contact, :warehouse_document)
                     .find_each.with_index do |doc, index|
        # Skip if already has warehouse_document
        if doc.warehouse_document.present?
          skipped += 1
          next
        end

        begin
          # Try to get StorageBlob from ActiveStorage if present
          blob = find_or_create_blob_for_contact_document(doc)

          WarehouseDocument.create!(
            documentable: doc,
            storage_blob_id: blob&.id,
            display_name: doc.file_name.presence || doc.try(:description).presence || "Document",
            send_name: nil,
            folder: build_contact_folder(doc),
            source_type: "contact",
            original_filename: doc.file_name,
            file_size: doc.try(:file_size) || blob&.file_size,
            content_type: doc.try(:content_type) || blob&.content_type
          )
          migrated += 1
        rescue ActiveRecord::RecordInvalid => e
          errors << { id: doc.id, error: e.message }
        rescue StandardError => e
          errors << { id: doc.id, error: e.message }
        end

        # Progress indicator
        if (index + 1) % 100 == 0
          puts "  Processed #{index + 1}/#{total} (#{migrated} migrated, #{skipped} skipped)"
        end
      end

      puts "-" * 60
      puts "Complete: #{migrated} migrated, #{skipped} skipped, #{errors.size} errors"
      if errors.any?
        puts "Errors:"
        errors.first(10).each { |e| puts "  - ID #{e[:id]}: #{e[:error]}" }
        puts "  ... and #{errors.size - 10} more" if errors.size > 10
      end
    end

    desc "Run all Phase 3 warehouse document migrations"
    task all: :environment do
      puts "=" * 60
      puts "Running ALL Phase 3 warehouse document migrations"
      puts "=" * 60
      puts ""

      Rake::Task["phase3:migrate:corporate_documents"].invoke
      puts ""
      Rake::Task["phase3:migrate:email_attachments"].invoke
      puts ""
      Rake::Task["phase3:migrate:email_warehouses"].invoke
      puts ""
      Rake::Task["phase3:migrate:job_documents"].invoke
      puts ""
      Rake::Task["phase3:migrate:people_documents"].invoke
      puts ""
      Rake::Task["phase3:migrate:contact_documents"].invoke
      puts ""

      puts "=" * 60
      Rake::Task["phase3:migrate:stats"].invoke
    end

    desc "Show Phase 3 warehouse document migration statistics"
    task stats: :environment do
      puts "=" * 60
      puts "Phase 3 Warehouse Document Migration Statistics"
      puts "=" * 60

      stats = [
        {
          name: "CorporateCompanyDocument",
          total: CorporateCompanyDocument.count,
          migrated: WarehouseDocument.where(documentable_type: "CorporateCompanyDocument").count
        },
        {
          name: "EmailAttachment",
          total: EmailAttachment.count,
          with_blob: EmailAttachment.where.not(storage_blob_id: nil).count,
          migrated: WarehouseDocument.where(documentable_type: "EmailAttachment").count
        },
        {
          name: "EmailWarehouse",
          total: EmailWarehouse.count,
          with_storage: EmailWarehouse.where.not(storage_path: [nil, ""]).count,
          migrated: WarehouseDocument.where(documentable_type: "EmailWarehouse").count
        },
        {
          name: "JobDocument",
          total: JobDocument.count,
          migrated: WarehouseDocument.where(documentable_type: "JobDocument").count
        },
        {
          name: "PeopleDocument",
          total: PeopleDocument.count,
          migrated: WarehouseDocument.where(documentable_type: "PeopleDocument").count
        },
        {
          name: "ContactDocument",
          total: ContactDocument.count,
          migrated: WarehouseDocument.where(documentable_type: "ContactDocument").count
        }
      ]

      total_docs = 0
      total_migrated = 0

      puts ""
      puts format("%-28s %10s %10s %10s", "Model", "Total", "Migrated", "Remaining")
      puts "-" * 62

      stats.each do |stat|
        eligible = stat[:with_blob] || stat[:with_storage] || stat[:total]
        remaining = eligible - stat[:migrated]
        extra = ""
        if stat[:with_blob]
          extra = " (#{stat[:with_blob]} with blob)"
        elsif stat[:with_storage]
          extra = " (#{stat[:with_storage]} with storage)"
        end
        puts format("%-28s %10d %10d %10d%s", stat[:name], stat[:total], stat[:migrated], remaining, extra)
        total_docs += stat[:total]
        total_migrated += stat[:migrated]
      end

      puts "-" * 62
      puts format("%-28s %10d %10d %10d", "TOTAL", total_docs, total_migrated, total_docs - total_migrated)
      puts ""
      puts "Storage Blobs: #{StorageBlob.count}"
      puts "Warehouse Documents: #{WarehouseDocument.count}"
      puts ""
      puts "WarehouseDocument by source_type:"
      WarehouseDocument.group(:source_type).count.each do |type, count|
        puts "  #{type}: #{count}"
      end
    end

    # ========================================
    # Helper methods
    # ========================================

    def build_corporate_folder(doc)
      parts = []
      parts << doc.corporate_company&.corporate_group&.name if doc.corporate_company&.corporate_group
      parts << doc.corporate_company&.code if doc.corporate_company
      parts << doc.folder if doc.folder.present?
      parts.compact.join("/")
    end

    def build_email_folder(email)
      return nil unless email
      date = email.try(:received_at) || email.try(:created_at)
      "Emails/#{date&.year}/#{date&.strftime('%m')}"
    end

    def build_people_folder(doc)
      parts = ["People"]
      parts << doc.contact&.display_name if doc.contact
      parts.compact.join("/")
    end

    def build_contact_folder(doc)
      parts = ["Contacts"]
      parts << doc.contact&.display_name if doc.contact
      parts.compact.join("/")
    end

    def find_or_create_blob_for_email(email)
      return nil unless email.storage_path.present?

      # Check if blob already exists for this path
      existing = StorageBlob.find_by(storage_path: email.storage_path)
      return existing if existing

      # Create new blob record (without downloading content)
      StorageBlob.create!(
        storage_path: email.storage_path,
        content_type: "message/rfc822",
        original_filename: "#{email.id}.eml",
        file_size: nil, # Unknown without downloading
        content_hash: nil # Unknown without downloading
      )
    rescue ActiveRecord::RecordInvalid
      nil
    end

    def find_or_create_blob_for_job_document(doc)
      # If document has storage_path, create/find blob
      storage_path = doc.try(:storage_path).presence || doc.try(:sharepoint_path)
      return nil unless storage_path.present?

      existing = StorageBlob.find_by(storage_path: storage_path)
      return existing if existing

      # Create new blob record
      StorageBlob.create!(
        storage_path: storage_path,
        content_type: infer_content_type(doc.file_name),
        original_filename: doc.file_name,
        file_size: doc.file_size,
        content_hash: doc.try(:content_hash)
      )
    rescue ActiveRecord::RecordInvalid
      nil
    end

    def find_or_create_blob_for_people_document(doc)
      # PeopleDocument may use ActiveStorage
      if doc.respond_to?(:file) && doc.file.attached?
        as_blob = doc.file.blob
        # Find or create StorageBlob from ActiveStorage blob
        existing = StorageBlob.find_by(content_hash: as_blob.checksum)
        return existing if existing

        # Would need to copy to new storage - skip for now
        return nil
      end

      # Check for storage_path
      storage_path = doc.try(:storage_path)
      return nil unless storage_path.present?

      StorageBlob.find_by(storage_path: storage_path)
    end

    def find_or_create_blob_for_contact_document(doc)
      # Similar to people_document
      if doc.respond_to?(:file) && doc.file.attached?
        as_blob = doc.file.blob
        existing = StorageBlob.find_by(content_hash: as_blob.checksum)
        return existing if existing
        return nil
      end

      storage_path = doc.try(:storage_path)
      return nil unless storage_path.present?

      StorageBlob.find_by(storage_path: storage_path)
    end

    # Infer content type from file extension
    def infer_content_type(filename)
      return nil if filename.blank?

      ext = File.extname(filename.to_s).downcase
      case ext
      when ".pdf" then "application/pdf"
      when ".doc" then "application/msword"
      when ".docx" then "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      when ".xls" then "application/vnd.ms-excel"
      when ".xlsx" then "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      when ".ppt" then "application/vnd.ms-powerpoint"
      when ".pptx" then "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      when ".jpg", ".jpeg" then "image/jpeg"
      when ".png" then "image/png"
      when ".gif" then "image/gif"
      when ".txt" then "text/plain"
      when ".csv" then "text/csv"
      when ".html", ".htm" then "text/html"
      when ".zip" then "application/zip"
      when ".eml" then "message/rfc822"
      else "application/octet-stream"
      end
    end
  end
end
