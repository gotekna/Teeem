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
                                              .where.not(storage_blob_id: nil)
                                              .count
      # Note: content_hash is for deduplication, not validity
      # Migrated docs may link to legacy blobs without content_hash
      warehouse_with_hash = WarehouseDocument.where(source_type: "xero")
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
      puts "  Legacy CorporateCompanyDocument: #{legacy_corporate} #{legacy_corporate == 0 ? '✅' : '⚠️ (can cleanup)'}"
      puts "  Legacy ContactDocument: #{legacy_contact} #{legacy_contact == 0 ? '✅' : '⚠️ (can cleanup)'}"
      puts "  WarehouseDocument (Xero): #{warehouse_total}"
      puts "  WarehouseDocument with blob: #{warehouse_with_blob} #{warehouse_with_blob == warehouse_total ? '✅' : '⚠️'}"
      puts "  WarehouseDocument with content_hash: #{warehouse_with_hash} (optional - for dedup)"
      puts "  Active invoices: #{active_invoices}"
      puts "  Invoices synced: #{invoices_synced}"

      sync_percentage = active_invoices > 0 ? ((invoices_synced.to_f / active_invoices) * 100).round(1) : 100
      puts "\n  Sync progress: #{sync_percentage}%"

      if legacy_corporate == 0 && legacy_contact == 0 && sync_percentage >= 95
        puts "\n🎉 Migration complete!"
      elsif sync_percentage >= 95
        puts "\n⚠️  Legacy cleanup needed - run: rails xero:warehouse:cleanup_legacy CONFIRM=true"
      else
        puts "\n⚠️  Sync incomplete - run: rails xero:warehouse:migrate_from_legacy"
      end
    end

    desc "Show migration status summary"
    task status: :environment do
      Rake::Task["xero:warehouse:analyze"].invoke
    end

    desc "Migrate existing CorporateCompanyDocument Xero records to WarehouseDocument (no Xero API needed)"
    task migrate_from_legacy: :environment do
      puts "\n🔄 Migrating CorporateCompanyDocument → WarehouseDocument (local data only)..."

      limit = (ENV["LIMIT"] || 1000).to_i
      dry_run = ENV["DRY_RUN"] == "true"

      # SSoT: One WarehouseDocument per ExternalInvoice (not per blob)
      # The legacy table has massive duplication - 11,467 records but only ~100 unique blobs
      # We want to create one WarehouseDocument per invoice, preserving the documentable link

      # Find invoices that already have WarehouseDocument
      already_migrated_invoice_ids = WarehouseDocument.where(source_type: "xero")
                                                        .where(documentable_type: "ExternalInvoice")
                                                        .where("metadata->>'is_primary' = ?", "true")
                                                        .pluck(:documentable_id)

      # Find unique invoices in legacy that need migration
      # Pick the FIRST (oldest) legacy doc for each invoice to avoid duplicates
      invoice_ids_needing_migration = CorporateCompanyDocument.where(source: "xero")
                                                                .where(documentable_type: "ExternalInvoice")
                                                                .where.not(storage_blob_id: nil)
                                                                .where.not(documentable_id: already_migrated_invoice_ids)
                                                                .group(:documentable_id)
                                                                .minimum(:id)
                                                                .values

      # Get the legacy docs to migrate
      legacy_docs = CorporateCompanyDocument.where(id: invoice_ids_needing_migration)
                                             .order(:id)
                                             .limit(limit)

      total = legacy_docs.count
      total_pending = invoice_ids_needing_migration.count
      puts "  Found #{total} invoices to migrate (of #{total_pending} pending, limit: #{limit})"
      puts "  DRY RUN - no changes will be made" if dry_run

      success = 0
      skipped = 0
      failed = 0

      # Find default tenant
      tenant = Tenant.first
      unless tenant
        puts "  ❌ No tenant found - cannot migrate"
        next
      end

      ActsAsTenant.with_tenant(tenant) do
        legacy_docs.find_each.with_index do |legacy_doc, idx|
          begin
            invoice = legacy_doc.documentable
            unless invoice.is_a?(ExternalInvoice)
              skipped += 1
              next
            end

            # Double-check not already migrated
            existing = WarehouseDocument.find_by(
              documentable: invoice,
              source_type: "xero"
            )

            if existing.present? && existing.metadata&.dig("is_primary")
              skipped += 1
              next
            end

            contact = legacy_doc.contact || invoice&.contact

            # Determine folder from legacy data
            folder = legacy_doc.folder.presence || "Xero/#{legacy_doc.document_type.presence || 'Bills'}"

            # Build metadata from legacy fields
            metadata = {
              "source" => "migrated_from_corporate_company_document",
              "legacy_id" => legacy_doc.id,
              "invoice_number" => invoice&.invoice_number,
              "invoice_type" => invoice&.invoice_type,
              "xero_id" => legacy_doc.external_id || invoice&.external_id,
              "contact_id" => contact&.id,
              "document_type_id" => legacy_doc.document_type_id,
              "document_date" => legacy_doc.document_date&.iso8601,
              "migrated_at" => Time.current.iso8601,
              "is_primary" => true
            }.compact

            if dry_run
              puts "  Would create: Invoice #{invoice.invoice_number} -> #{legacy_doc.display_name || legacy_doc.file_name}" if idx < 5
              success += 1
              next
            end

            warehouse_doc = WarehouseDocument.new(
              documentable: invoice,
              storage_blob_id: legacy_doc.storage_blob_id,
              display_name: legacy_doc.display_name.presence || legacy_doc.file_name.presence || "Xero Document #{invoice.invoice_number}",
              original_filename: legacy_doc.file_name,
              folder: folder,
              source_type: "xero",
              tenant_id: tenant.id,
              content_type: legacy_doc.mime_type.presence || "application/pdf",
              file_size: legacy_doc.file_size,
              linkable: contact,
              metadata: metadata
            )

            if warehouse_doc.save
              # Increment reference count since we're adding a new reference to the blob
              legacy_doc.storage_blob&.increment_reference!
              success += 1
            else
              failed += 1
              puts "  ❌ Failed invoice #{invoice.id}: #{warehouse_doc.errors.full_messages.first}" if failed <= 5
            end

            # Progress indicator
            print "." if (idx + 1) % 100 == 0
          rescue => e
            failed += 1
            puts "  ❌ Error invoice #{legacy_doc.documentable_id}: #{e.message}" if failed <= 5
          end
        end
      end

      puts "\n\n📊 Migration Results:"
      puts "  Success: #{success}"
      puts "  Skipped (already migrated): #{skipped}"
      puts "  Failed: #{failed}"

      remaining = total_pending - (success + skipped)
      puts "  Remaining invoices: #{remaining}"

      if remaining > 0
        puts "\n💡 Run again to migrate more: rails xero:warehouse:migrate_from_legacy LIMIT=#{limit}"
      else
        puts "\n✅ All invoices migrated! Next steps:"
        puts "   1. Verify: rails xero:warehouse:verify"
        puts "   2. Cleanup: rails xero:warehouse:cleanup_legacy CONFIRM=true"
      end
    end

    desc "Migrate ALL remaining CorporateCompanyDocument to WarehouseDocument (SSoT consolidation)"
    task migrate_all_corporate: :environment do
      puts "\n🔄 Migrating ALL CorporateCompanyDocument → WarehouseDocument..."

      limit = (ENV["LIMIT"] || 1000).to_i
      dry_run = ENV["DRY_RUN"] == "true"

      # Find docs not yet migrated (check by storage_blob_id to avoid duplicates)
      already_migrated_blob_ids = WarehouseDocument.where(source_type: "corporate")
                                                    .pluck(:storage_blob_id)

      legacy_docs = CorporateCompanyDocument.where.not(storage_blob_id: nil)
                                             .where.not(storage_blob_id: already_migrated_blob_ids)
                                             .order(:id)
                                             .limit(limit)

      total = legacy_docs.count
      total_pending = CorporateCompanyDocument.where.not(storage_blob_id: nil)
                                               .where.not(storage_blob_id: already_migrated_blob_ids)
                                               .count
      puts "  Found #{total} docs to migrate (of #{total_pending} pending, limit: #{limit})"
      puts "  DRY RUN - no changes will be made" if dry_run

      success = 0
      skipped = 0
      failed = 0

      tenant = Tenant.first
      unless tenant
        puts "  ❌ No tenant found"
        next
      end

      ActsAsTenant.with_tenant(tenant) do
        legacy_docs.find_each.with_index do |legacy_doc, idx|
          begin
            # Skip if already migrated
            existing = WarehouseDocument.find_by(
              storage_blob_id: legacy_doc.storage_blob_id,
              source_type: "corporate"
            )

            if existing.present?
              skipped += 1
              next
            end

            # Determine source_type based on legacy source
            source_type = case legacy_doc.source
                          when "sharepoint" then "corporate"
                          when "manual" then "corporate"
                          when "task_upload" then "task"
                          else "corporate"
                          end

            # Build folder from legacy data
            folder = legacy_doc.folder.presence || "Corporate/#{legacy_doc.document_type.presence || 'Documents'}"

            metadata = {
              "source" => "migrated_from_corporate_company_document",
              "legacy_source" => legacy_doc.source,
              "legacy_id" => legacy_doc.id,
              "company_id" => legacy_doc.company_id,
              "document_type" => legacy_doc.document_type,
              "document_type_id" => legacy_doc.document_type_id,
              "document_date" => legacy_doc.document_date&.iso8601,
              "migrated_at" => Time.current.iso8601
            }.compact

            if dry_run
              puts "  Would create: #{legacy_doc.display_name || legacy_doc.file_name}" if idx < 5
              success += 1
              next
            end

            warehouse_doc = WarehouseDocument.new(
              documentable: legacy_doc.documentable,
              storage_blob_id: legacy_doc.storage_blob_id,
              display_name: legacy_doc.display_name.presence || legacy_doc.file_name.presence || "Document #{legacy_doc.id}",
              original_filename: legacy_doc.file_name,
              folder: folder,
              source_type: source_type,
              tenant_id: tenant.id,
              content_type: legacy_doc.mime_type.presence || "application/octet-stream",
              file_size: legacy_doc.file_size,
              linkable: legacy_doc.contact || legacy_doc.company,
              metadata: metadata
            )

            if warehouse_doc.save
              legacy_doc.storage_blob&.increment_reference!
              success += 1
            else
              failed += 1
              puts "  ❌ Failed: #{legacy_doc.id} - #{warehouse_doc.errors.full_messages.first}" if failed <= 5
            end

            print "." if (idx + 1) % 100 == 0
          rescue => e
            failed += 1
            puts "  ❌ Error #{legacy_doc.id}: #{e.message}" if failed <= 5
          end
        end
      end

      puts "\n\n📊 Migration Results:"
      puts "  Success: #{success}"
      puts "  Skipped: #{skipped}"
      puts "  Failed: #{failed}"

      remaining = total_pending - (success + skipped)
      puts "  Remaining: #{remaining}"

      if remaining > 0
        puts "\n💡 Run again: rails xero:warehouse:migrate_all_corporate LIMIT=#{limit}"
      else
        puts "\n✅ All CorporateCompanyDocument migrated!"
      end
    end

    desc "Cleanup ALL CorporateCompanyDocument after migration to WarehouseDocument"
    task cleanup_all_corporate: :environment do
      puts "\n🧹 Cleaning up ALL CorporateCompanyDocument..."

      unless ENV["CONFIRM"] == "true"
        puts "⚠️  This will DELETE all CorporateCompanyDocument records."
        puts "   Set CONFIRM=true to proceed."
        next
      end

      deleted = 0
      CorporateCompanyDocument.find_in_batches(batch_size: 100) do |batch|
        batch.each do |doc|
          doc.storage_blob&.decrement_reference! if doc.storage_blob
          doc.destroy
          deleted += 1
        end
        print "."
      end
      puts "\n  Deleted #{deleted} CorporateCompanyDocuments"
      puts "\n✅ Cleanup complete - CorporateCompanyDocument is now empty (SSoT achieved!)"
    end

    desc "Contact documents migration from ContactDocument to WarehouseDocument"
    task migrate_contact_docs: :environment do
      puts "\n🔄 Migrating ContactDocument → WarehouseDocument..."

      limit = (ENV["LIMIT"] || 1000).to_i
      dry_run = ENV["DRY_RUN"] == "true"

      # Check if ContactDocument has source column
      unless ContactDocument.column_names.include?("source")
        puts "  ⚠️  ContactDocument doesn't have 'source' column - skipping"
        next
      end

      # Check if ContactDocument has storage_blob_id
      unless ContactDocument.column_names.include?("storage_blob_id")
        puts "  ⚠️  ContactDocument doesn't have 'storage_blob_id' column - cannot migrate"
        next
      end

      legacy_docs = ContactDocument.where(source: "xero")
                                    .where.not(storage_blob_id: nil)
                                    .limit(limit)

      total = legacy_docs.count
      puts "  Found #{total} contact docs to migrate (limit: #{limit})"
      puts "  DRY RUN - no changes will be made" if dry_run

      success = 0
      skipped = 0
      failed = 0

      tenant = Tenant.first
      unless tenant
        puts "  ❌ No tenant found"
        next
      end

      ActsAsTenant.with_tenant(tenant) do
        legacy_docs.find_each.with_index do |legacy_doc, idx|
          begin
            # Skip if already migrated
            existing = WarehouseDocument.find_by(
              storage_blob_id: legacy_doc.storage_blob_id,
              source_type: "xero"
            )

            if existing.present?
              skipped += 1
              next
            end

            contact = legacy_doc.contact

            metadata = {
              "source" => "migrated_from_contact_document",
              "legacy_id" => legacy_doc.id,
              "contact_id" => contact&.id,
              "migrated_at" => Time.current.iso8601,
              "is_primary" => true
            }.compact

            if dry_run
              puts "  Would create: #{legacy_doc.respond_to?(:display_name) ? legacy_doc.display_name : legacy_doc.file_name}" if idx < 5
              success += 1
              next
            end

            display_name = if legacy_doc.respond_to?(:display_name) && legacy_doc.display_name.present?
                             legacy_doc.display_name
                           elsif legacy_doc.respond_to?(:file_name) && legacy_doc.file_name.present?
                             legacy_doc.file_name
                           else
                             "Contact Document #{legacy_doc.id}"
                           end

            warehouse_doc = WarehouseDocument.new(
              documentable: legacy_doc,
              storage_blob_id: legacy_doc.storage_blob_id,
              display_name: display_name,
              original_filename: legacy_doc.respond_to?(:file_name) ? legacy_doc.file_name : nil,
              folder: "Contacts/#{contact&.name || 'Unknown'}/Xero",
              source_type: "xero",
              tenant_id: tenant.id,
              content_type: legacy_doc.respond_to?(:mime_type) ? legacy_doc.mime_type : "application/pdf",
              file_size: legacy_doc.respond_to?(:file_size) ? legacy_doc.file_size : nil,
              linkable: contact,
              metadata: metadata
            )

            if warehouse_doc.save
              legacy_doc.storage_blob&.increment_reference!
              success += 1
            else
              failed += 1
              puts "  ❌ Failed: #{legacy_doc.id} - #{warehouse_doc.errors.full_messages.first}" if failed <= 5
            end

            print "." if (idx + 1) % 100 == 0
          rescue => e
            failed += 1
            puts "  ❌ Error #{legacy_doc.id}: #{e.message}" if failed <= 5
          end
        end
      end

      puts "\n\n📊 Migration Results:"
      puts "  Success: #{success}"
      puts "  Skipped: #{skipped}"
      puts "  Failed: #{failed}"

      remaining = ContactDocument.where(source: "xero")
                                  .where.not(storage_blob_id: nil)
                                  .count - (success + skipped + failed)
      if remaining > 0
        puts "\n💡 Run again: rails xero:warehouse:migrate_contact_docs LIMIT=#{limit}"
      end
    end
  end
end
