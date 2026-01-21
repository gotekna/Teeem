# frozen_string_literal: true

# Xero Document Migration: Corporate → Contacts
#
# PROBLEM: Xero invoice/bill PDFs were imported into CorporateCompanyDocument
# (corporate scope) but should be stored as ContactDocument (contact scope)
# linked to the Contact from the ExternalInvoice.
#
# DATA FLOW:
#   ExternalInvoice (has contact_id)
#       └── CorporateCompanyDocument (source='xero', documentable=ExternalInvoice)
#               └── StorageBlob (via storage_blob_id)
#                       └── WarehouseDocument (documentable=CorporateCompanyDocument)
#
#   MIGRATES TO:
#
#   Contact
#       └── ContactDocument (source='xero', copies storage fields)
#               └── WarehouseDocument (documentable=ContactDocument)
#                       └── StorageBlob (SAME blob - no file move)
#
# KEY: ContactDocument uses storage_path/storage_item_id/storage_provider (not storage_blob_id)
#
# USAGE:
#   rails xero:preview              # Dry run - show counts
#   rails xero:migrate_to_contacts  # Run migration
#   rails xero:rollback_contacts    # Rollback if needed
#
namespace :xero do
  desc "Preview migration counts (dry run)"
  task preview: :environment do
    puts "=" * 60
    puts "XERO DOCUMENT MIGRATION PREVIEW"
    puts "=" * 60
    puts ""

    # Total Xero docs in Corporate
    total_xero = CorporateCompanyDocument.where(source: "xero").count
    puts "Total Xero docs in Corporate: #{total_xero}"

    # Linked to ExternalInvoice (eligible for migration)
    with_invoice = CorporateCompanyDocument
      .where(source: "xero", documentable_type: "ExternalInvoice")
      .count
    puts "Linked to ExternalInvoice: #{with_invoice}"

    # Breakdown by invoice type
    puts ""
    puts "By Invoice Type:"
    CorporateCompanyDocument
      .where(source: "xero", documentable_type: "ExternalInvoice")
      .joins("INNER JOIN external_invoices ON external_invoices.id = corporate_company_documents.documentable_id")
      .group("external_invoices.invoice_type")
      .count
      .each do |type, count|
        puts "  - #{type}: #{count}"
      end

    # Already migrated
    already_migrated = CorporateCompanyDocument
      .where(source: "xero", migration_status: "migrated_to_contact")
      .count
    puts ""
    puts "Already migrated: #{already_migrated}"

    # ContactDocuments with source=xero
    contact_docs = ContactDocument.where(source: "xero").count
    puts "ContactDocuments with source=xero: #{contact_docs}"

    # BankStatementReports (keep in Corporate)
    bank_reports = CorporateCompanyDocument
      .where(source: "xero")
      .where.not(documentable_type: "ExternalInvoice")
      .count
    puts ""
    puts "Not linked to invoice (keep in Corporate): #{bank_reports}"

    # Check for invoices without contact
    no_contact = CorporateCompanyDocument
      .where(source: "xero", documentable_type: "ExternalInvoice")
      .joins("INNER JOIN external_invoices ON external_invoices.id = corporate_company_documents.documentable_id")
      .where("external_invoices.contact_id IS NULL")
      .count
    puts "Invoices without contact (will skip): #{no_contact}"

    # Ready to migrate
    to_migrate = with_invoice - already_migrated - no_contact
    puts ""
    puts "=" * 60
    puts "Ready to migrate: #{to_migrate}"
    puts "=" * 60
    puts ""
    puts "Run 'rails xero:migrate_to_contacts' to perform migration"
  end

  desc "Migrate Xero documents from Corporate to Contacts"
  task migrate_to_contacts: :environment do
    puts "=" * 60
    puts "MIGRATING XERO DOCUMENTS FROM CORPORATE TO CONTACTS"
    puts "=" * 60
    puts ""

    # Find all Xero corporate docs linked to ExternalInvoice
    docs = CorporateCompanyDocument
      .where(source: "xero", documentable_type: "ExternalInvoice")
      .where.not(migration_status: "migrated_to_contact")
      .includes(:documentable, :storage_blob, :warehouse_document)

    total = docs.count
    puts "Found #{total} documents to process..."
    puts ""

    migrated = 0
    skipped = 0
    errors = []

    docs.find_each.with_index do |corp_doc, index|
      # Progress indicator
      if (index + 1) % 100 == 0
        puts "Processing #{index + 1}/#{total}..."
      end

      begin
        # Get ExternalInvoice and its Contact
        invoice = corp_doc.documentable
        unless invoice&.contact_id
          skipped += 1
          next
        end

        contact = Contact.find_by(id: invoice.contact_id)
        unless contact
          skipped += 1
          errors << "Contact #{invoice.contact_id} not found for doc #{corp_doc.id}"
          next
        end

        # Skip if already migrated (check by external_id)
        if corp_doc.external_id.present? &&
           ContactDocument.exists?(source: "xero", external_id: corp_doc.external_id)
          skipped += 1
          next
        end

        # Determine folder based on invoice type
        folder = case invoice.invoice_type
                 when "bill" then "Bills"
                 when "sales_invoice" then "Invoices"
                 when "credit_note" then "Credit Notes"
                 when "quote" then "Quotes"
                 else "Documents"
                 end

        ActiveRecord::Base.transaction do
          # Create ContactDocument - copy storage fields (not storage_blob_id)
          contact_doc = ContactDocument.create!(
            contact: contact,
            document_type_id: corp_doc.document_type_id,
            file_name: corp_doc.file_name,
            file_extension: corp_doc.file_extension,
            file_size: corp_doc.file_size,
            content_type: corp_doc.mime_type || corp_doc.content_type,
            folder: folder,
            storage_path: corp_doc.storage_path,
            storage_item_id: corp_doc.storage_item_id,
            storage_provider: corp_doc.storage_provider,
            source: "xero",
            external_id: corp_doc.external_id
          )

          # Update WarehouseDocument to point to new ContactDocument
          warehouse_doc = corp_doc.warehouse_document
          if warehouse_doc
            warehouse_doc.update!(
              documentable: contact_doc,
              source_type: "contact",
              folder: "#{contact.display_name}/#{folder}"
            )
          end

          # Mark original as migrated (keep for audit trail)
          corp_doc.update_columns(
            migration_status: "migrated_to_contact",
            migration_completed_at: Time.current
          )
        end

        migrated += 1
      rescue StandardError => e
        errors << "Doc #{corp_doc.id}: #{e.message}"
        Rails.logger.error("[XERO_MIGRATION] Error migrating doc #{corp_doc.id}: #{e.message}")
      end
    end

    puts ""
    puts "=" * 60
    puts "MIGRATION COMPLETE"
    puts "=" * 60
    puts "Migrated: #{migrated}"
    puts "Skipped: #{skipped}"
    puts "Errors: #{errors.count}"
    if errors.any?
      puts ""
      puts "First 10 errors:"
      errors.first(10).each { |e| puts "  - #{e}" }
    end
    puts ""
    puts "Verification:"
    puts "  ContactDocuments with source=xero: #{ContactDocument.where(source: 'xero').count}"
    puts "  Migrated CorporateCompanyDocuments: #{CorporateCompanyDocument.where(migration_status: 'migrated_to_contact').count}"
  end

  desc "Rollback Xero document migration (reverse migration)"
  task rollback_contacts: :environment do
    puts "=" * 60
    puts "ROLLING BACK XERO DOCUMENT MIGRATION"
    puts "=" * 60
    puts ""

    # Find all ContactDocuments created from Xero migration
    contact_docs = ContactDocument.where(source: "xero")
    total = contact_docs.count
    puts "Found #{total} ContactDocuments to rollback..."

    if total == 0
      puts "Nothing to rollback."
      return
    end

    print "Are you sure you want to rollback? (yes/no): "
    confirmation = STDIN.gets&.strip
    unless confirmation == "yes"
      puts "Rollback cancelled."
      return
    end

    puts ""

    rolled_back = 0
    errors = []

    contact_docs.find_each.with_index do |cd, index|
      if (index + 1) % 100 == 0
        puts "Processing #{index + 1}/#{total}..."
      end

      begin
        ActiveRecord::Base.transaction do
          # Find original CorporateCompanyDocument by external_id
          orig = CorporateCompanyDocument.find_by(external_id: cd.external_id, source: "xero")

          # Restore WarehouseDocument link
          wd = WarehouseDocument.find_by(documentable: cd)
          if wd && orig
            wd.update!(
              documentable: orig,
              source_type: "corporate",
              folder: orig.virtual_folder_path
            )
          end

          # Clear migration status on original
          orig&.update_columns(
            migration_status: nil,
            migration_completed_at: nil
          )

          # Delete the ContactDocument
          cd.destroy!
        end

        rolled_back += 1
      rescue StandardError => e
        errors << "ContactDoc #{cd.id}: #{e.message}"
        Rails.logger.error("[XERO_ROLLBACK] Error rolling back doc #{cd.id}: #{e.message}")
      end
    end

    puts ""
    puts "=" * 60
    puts "ROLLBACK COMPLETE"
    puts "=" * 60
    puts "Rolled back: #{rolled_back}"
    puts "Errors: #{errors.count}"
    if errors.any?
      puts ""
      puts "First 10 errors:"
      errors.first(10).each { |e| puts "  - #{e}" }
    end
    puts ""
    puts "Verification:"
    puts "  ContactDocuments with source=xero: #{ContactDocument.where(source: 'xero').count}"
    puts "  Migrated CorporateCompanyDocuments: #{CorporateCompanyDocument.where(migration_status: 'migrated_to_contact').count}"
  end

  desc "Verify Xero migration status"
  task verify: :environment do
    puts "=" * 60
    puts "XERO MIGRATION VERIFICATION"
    puts "=" * 60
    puts ""

    # ContactDocuments created
    contact_docs = ContactDocument.where(source: "xero")
    puts "ContactDocuments with source=xero: #{contact_docs.count}"

    # By folder
    puts ""
    puts "By folder:"
    contact_docs.group(:folder).count.each do |folder, count|
      puts "  - #{folder || 'nil'}: #{count}"
    end

    # CorporateCompanyDocuments migrated
    migrated = CorporateCompanyDocument.where(migration_status: "migrated_to_contact")
    puts ""
    puts "CorporateCompanyDocuments migrated: #{migrated.count}"

    # WarehouseDocuments updated
    wd_contact = WarehouseDocument.where(
      documentable_type: "ContactDocument",
      source_type: "contact"
    ).joins("INNER JOIN contact_documents ON contact_documents.id = warehouse_documents.documentable_id")
     .where("contact_documents.source = 'xero'")
     .count
    puts "WarehouseDocuments pointing to ContactDocument (xero): #{wd_contact}"

    # Orphaned WarehouseDocuments (still pointing to migrated CorporateCompanyDocument)
    orphaned = WarehouseDocument.where(
      documentable_type: "CorporateCompanyDocument"
    ).joins("INNER JOIN corporate_company_documents ON corporate_company_documents.id = warehouse_documents.documentable_id")
     .where("corporate_company_documents.migration_status = 'migrated_to_contact'")
     .count
    puts ""
    if orphaned > 0
      puts "⚠️  WARNING: #{orphaned} WarehouseDocuments still pointing to migrated CorporateCompanyDocuments"
    else
      puts "✓ All WarehouseDocuments properly updated"
    end

    # Sample migrated document
    sample = contact_docs.includes(:contact).first
    if sample
      puts ""
      puts "Sample migrated document:"
      puts "  ID: #{sample.id}"
      puts "  Contact: #{sample.contact&.display_name}"
      puts "  File: #{sample.file_name}"
      puts "  Folder: #{sample.folder}"
      puts "  Storage Path: #{sample.storage_path}"
    end
  end
end
