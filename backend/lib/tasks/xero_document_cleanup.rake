# frozen_string_literal: true

# Xero Document Cleanup Tasks
#
# SSoT Deduplication Cleanup (Jan 2026)
#
# These tasks clean up duplicate and orphaned WarehouseDocuments
# to maintain SSoT integrity.
#
# Usage:
#   rails xero:cleanup:status              # Check what needs cleanup
#   rails xero:cleanup:duplicates_dry_run  # Preview duplicate cleanup
#   rails xero:cleanup:duplicates_execute  # Delete duplicate documents
#   rails xero:cleanup:orphans_dry_run     # Preview orphan cleanup
#   rails xero:cleanup:orphans_execute     # Delete orphaned documents
#
namespace :xero do
  namespace :cleanup do
    desc "Check cleanup status - duplicates and orphans"
    task status: :environment do
      puts "=" * 60
      puts "Xero Document Cleanup Status"
      puts "=" * 60

      # Count duplicates (same content_hash, multiple documents)
      duplicate_hashes = WarehouseDocument
        .joins(:storage_blob)
        .where(source_type: "xero")
        .where.not(storage_blobs: { content_hash: nil })
        .group("storage_blobs.content_hash")
        .having("COUNT(*) > 1")
        .count

      total_duplicates = duplicate_hashes.values.sum - duplicate_hashes.count
      puts "\nDuplicate Documents:"
      puts "  Content hashes with duplicates: #{duplicate_hashes.count}"
      puts "  Total duplicate documents: #{total_duplicates}"
      puts "  (These are extra copies that can be deleted)"

      # Count orphans (no documentable link)
      orphaned_xero = WarehouseDocument
        .where(source_type: "xero")
        .where(documentable_id: nil)
        .count

      orphaned_other = WarehouseDocument
        .where.not(source_type: "xero")
        .where(documentable_id: nil)
        .where(parent_document_id: nil) # Not an attachment
        .count

      puts "\nOrphaned Documents (no link to source record):"
      puts "  Xero orphans: #{orphaned_xero}"
      puts "  Other orphans: #{orphaned_other}"

      # Old corporate documents
      corporate_docs = WarehouseDocument.where(source_type: "corporate").count
      corporate_orphans = WarehouseDocument
        .where(source_type: "corporate")
        .where(documentable_id: nil)
        .count

      puts "\nCorporate Documents:"
      puts "  Total: #{corporate_docs}"
      puts "  Orphaned (no link): #{corporate_orphans}"

      # Storage impact
      orphan_size = WarehouseDocument
        .where(documentable_id: nil)
        .where(parent_document_id: nil)
        .sum(:file_size)

      puts "\nStorage Impact:"
      puts "  Orphaned docs total size: #{(orphan_size / 1024.0 / 1024.0).round(2)} MB"

      puts "\n" + "=" * 60
      puts "Run cleanup tasks:"
      puts "  rails xero:cleanup:duplicates_dry_run"
      puts "  rails xero:cleanup:orphans_dry_run"
      puts "=" * 60
    end

    desc "Dry run: Preview Xero duplicate document cleanup"
    task duplicates_dry_run: :environment do
      puts "=" * 60
      puts "Xero Duplicate Document Cleanup - DRY RUN"
      puts "=" * 60
      puts "Scope: source_type = 'xero' only"
      puts ""

      results = cleanup_duplicates(dry_run: true, source_type: "xero")

      puts "\nResults:"
      puts "  Duplicate groups processed: #{results[:groups_processed]}"
      puts "  Documents to keep: #{results[:kept]}"
      puts "  Documents to delete: #{results[:to_delete]}"
      puts "  Errors: #{results[:errors].count}"

      if results[:errors].any?
        puts "\nErrors (first 10):"
        results[:errors].first(10).each { |e| puts "  #{e}" }
      end

      if results[:samples].any?
        puts "\nSample deletions (first 10):"
        results[:samples].first(10).each do |sample|
          puts "  Keep: #{sample[:keep_id]} (#{sample[:keep_reason]})"
          puts "  Delete: #{sample[:delete_ids].join(', ')}"
          puts ""
        end
      end

      puts "\n" + "=" * 60
      puts "To execute cleanup, run:"
      puts "  rails xero:cleanup:duplicates_execute"
    end

    desc "Execute: Delete Xero duplicate documents"
    task duplicates_execute: :environment do
      puts "=" * 60
      puts "Xero Duplicate Document Cleanup - EXECUTE"
      puts "=" * 60
      puts "Scope: source_type = 'xero' only"
      puts "\nThis will DELETE duplicate WarehouseDocuments."
      puts "Press Ctrl+C within 5 seconds to cancel..."
      sleep 5

      results = cleanup_duplicates(dry_run: false, source_type: "xero")

      puts "\nResults:"
      puts "  Duplicate groups processed: #{results[:groups_processed]}"
      puts "  Documents kept: #{results[:kept]}"
      puts "  Documents deleted: #{results[:deleted]}"
      puts "  Errors: #{results[:errors].count}"

      if results[:errors].any?
        puts "\nErrors (first 5):"
        results[:errors].first(5).each { |e| puts "  #{e}" }
      end

      puts "\n" + "=" * 60
    end

    desc "Dry run: Preview ALL duplicate document cleanup (all source types)"
    task duplicates_all_dry_run: :environment do
      puts "=" * 60
      puts "ALL Duplicate Document Cleanup - DRY RUN"
      puts "=" * 60
      puts "Scope: ALL source types (xero, corporate, email, job, etc.)"
      puts ""

      results = cleanup_duplicates(dry_run: true, source_type: nil)

      puts "\nResults:"
      puts "  Duplicate groups processed: #{results[:groups_processed]}"
      puts "  Documents to keep: #{results[:kept]}"
      puts "  Documents to delete: #{results[:to_delete]}"
      puts "  Errors: #{results[:errors].count}"

      if results[:errors].any?
        puts "\nErrors (first 10):"
        results[:errors].first(10).each { |e| puts "  #{e}" }
      end

      if results[:samples].any?
        puts "\nSample deletions (first 10):"
        results[:samples].first(10).each do |sample|
          puts "  Keep: #{sample[:keep_id]} (#{sample[:keep_reason]})"
          puts "  Delete: #{sample[:delete_ids].join(', ')}"
          puts ""
        end
      end

      puts "\n" + "=" * 60
      puts "To execute cleanup, run:"
      puts "  rails xero:cleanup:duplicates_all_execute"
    end

    desc "Execute: Delete ALL duplicate documents (all source types)"
    task duplicates_all_execute: :environment do
      puts "=" * 60
      puts "ALL Duplicate Document Cleanup - EXECUTE"
      puts "=" * 60
      puts "Scope: ALL source types (xero, corporate, email, job, etc.)"
      puts "\n⚠️  WARNING: This affects ALL document types, not just Xero!"
      puts "This will DELETE duplicate WarehouseDocuments across ALL sources."
      puts "Press Ctrl+C within 10 seconds to cancel..."
      sleep 10

      results = cleanup_duplicates(dry_run: false, source_type: nil)

      puts "\nResults:"
      puts "  Duplicate groups processed: #{results[:groups_processed]}"
      puts "  Documents kept: #{results[:kept]}"
      puts "  Documents deleted: #{results[:deleted]}"
      puts "  Errors: #{results[:errors].count}"

      if results[:errors].any?
        puts "\nErrors (first 5):"
        results[:errors].first(5).each { |e| puts "  #{e}" }
      end

      puts "\n" + "=" * 60
    end

    desc "Dry run: Preview orphan document cleanup"
    task orphans_dry_run: :environment do
      puts "=" * 60
      puts "Orphan Document Cleanup - DRY RUN"
      puts "=" * 60

      results = cleanup_orphans(dry_run: true)

      puts "\nResults:"
      puts "  Orphaned documents found: #{results[:found]}"
      puts "  Documents to delete: #{results[:to_delete]}"
      puts "  By source type:"
      results[:by_source].each do |source, count|
        puts "    #{source}: #{count}"
      end

      if results[:samples].any?
        puts "\nSample deletions (first 20):"
        results[:samples].first(20).each do |sample|
          puts "  ID: #{sample[:id]}, Source: #{sample[:source_type]}, Name: #{sample[:display_name][0..50]}..."
        end
      end

      puts "\n" + "=" * 60
      puts "To execute cleanup, run:"
      puts "  rails xero:cleanup:orphans_execute"
    end

    desc "Execute: Delete orphaned documents"
    task orphans_execute: :environment do
      puts "=" * 60
      puts "Orphan Document Cleanup - EXECUTE"
      puts "=" * 60
      puts "\nThis will DELETE orphaned WarehouseDocuments."
      puts "Press Ctrl+C within 5 seconds to cancel..."
      sleep 5

      results = cleanup_orphans(dry_run: false)

      puts "\nResults:"
      puts "  Orphaned documents found: #{results[:found]}"
      puts "  Documents deleted: #{results[:deleted]}"
      puts "  Blobs decremented: #{results[:blobs_decremented]}"
      puts "  Errors: #{results[:errors].count}"

      if results[:errors].any?
        puts "\nErrors (first 5):"
        results[:errors].first(5).each { |e| puts "  #{e}" }
      end

      puts "\n" + "=" * 60
    end

    desc "Check corporate document status and linkage"
    task corporate_status: :environment do
      puts "=" * 60
      puts "Corporate Document Status"
      puts "=" * 60

      total = WarehouseDocument.where(source_type: "corporate").count
      linked = WarehouseDocument.where(source_type: "corporate").where.not(documentable_id: nil).count
      orphaned = WarehouseDocument.where(source_type: "corporate").where(documentable_id: nil).count

      puts "\nCorporate Documents:"
      puts "  Total: #{total}"
      puts "  Linked: #{linked}"
      puts "  Orphaned: #{orphaned}"

      # Check what they're linked to
      if linked > 0
        puts "\nLinked to:"
        WarehouseDocument
          .where(source_type: "corporate")
          .where.not(documentable_id: nil)
          .group(:documentable_type)
          .count
          .each do |type, count|
            puts "  #{type}: #{count}"
          end
      end

      # Check linkable associations
      linkable_count = WarehouseDocument
        .where(source_type: "corporate")
        .where.not(linkable_id: nil)
        .count
      puts "\nWith linkable association: #{linkable_count}"

      if linkable_count > 0
        WarehouseDocument
          .where(source_type: "corporate")
          .where.not(linkable_id: nil)
          .group(:linkable_type)
          .count
          .each do |type, count|
            puts "  #{type}: #{count}"
          end
      end

      # Check metadata for company info
      puts "\nOrphaned documents with company info in metadata:"
      with_company_id = WarehouseDocument
        .where(source_type: "corporate")
        .where(documentable_id: nil)
        .where("metadata->>'corporate_company_id' IS NOT NULL")
        .count
      puts "  With corporate_company_id in metadata: #{with_company_id}"

      with_company_name = WarehouseDocument
        .where(source_type: "corporate")
        .where(documentable_id: nil)
        .where("metadata->>'company_name' IS NOT NULL OR metadata->>'corporate_company_name' IS NOT NULL")
        .count
      puts "  With company_name in metadata: #{with_company_name}"

      # Sample orphaned docs
      puts "\nSample orphaned corporate documents (first 10):"
      WarehouseDocument
        .where(source_type: "corporate")
        .where(documentable_id: nil)
        .limit(10)
        .each do |doc|
          puts "  ID: #{doc.id}"
          puts "    Display: #{doc.display_name[0..50]}..."
          puts "    Folder: #{doc.folder}"
          puts "    Linkable: #{doc.linkable_type}##{doc.linkable_id}" if doc.linkable_id
          puts "    Metadata: #{doc.metadata&.slice('corporate_company_id', 'company_name', 'document_type')}"
          puts ""
        end

      puts "\n" + "=" * 60
    end

    desc "Dry run: Reconcile corporate documents to CorporateCompany"
    task corporate_reconcile_dry_run: :environment do
      puts "=" * 60
      puts "Corporate Document Reconciliation - DRY RUN"
      puts "=" * 60

      results = reconcile_corporate_documents(dry_run: true)

      puts "\nResults:"
      puts "  Orphaned documents: #{results[:orphaned]}"
      puts "  Can link by metadata: #{results[:linkable_by_metadata]}"
      puts "  Can link by folder: #{results[:linkable_by_folder]}"
      puts "  Cannot link: #{results[:cannot_link]}"

      if results[:samples].any?
        puts "\nSample linkages (first 20):"
        results[:samples].first(20).each do |sample|
          puts "  Doc #{sample[:doc_id]}: #{sample[:display_name][0..40]}..."
          puts "    -> Link to: #{sample[:link_type]}##{sample[:link_id]} (#{sample[:link_name]})"
          puts "    -> Match: #{sample[:match_reason]}"
          puts ""
        end
      end

      puts "\n" + "=" * 60
      puts "To execute reconciliation, run:"
      puts "  rails xero:cleanup:corporate_reconcile_execute"
    end

    desc "Execute: Reconcile corporate documents to CorporateCompany"
    task corporate_reconcile_execute: :environment do
      puts "=" * 60
      puts "Corporate Document Reconciliation - EXECUTE"
      puts "=" * 60
      puts "\nThis will link orphaned corporate documents to CorporateCompany."
      puts "Press Ctrl+C within 5 seconds to cancel..."
      sleep 5

      results = reconcile_corporate_documents(dry_run: false)

      puts "\nResults:"
      puts "  Orphaned documents: #{results[:orphaned]}"
      puts "  Linked by metadata: #{results[:linked_by_metadata]}"
      puts "  Linked by folder: #{results[:linked_by_folder]}"
      puts "  Could not link: #{results[:cannot_link]}"
      puts "  Errors: #{results[:errors].count}"

      if results[:errors].any?
        puts "\nErrors (first 5):"
        results[:errors].first(5).each { |e| puts "  #{e}" }
      end

      puts "\n" + "=" * 60
    end

    desc "Dry run: Preview corporate document orphan cleanup (AFTER reconciliation)"
    task corporate_orphans_dry_run: :environment do
      puts "=" * 60
      puts "Corporate Document Orphan Cleanup - DRY RUN"
      puts "=" * 60
      puts "\n⚠️  Run corporate_reconcile_execute FIRST to link documents!"
      puts ""

      orphans = WarehouseDocument
        .where(source_type: "corporate")
        .where(documentable_id: nil)
        .where(linkable_id: nil) # Also not linked via linkable

      count = orphans.count
      puts "Found #{count} truly orphaned corporate documents (no documentable, no linkable)"

      if count > 0
        puts "\nSample (first 20):"
        orphans.limit(20).each do |doc|
          puts "  ID: #{doc.id}"
          puts "    Display: #{doc.display_name[0..60]}..."
          puts "    Folder: #{doc.folder}"
          puts "    Created: #{doc.created_at}"
          puts ""
        end

        # Check if they have storage blobs
        with_blob = orphans.where.not(storage_blob_id: nil).count
        without_blob = orphans.where(storage_blob_id: nil).count
        puts "With storage blob: #{with_blob}"
        puts "Without storage blob (metadata only): #{without_blob}"
      end

      puts "\n" + "=" * 60
      puts "To delete these, run:"
      puts "  rails xero:cleanup:corporate_orphans_execute"
    end

    desc "Execute: Delete orphaned corporate documents (AFTER reconciliation)"
    task corporate_orphans_execute: :environment do
      puts "=" * 60
      puts "Corporate Document Orphan Cleanup - EXECUTE"
      puts "=" * 60
      puts "\n⚠️  Make sure you ran corporate_reconcile_execute FIRST!"
      puts "This will DELETE truly orphaned corporate WarehouseDocuments."
      puts "Press Ctrl+C within 5 seconds to cancel..."
      sleep 5

      orphans = WarehouseDocument
        .where(source_type: "corporate")
        .where(documentable_id: nil)
        .where(linkable_id: nil) # Also not linked via linkable

      total = orphans.count
      deleted = 0
      errors = []

      orphans.find_each do |doc|
        begin
          # Decrement blob reference if exists
          doc.storage_blob&.decrement_reference!
          doc.destroy!
          deleted += 1

          if deleted % 100 == 0
            puts "Progress: #{deleted}/#{total} deleted"
          end
        rescue => e
          errors << "Doc #{doc.id}: #{e.message}"
        end
      end

      puts "\nResults:"
      puts "  Total orphans: #{total}"
      puts "  Deleted: #{deleted}"
      puts "  Errors: #{errors.count}"

      if errors.any?
        puts "\nErrors (first 5):"
        errors.first(5).each { |e| puts "  #{e}" }
      end

      puts "\n" + "=" * 60
    end

    desc "Set metadata company_id on all corporate docs linked via linkable"
    task fix_metadata: :environment do
      puts "=" * 60
      puts "Fix Corporate Document Metadata"
      puts "=" * 60

      # Find docs with linkable but missing metadata company_id
      docs_to_fix = WarehouseDocument
        .where(source_type: "corporate")
        .where(linkable_type: "CorporateCompany")
        .where.not(linkable_id: nil)
        .where("metadata->>'company_id' IS NULL")

      total = docs_to_fix.count
      puts "Found #{total} docs with linkable but missing metadata company_id"

      fixed = 0
      errors = []

      docs_to_fix.find_each do |doc|
        begin
          doc.update!(
            metadata: (doc.metadata || {}).merge("company_id" => doc.linkable_id.to_s)
          )
          fixed += 1
          puts "Progress: #{fixed}/#{total}" if fixed % 500 == 0
        rescue => e
          errors << "Doc #{doc.id}: #{e.message}"
        end
      end

      puts "\nResults:"
      puts "  Total: #{total}"
      puts "  Fixed: #{fixed}"
      puts "  Errors: #{errors.count}"

      if errors.any?
        puts "\nErrors (first 5):"
        errors.first(5).each { |e| puts "  #{e}" }
      end

      puts "\n" + "=" * 60
    end

    desc "Link ALL remaining unmatched corporate docs to Homes of Hope (#35)"
    task link_all_unmatched: :environment do
      puts "=" * 60
      puts "Link All Unmatched Corporate Docs to Homes of Hope"
      puts "=" * 60

      hoh_company = CorporateCompany.find(35)
      puts "Company: #{hoh_company.name} (ID: #{hoh_company.id})"

      unmatched = WarehouseDocument
        .where(source_type: "corporate")
        .where(linkable_id: nil)

      total = unmatched.count
      puts "Found #{total} unmatched corporate documents"

      linked = 0
      errors = []

      unmatched.find_each do |doc|
        begin
          doc.update!(
            linkable_type: "CorporateCompany",
            linkable_id: hoh_company.id,
            metadata: (doc.metadata || {}).merge(
              "company_id" => hoh_company.id.to_s,
              "reconciled_at" => Time.current.iso8601,
              "reconciled_reason" => "catch_all_unmatched"
            )
          )
          linked += 1
          puts "Progress: #{linked}/#{total}" if linked % 500 == 0
        rescue => e
          errors << "Doc #{doc.id}: #{e.message}"
        end
      end

      puts "\nResults:"
      puts "  Total: #{total}"
      puts "  Linked: #{linked}"
      puts "  Errors: #{errors.count}"

      if errors.any?
        puts "\nErrors (first 5):"
        errors.first(5).each { |e| puts "  #{e}" }
      end

      puts "\n" + "=" * 60
    end

    desc "Link HOH folder documents to Homes of Hope (CorporateCompany #35)"
    task link_hoh: :environment do
      puts "=" * 60
      puts "Link HOH Documents to Homes of Hope"
      puts "=" * 60

      hoh_company = CorporateCompany.find(35)
      puts "Company: #{hoh_company.name} (ID: #{hoh_company.id})"

      hoh_docs = WarehouseDocument
        .where(source_type: "corporate")
        .where(documentable_id: nil)
        .where(linkable_id: nil)
        .where("folder LIKE ?", "Corporate/Charity/HOH/%")

      total = hoh_docs.count
      puts "Found #{total} HOH documents to link"

      linked = 0
      errors = []

      hoh_docs.find_each do |doc|
        begin
          doc.update!(
            linkable_type: "CorporateCompany",
            linkable_id: hoh_company.id,
            metadata: (doc.metadata || {}).merge(
              "reconciled_at" => Time.current.iso8601,
              "reconciled_reason" => "folder_path_HOH"
            )
          )
          linked += 1
          puts "Progress: #{linked}/#{total}" if linked % 200 == 0
        rescue => e
          errors << "Doc #{doc.id}: #{e.message}"
        end
      end

      puts "\nResults:"
      puts "  Total: #{total}"
      puts "  Linked: #{linked}"
      puts "  Errors: #{errors.count}"

      if errors.any?
        puts "\nErrors (first 5):"
        errors.first(5).each { |e| puts "  #{e}" }
      end

      puts "\n" + "=" * 60
    end

    desc "Investigate corporate docs: find duplicates, orphans, and misclassified"
    task corporate_audit: :environment do
      puts "=" * 60
      puts "Corporate Document Audit"
      puts "=" * 60

      total = WarehouseDocument.where(source_type: "corporate").count
      with_blob = WarehouseDocument.where(source_type: "corporate").where.not(storage_blob_id: nil).count
      no_blob = total - with_blob
      puts "\nTotal corporate docs: #{total}"
      puts "  With blob: #{with_blob}"
      puts "  Without blob: #{no_blob}"

      # 1. Corporate docs WITH blob that duplicate another source_type
      puts "\n--- WITH BLOB: Cross-source duplicates ---"
      blob_dupes = 0
      blob_unique = 0
      WarehouseDocument.where(source_type: "corporate").where.not(storage_blob_id: nil).find_each do |doc|
        other = WarehouseDocument.where(storage_blob_id: doc.storage_blob_id)
                                 .where.not(id: doc.id)
                                 .where.not(source_type: "corporate")
                                 .first
        if other
          blob_dupes += 1
          puts "  DUPE: Corp WD##{doc.id} = #{other.source_type} WD##{other.id} (#{other.documentable_type}##{other.documentable_id})" if blob_dupes <= 10
        else
          blob_unique += 1
          puts "  UNIQUE: Corp WD##{doc.id} blob:#{doc.storage_blob_id} #{doc.display_name.to_s[0..50]}" if blob_unique <= 5
        end
      end
      puts "  Duplicates of task/job/other docs: #{blob_dupes}"
      puts "  Unique corporate-only: #{blob_unique}"

      # 2. Corporate docs WITHOUT blob - check by display_name match
      puts "\n--- WITHOUT BLOB: Display name matches ---"
      name_match = 0
      name_no_match = 0
      sample_size = [no_blob, 500].min
      WarehouseDocument.where(source_type: "corporate", storage_blob_id: nil).limit(sample_size).find_each do |doc|
        other = WarehouseDocument.where.not(source_type: "corporate")
                                 .where.not(storage_blob_id: nil)
                                 .where(display_name: doc.display_name)
                                 .first
        if other
          name_match += 1
          puts "  MATCH: Corp WD##{doc.id} '#{doc.display_name.to_s[0..40]}' = #{other.source_type} WD##{other.id}" if name_match <= 5
        else
          name_no_match += 1
        end
      end
      puts "  Name matches (sampled #{sample_size}): #{name_match}"
      puts "  No match: #{name_no_match}"

      # 3. Check metadata filename matches
      puts "\n--- WITHOUT BLOB: Metadata filename matches ---"
      fn_match = 0
      WarehouseDocument.where(source_type: "corporate", storage_blob_id: nil).limit(sample_size).find_each do |doc|
        filename = doc.metadata&.dig("filename")
        next unless filename.present?
        other = WarehouseDocument.where.not(source_type: "corporate")
                                 .where.not(storage_blob_id: nil)
                                 .where(display_name: filename.sub(/\.[^.]+$/, ""))
                                 .or(WarehouseDocument.where.not(source_type: "corporate")
                                                      .where.not(storage_blob_id: nil)
                                                      .where("display_name ILIKE ?", "%#{filename.sub(/\.[^.]+$/, "")}%"))
                                 .first
        if other
          fn_match += 1
          puts "  FN MATCH: Corp WD##{doc.id} '#{filename[0..40]}' = #{other.source_type} WD##{other.id}" if fn_match <= 5
        end
      end
      puts "  Filename matches (sampled #{sample_size}): #{fn_match}"

      # 4. Summary
      puts "\n--- CLEANUP RECOMMENDATION ---"
      puts "  Safe to delete (blob dupes): #{blob_dupes}"
      puts "  Corporate-only with blob (keep): #{blob_unique}"
      puts "  No blob, no file (metadata-only orphans): #{no_blob}"
      puts "\n  Action: Delete #{blob_dupes} blob duplicates immediately."
      puts "  Action: #{no_blob} metadata-only records have no viewable file."
      puts "          These are ghost records from the CorporateCompanyDocument migration."

      puts "\n" + "=" * 60
    end

    desc "Delete corporate docs that duplicate task/job docs (same blob)"
    task delete_blob_dupes: :environment do
      puts "=" * 60
      puts "Delete Corporate Blob Duplicates"
      puts "=" * 60

      to_delete = []

      WarehouseDocument.where(source_type: "corporate").where.not(storage_blob_id: nil).find_each do |doc|
        other = WarehouseDocument.where(storage_blob_id: doc.storage_blob_id)
                                 .where.not(id: doc.id)
                                 .where.not(source_type: "corporate")
                                 .first
        if other
          to_delete << { id: doc.id, display: doc.display_name.to_s[0..50], real_source: other.source_type, real_id: other.id }
        end
      end

      puts "Found #{to_delete.count} corporate docs that duplicate other sources"
      to_delete.first(10).each do |d|
        puts "  WD##{d[:id]} '#{d[:display]}' → real: #{d[:real_source]} WD##{d[:real_id]}"
      end

      if to_delete.empty?
        puts "Nothing to delete."
      else
        deleted = 0
        errors = []
        to_delete.each do |d|
          begin
            WarehouseDocument.find(d[:id]).destroy!
            deleted += 1
          rescue => e
            errors << "WD##{d[:id]}: #{e.message}"
          end
        end

        puts "\nResults:"
        puts "  Deleted: #{deleted}"
        puts "  Errors: #{errors.count}"
        errors.first(5).each { |e| puts "  #{e}" } if errors.any?
      end

      puts "\n" + "=" * 60
    end

    desc "Delete metadata-only corporate docs (no blob = no file to view)"
    task delete_no_blob: :environment do
      puts "=" * 60
      puts "Delete Corporate Metadata-Only Docs (No Blob)"
      puts "=" * 60

      no_blob = WarehouseDocument.where(source_type: "corporate", storage_blob_id: nil)
      total = no_blob.count
      puts "Found #{total} corporate docs with no storage blob"
      puts "These are ghost records - no actual file to view or download."

      if total == 0
        puts "Nothing to delete."
      else
        puts "\nDeleting #{total} metadata-only records..."
        deleted = no_blob.delete_all
        puts "Deleted: #{deleted}"
      end

      puts "\n" + "=" * 60
    end

    private

    def cleanup_duplicates(dry_run:, source_type: nil)
      results = {
        groups_processed: 0,
        kept: 0,
        to_delete: 0,
        deleted: 0,
        errors: [],
        samples: []
      }

      # Find all content hashes with multiple documents
      # Scope to source_type if provided (matches status check)
      base_query = WarehouseDocument
        .joins(:storage_blob)
        .where.not(storage_blobs: { content_hash: nil })

      base_query = base_query.where(source_type: source_type) if source_type.present?

      duplicate_hashes = base_query
        .group("storage_blobs.content_hash")
        .having("COUNT(*) > 1")
        .pluck("storage_blobs.content_hash")

      puts "Found #{duplicate_hashes.count} content hashes with duplicates"

      duplicate_hashes.each_with_index do |hash, index|
        begin
          docs_query = WarehouseDocument
            .joins(:storage_blob)
            .where(storage_blobs: { content_hash: hash })

          docs_query = docs_query.where(source_type: source_type) if source_type.present?

          docs = docs_query.order(Arel.sql("CASE WHEN warehouse_documents.documentable_id IS NOT NULL THEN 0 ELSE 1 END, warehouse_documents.created_at ASC"))

          # Keep the best one (linked > oldest)
          keep_doc = docs.first
          delete_docs = docs.offset(1)

          keep_reason = keep_doc.documentable_id.present? ? "linked to #{keep_doc.documentable_type}" : "oldest"

          results[:groups_processed] += 1
          results[:kept] += 1
          results[:to_delete] += delete_docs.count

          if results[:samples].count < 20
            results[:samples] << {
              keep_id: keep_doc.id,
              keep_reason: keep_reason,
              delete_ids: delete_docs.pluck(:id)
            }
          end

          unless dry_run
            delete_docs.each do |doc|
              doc.storage_blob&.decrement_reference!
              doc.destroy!
              results[:deleted] ||= 0
              results[:deleted] += 1
            end
          end

          if (index + 1) % 50 == 0
            puts "Progress: #{index + 1}/#{duplicate_hashes.count} groups processed"
          end

        rescue => e
          results[:errors] << "Hash #{hash[0..8]}: #{e.message}"
        end
      end

      results
    end

    def reconcile_corporate_documents(dry_run:)
      results = {
        orphaned: 0,
        linkable_by_metadata: 0,
        linkable_by_folder: 0,
        linked_by_metadata: 0,
        linked_by_folder: 0,
        cannot_link: 0,
        errors: [],
        samples: []
      }

      orphans = WarehouseDocument
        .where(source_type: "corporate")
        .where(documentable_id: nil)

      results[:orphaned] = orphans.count
      puts "Found #{results[:orphaned]} orphaned corporate documents"

      # Build company lookup caches
      companies_by_id = CorporateCompany.all.index_by(&:id)
      companies_by_name = CorporateCompany.all.index_by { |c| c.name&.downcase&.strip }
      companies_by_code = CorporateCompany.all.index_by { |c| c.company_code&.downcase&.strip }

      orphans.find_each.with_index do |doc, index|
        begin
          company = nil
          match_reason = nil

          # Try 1: Match by corporate_company_id in metadata
          if doc.metadata&.dig("corporate_company_id").present?
            company = companies_by_id[doc.metadata["corporate_company_id"].to_i]
            match_reason = "metadata corporate_company_id"
          end

          # Try 2: Match by company_name in metadata
          if company.nil? && doc.metadata&.dig("company_name").present?
            company = companies_by_name[doc.metadata["company_name"].downcase.strip]
            match_reason = "metadata company_name"
          end

          # Try 3: Match by folder path (extract company name from folder)
          if company.nil? && doc.folder.present?
            # Folder format is often "CompanyName/DocType" or similar
            folder_parts = doc.folder.split("/")
            if folder_parts.any?
              folder_parts.each do |part|
                company = companies_by_name[part.downcase.strip]
                break if company
                company = companies_by_code[part.downcase.strip]
                break if company
              end
              match_reason = "folder path" if company
            end
          end

          # Try 4: Match by linkable if already set
          if company.nil? && doc.linkable_type == "CorporateCompany" && doc.linkable_id.present?
            company = companies_by_id[doc.linkable_id]
            match_reason = "existing linkable"
          end

          if company
            if match_reason&.include?("metadata")
              results[:linkable_by_metadata] += 1
            else
              results[:linkable_by_folder] += 1
            end

            if results[:samples].count < 30
              results[:samples] << {
                doc_id: doc.id,
                display_name: doc.display_name,
                link_type: "CorporateCompany",
                link_id: company.id,
                link_name: company.name,
                match_reason: match_reason
              }
            end

            unless dry_run
              doc.update!(
                linkable_type: "CorporateCompany",
                linkable_id: company.id,
                metadata: (doc.metadata || {}).merge(
                  "reconciled_at" => Time.current.iso8601,
                  "reconciled_reason" => match_reason
                )
              )

              if match_reason&.include?("metadata")
                results[:linked_by_metadata] += 1
              else
                results[:linked_by_folder] += 1
              end
            end
          else
            results[:cannot_link] += 1
          end

          if (index + 1) % 500 == 0
            puts "Progress: #{index + 1}/#{results[:orphaned]} processed"
          end

        rescue => e
          results[:errors] << "Doc #{doc.id}: #{e.message}"
        end
      end

      results
    end

    def cleanup_orphans(dry_run:)
      results = {
        found: 0,
        to_delete: 0,
        deleted: 0,
        blobs_decremented: 0,
        errors: [],
        samples: [],
        by_source: {}
      }

      # Find orphaned Xero documents (no documentable link)
      # Note: We include attachments since they may also be orphaned
      orphans = WarehouseDocument
        .where(documentable_id: nil)
        .where(source_type: "xero")

      results[:found] = orphans.count
      results[:to_delete] = orphans.count

      # Count by source
      orphans.group(:source_type).count.each do |source, count|
        results[:by_source][source] = count
      end

      # Collect samples
      orphans.limit(30).each do |doc|
        results[:samples] << {
          id: doc.id,
          source_type: doc.source_type,
          display_name: doc.display_name
        }
      end

      unless dry_run
        orphans.find_each do |doc|
          begin
            if doc.storage_blob.present?
              doc.storage_blob.decrement_reference!
              results[:blobs_decremented] += 1
            end
            doc.destroy!
            results[:deleted] ||= 0
            results[:deleted] += 1

            if results[:deleted] % 100 == 0
              puts "Progress: #{results[:deleted]} deleted"
            end
          rescue => e
            results[:errors] << "Doc #{doc.id}: #{e.message}"
          end
        end
      end

      results
    end
  end
end
