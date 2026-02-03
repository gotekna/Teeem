# frozen_string_literal: true

namespace :xero do
  desc "Clean up WarehouseDocuments for voided/deleted Xero invoices"
  task cleanup_voided_documents: :environment do
    puts "=" * 60
    puts "CLEANUP: WarehouseDocuments for voided/deleted Xero invoices"
    puts "=" * 60
    puts ""

    # Find WarehouseDocuments linked to voided/deleted ExternalInvoices
    orphaned_docs = WarehouseDocument
      .where(source_type: "xero")
      .where(documentable_type: "ExternalInvoice")
      .joins("INNER JOIN external_invoices ON external_invoices.id = warehouse_documents.documentable_id")
      .where(external_invoices: { status: %w[voided deleted] })

    count = orphaned_docs.count
    puts "Found #{count} WarehouseDocuments for voided/deleted invoices"

    if count.zero?
      puts "Nothing to clean up!"
      next
    end

    # Show breakdown by status
    puts ""
    puts "Breakdown by invoice status:"
    orphaned_docs
      .joins("INNER JOIN external_invoices ei ON ei.id = warehouse_documents.documentable_id")
      .group("ei.status")
      .count
      .each { |status, cnt| puts "  #{status}: #{cnt}" }

    # Dry run by default
    if ENV["EXECUTE"] == "true"
      puts ""
      puts "EXECUTING deletion..."

      deleted = 0
      orphaned_docs.find_each do |doc|
        # Note: We don't delete the StorageBlob - other documents may reference it
        # The blob garbage collection task will clean up unreferenced blobs
        doc.destroy
        deleted += 1
        print "." if deleted % 100 == 0
      end

      puts ""
      puts "✅ Deleted #{deleted} WarehouseDocuments"
      puts ""
      puts "Note: Run 'rails blob:cleanup:orphaned[execute,30]' to clean up unreferenced blobs"
    else
      puts ""
      puts "DRY RUN - No changes made"
      puts "To execute: rails xero:cleanup_voided_documents EXECUTE=true"
    end

    puts ""
    puts "=" * 60
  end

  desc "Audit WarehouseDocuments for data integrity issues"
  task audit_documents: :environment do
    puts "=" * 60
    puts "AUDIT: Xero WarehouseDocument integrity"
    puts "=" * 60
    puts ""

    # 1. Documents for voided/deleted invoices
    voided_count = WarehouseDocument
      .where(source_type: "xero", documentable_type: "ExternalInvoice")
      .joins("INNER JOIN external_invoices ON external_invoices.id = warehouse_documents.documentable_id")
      .where(external_invoices: { status: %w[voided deleted] })
      .count
    status = voided_count > 0 ? "⚠️" : "✅"
    puts "#{status} Documents for voided/deleted invoices: #{voided_count}"

    # 2. Documents for draft invoices (drafts don't have PDFs in Xero)
    draft_count = WarehouseDocument
      .where(source_type: "xero", documentable_type: "ExternalInvoice")
      .joins("INNER JOIN external_invoices ON external_invoices.id = warehouse_documents.documentable_id")
      .where(external_invoices: { status: "draft" })
      .count
    status = draft_count > 0 ? "⚠️" : "✅"
    puts "#{status} Documents for draft invoices: #{draft_count}"

    # 3. Documents with missing storage_blob
    missing_blob = WarehouseDocument
      .where(source_type: "xero", documentable_type: "ExternalInvoice")
      .where(storage_blob_id: nil)
      .count
    status = missing_blob > 0 ? "⚠️" : "✅"
    puts "#{status} Documents with missing storage_blob: #{missing_blob}"

    # 4. Duplicate is_primary documents for same invoice
    dupes = WarehouseDocument
      .where(source_type: "xero", documentable_type: "ExternalInvoice")
      .where("metadata->>'is_primary' = ?", "true")
      .group(:documentable_id)
      .having("count(*) > 1")
      .count
      .count
    status = dupes > 0 ? "⚠️" : "✅"
    puts "#{status} Invoices with duplicate is_primary docs: #{dupes}"

    # 5. Per-org percentage sanity check
    puts ""
    puts "Per-org sync percentages:"
    XeroCredential.where(status: %w[connected degraded]).each do |cred|
      contact_ids = ContactExternalLink.where(source: "xero", xero_org_id: cred.tenant_id).pluck(:contact_id)

      total = ExternalInvoice.active
        .where(contact_id: contact_ids)
        .where.not(status: "draft")
        .where.not(status: %w[voided deleted])
        .count

      synced = WarehouseDocument
        .where(source_type: "xero")
        .where("metadata->>'is_primary' = ?", "true")
        .where.not(storage_blob_id: nil)
        .joins(:storage_blob).where.not(storage_blobs: { content_hash: nil })
        .where(documentable_type: "ExternalInvoice")
        .joins("INNER JOIN external_invoices ON external_invoices.id = warehouse_documents.documentable_id")
        .where(external_invoices: { contact_id: contact_ids })
        .where.not(external_invoices: { status: "draft" })
        .where.not(external_invoices: { status: %w[voided deleted] })
        .distinct.count(:documentable_id)

      pct = total > 0 ? ((synced.to_f / total) * 100).round(1) : 100.0
      status = pct > 100 ? "❌" : (pct == 100 ? "✅" : "🔄")
      puts "  #{status} #{cred.tenant_name[0..25].ljust(26)} #{synced}/#{total} (#{pct}%)"
    end

    puts ""
    puts "=" * 60
  end
end
