# frozen_string_literal: true

# Xero Warehouse Migration Tasks
#
# SSoT: Migrates Xero documents from legacy CorporateCompanyDocument/ContactDocument
# to the universal WarehouseDocument + StorageBlob architecture (Jan 2026)
#
# Architecture:
# - WarehouseDocument: Universal metadata table for ALL documents
# - StorageBlob: Deduplicated flat storage in Blobs/{hash_prefix}/{hash}.ext
# - EntityTab: SSoT for folder templates (no hardcoding)
# - DocumentType: SSoT for document classification
#
namespace :xero do
  namespace :warehouse do
    desc "Run full migration from legacy to WarehouseDocument"
    task migrate: :environment do
      puts "=" * 60
      puts "Xero Warehouse Migration"
      puts "=" * 60

      Rake::Task["xero:warehouse:analyze"].invoke
      Rake::Task["xero:warehouse:cleanup_legacy"].invoke
      Rake::Task["xero:warehouse:resync"].invoke
      Rake::Task["xero:warehouse:verify"].invoke
    end

    desc "Analyze current state before migration"
    task analyze: :environment do
      puts "\n📊 Analyzing current state..."

      # Legacy document counts
      legacy_corporate = CorporateCompanyDocument.where(source: "xero").count
      legacy_contact = ContactDocument.where(source: "xero").count rescue 0

      # New WarehouseDocument counts
      warehouse_xero = WarehouseDocument.where(source_type: "xero").count
      warehouse_with_blob = WarehouseDocument.where(source_type: "xero")
                                              .where.not(storage_blob_id: nil)
                                              .count

      # StorageBlob stats
      total_blobs = StorageBlob.count
      xero_blobs = StorageBlob.joins(:warehouse_documents)
                              .where(warehouse_documents: { source_type: "xero" })
                              .distinct.count rescue 0
      orphan_blobs = StorageBlob.left_joins(:warehouse_documents)
                                .where(warehouse_documents: { id: nil })
                                .where(reference_count: 0)
                                .count

      # ExternalInvoice stats
      total_invoices = ExternalInvoice.count
      active_invoices = ExternalInvoice.active.where.not(contact_id: nil).count
      invoices_with_warehouse_doc = WarehouseDocument.where(source_type: "xero")
                                                      .where(documentable_type: "ExternalInvoice")
                                                      .where("metadata->>'is_primary' = ?", "true")
                                                      .distinct.count(:documentable_id)

      puts "\nLegacy Documents:"
      puts "  CorporateCompanyDocument (source: xero): #{legacy_corporate}"
      puts "  ContactDocument (source: xero): #{legacy_contact}"

      puts "\nWarehouseDocument:"
      puts "  Total Xero documents: #{warehouse_xero}"
      puts "  With StorageBlob: #{warehouse_with_blob}"

      puts "\nStorageBlob:"
      puts "  Total blobs: #{total_blobs}"
      puts "  Linked to Xero docs: #{xero_blobs}"
      puts "  Orphan blobs (ref_count=0): #{orphan_blobs}"

      puts "\nExternalInvoice:"
      puts "  Total invoices: #{total_invoices}"
      puts "  Active with contact: #{active_invoices}"
      puts "  With WarehouseDocument: #{invoices_with_warehouse_doc}"
      puts "  Pending sync: #{active_invoices - invoices_with_warehouse_doc}"

      puts "\n" + "=" * 60
    end

    desc "Clean up legacy CorporateCompanyDocument/ContactDocument Xero records"
    task cleanup_legacy: :environment do
      puts "\n🧹 Cleaning up legacy documents..."

      # Only cleanup if user confirms or in production with explicit flag
      unless ENV["CONFIRM"] == "true"
        puts "⚠️  This will DELETE legacy Xero documents."
        puts "   Set CONFIRM=true to proceed."
        puts "   Example: rails xero:warehouse:cleanup_legacy CONFIRM=true"
        next
      end

      # Delete legacy CorporateCompanyDocument records
      deleted_corporate = 0
      CorporateCompanyDocument.where(source: "xero").find_in_batches(batch_size: 100) do |batch|
        batch.each do |doc|
          # Decrement blob reference if linked
          doc.storage_blob&.decrement_reference! if doc.respond_to?(:storage_blob) && doc.storage_blob
          doc.destroy
          deleted_corporate += 1
        end
        print "."
      end
      puts "\n  Deleted #{deleted_corporate} CorporateCompanyDocuments"

      # Delete legacy ContactDocument records
      deleted_contact = 0
      if ContactDocument.column_names.include?("source")
        ContactDocument.where(source: "xero").find_in_batches(batch_size: 100) do |batch|
          batch.each do |doc|
            doc.storage_blob&.decrement_reference! if doc.respond_to?(:storage_blob) && doc.storage_blob
            doc.destroy
            deleted_contact += 1
          end
          print "."
        end
      end
      puts "  Deleted #{deleted_contact} ContactDocuments"

      # Cleanup orphaned blobs
      orphan_blobs = StorageBlob.left_joins(:warehouse_documents)
                                .where(warehouse_documents: { id: nil })
                                .where(reference_count: 0)
      orphan_count = orphan_blobs.count
      if orphan_count > 0
        puts "\n  Found #{orphan_count} orphaned blobs (skipping deletion - use blob:cleanup)"
      end

      puts "\n✅ Legacy cleanup complete"
    end

    desc "Re-sync all ExternalInvoices via XeroAttachmentSyncService"
    task resync: :environment do
      puts "\n🔄 Re-syncing Xero invoices to WarehouseDocument..."

      limit = (ENV["LIMIT"] || 100).to_i
      tenant_id = ENV["TENANT_ID"]

      # Find invoices that need syncing
      already_synced_ids = WarehouseDocument.where(source_type: "xero")
                                             .where(documentable_type: "ExternalInvoice")
                                             .where("metadata->>'is_primary' = ?", "true")
                                             .where.not(storage_blob_id: nil)
                                             .pluck(:documentable_id)

      invoices = ExternalInvoice.active
                                .where.not(external_id: nil)
                                .where.not(tenant_id: nil)
                                .where.not(contact_id: nil)
                                .where.not(id: already_synced_ids)
      invoices = invoices.where(tenant_id: tenant_id) if tenant_id.present?
      invoices = invoices.limit(limit)

      total = invoices.count
      puts "  Found #{total} invoices needing sync (limit: #{limit})"

      success = 0
      failed = 0
      skipped = 0

      invoices.find_each.with_index do |invoice, idx|
        begin
          service = XeroAttachmentSyncService.new(invoice, skip_storage_upload: true)
          result = service.sync!

          if result[:errors].any?
            failed += 1
            puts "  ❌ Invoice #{invoice.id}: #{result[:errors].first}" if failed <= 5
          elsif result[:skipped]
            skipped += 1
          else
            success += 1
          end

          # Progress indicator
          print "." if (idx + 1) % 10 == 0
        rescue => e
          failed += 1
          puts "  ❌ Invoice #{invoice.id}: #{e.message}" if failed <= 5
        end
      end

      puts "\n\n📊 Resync Results:"
      puts "  Success: #{success}"
      puts "  Skipped (already synced): #{skipped}"
      puts "  Failed: #{failed}"

      remaining = ExternalInvoice.active
                                 .where.not(external_id: nil)
                                 .where.not(tenant_id: nil)
                                 .where.not(contact_id: nil)
                                 .where.not(id: already_synced_ids + invoices.pluck(:id))
                                 .count
      puts "  Remaining: #{remaining}"

      if remaining > 0
        puts "\n💡 Run again to sync more: rails xero:warehouse:resync LIMIT=#{limit}"
      end
    end

    desc "Verify migration state"
    task verify: :environment do
      puts "\n✅ Verifying migration..."

      # Check for any remaining legacy documents
      legacy_corporate = CorporateCompanyDocument.where(source: "xero").count
      legacy_contact = ContactDocument.where(source: "xero").count rescue 0

      # Check WarehouseDocument state
      warehouse_total = WarehouseDocument.where(source_type: "xero").count
      warehouse_with_blob = WarehouseDocument.where(source_type: "xero")
                                              .joins(:storage_blob)
                                              .where.not(storage_blobs: { content_hash: nil })
                                              .count

      # Check invoices
      active_invoices = ExternalInvoice.active
                                       .where.not(external_id: nil)
                                       .where.not(tenant_id: nil)
                                       .where.not(contact_id: nil)
                                       .count
      invoices_synced = WarehouseDocument.where(source_type: "xero")
                                          .where(documentable_type: "ExternalInvoice")
                                          .where("metadata->>'is_primary' = ?", "true")
                                          .where.not(storage_blob_id: nil)
                                          .distinct.count(:documentable_id)

      puts "\nVerification Results:"
      puts "  Legacy CorporateCompanyDocument: #{legacy_corporate} #{legacy_corporate == 0 ? '✅' : '⚠️'}"
      puts "  Legacy ContactDocument: #{legacy_contact} #{legacy_contact == 0 ? '✅' : '⚠️'}"
      puts "  WarehouseDocument (Xero): #{warehouse_total}"
      puts "  WarehouseDocument with valid blob: #{warehouse_with_blob}"
      puts "  Active invoices: #{active_invoices}"
      puts "  Invoices synced: #{invoices_synced}"

      sync_percentage = active_invoices > 0 ? ((invoices_synced.to_f / active_invoices) * 100).round(1) : 100
      puts "\n  Sync progress: #{sync_percentage}%"

      if legacy_corporate == 0 && legacy_contact == 0 && sync_percentage >= 95
        puts "\n🎉 Migration complete!"
      elsif sync_percentage < 95
        puts "\n⚠️  Sync incomplete - run: rails xero:warehouse:resync"
      else
        puts "\n⚠️  Legacy cleanup needed - run: rails xero:warehouse:cleanup_legacy CONFIRM=true"
      end
    end

    desc "Show migration status summary"
    task status: :environment do
      Rake::Task["xero:warehouse:analyze"].invoke
    end
  end
end
