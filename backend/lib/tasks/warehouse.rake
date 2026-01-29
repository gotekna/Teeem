namespace :warehouse do
  desc "Show warehouse status"
  task status: :environment do
    puts "=== DATA WAREHOUSE STATUS ==="
    puts ""
    puts "📊 MATERIALIZED VIEWS:"
    views = {
      "mv_job_summary" => MvJobSummary,
      "mv_document_summary" => MvDocumentSummary,
      "mv_document_completeness" => MvDocumentCompleteness,
      "mv_invoice_po_reconciliation" => MvInvoicePoReconciliation,
      "mv_resource_utilization" => MvResourceUtilization,
      "mv_job_document_status" => MvJobDocumentStatus,
      "mv_task_metrics" => MvTaskMetrics
    }
    views.each do |name, model|
      count = model.count rescue 0
      puts "  #{name}: #{count} rows"
    end

    puts ""
    puts "📈 HISTORICAL SNAPSHOTS:"
    puts "  fact_job_daily_snapshots: #{FactJobDailySnapshot.count} rows"
    puts "  Latest snapshot: #{FactJobDailySnapshot.maximum(:snapshot_date)}"

    puts ""
    puts "📎 DOCUMENT LINKS:"
    puts "  Total documents: #{CompanyDocument.count}"
    puts "  Linked to PurchaseOrders: #{CompanyDocument.where(documentable_type: 'PurchaseOrder').count}"
    puts "  Linked to ExternalInvoices: #{CompanyDocument.where(documentable_type: 'ExternalInvoice').count}"
    puts "  Linked to Jobs: #{CompanyDocument.where(documentable_type: 'Job').count}"
    puts "  Unlinked: #{CompanyDocument.where(documentable_type: nil).count}"
  end

  desc "Refresh all materialized views"
  task refresh: :environment do
    puts "Refreshing materialized views..."
    result = RefreshMaterializedViewsJob.new.perform
    result.each do |view, status|
      emoji = status[:success] ? "✅" : "❌"
      puts "  #{emoji} #{view}: #{status[:duration_ms] || status[:error]}ms"
    end
    puts "Done!"
  end

  desc "Capture daily job snapshots"
  task snapshot: :environment do
    puts "Capturing daily snapshots..."
    result = DailyJobSnapshotJob.new.perform
    puts "  Captured: #{result[:captured]}"
    puts "  Skipped: #{result[:skipped]}"
    puts "  Errors: #{result[:errors].count}"
    puts "Done!"
  end

  desc "Link existing documents to their parent entities (Jobs, POs, Invoices)"
  task link_documents: :environment do
    puts "Linking documents to parent entities..."
    result = WarehouseDataLinkerService.new.link_all!
    puts "  Invoices linked: #{result[:invoices_linked]}"
    puts "  POs linked: #{result[:pos_linked]}"
    puts "  Jobs linked: #{result[:jobs_linked]}"
    puts "  Errors: #{result[:errors].count}"
    puts "Done!"
  end

  desc "Sync Xero invoice attachments (downloads PDFs)"
  task sync_xero_attachments: :environment do
    limit = ENV["LIMIT"]&.to_i || 50
    puts "Syncing Xero attachments (limit: #{limit})..."
    result = XeroAttachmentSyncJob.new.perform(nil, limit: limit)
    puts "  Processed: #{result[:processed]}"
    puts "  Success: #{result[:success]}"
    puts "  Failed: #{result[:failed]}"
    puts "Done!"
  end

  desc "Run batch document verification (AI classification)"
  task verify_documents: :environment do
    limit = ENV["LIMIT"]&.to_i || 100
    puts "Running batch document verification (limit: #{limit})..."
    result = BatchDocumentVerificationJob.new.perform(limit: limit)
    puts "  Processed: #{result[:processed]}"
    puts "  Success: #{result[:success]}"
    puts "  Failed: #{result[:failed]}"
    puts "  Skipped: #{result[:skipped]}"
    puts "Done!"
  end

  desc "Pre-warm the File Warehouse folder tree cache (takes ~90 seconds)"
  task warmup_cache: :environment do
    puts "Building warehouse folder tree cache..."
    total = WarehouseDocument.count
    puts "Total documents: #{total}"

    start_time = Time.current
    tree = { root_folders: Hash.new(0), paths: {} }
    processed = 0

    WarehouseDocument.includes(:documentable).find_each(batch_size: 1000) do |doc|
      computed_path = doc.computed_folder_path rescue nil
      next if computed_path.blank?

      tree[:paths][doc.id] = computed_path

      root = computed_path.split("/").first
      tree[:root_folders][root] += 1

      processed += 1
      if processed % 10000 == 0
        elapsed = Time.current - start_time
        rate = processed / elapsed
        remaining = ((total - processed) / rate).round
        puts "  Processed #{processed}/#{total} (#{(processed * 100.0 / total).round}%) - ~#{remaining}s remaining"
      end
    end

    # Convert to regular hash for caching
    tree[:root_folders] = tree[:root_folders].to_h

    # Cache for 1 hour
    Rails.cache.write("warehouse_folder_tree_v2", tree, expires_in: 1.hour)

    elapsed = (Time.current - start_time).round
    puts ""
    puts "Done in #{elapsed} seconds!"
    puts "Root folders:"
    tree[:root_folders].each do |name, count|
      puts "  #{name}: #{count} documents"
    end
  end

  desc "Clear the File Warehouse folder tree cache"
  task clear_folder_cache: :environment do
    Rails.cache.delete("warehouse_folder_tree_v2")
    puts "Warehouse folder tree cache cleared"
  end

  desc "Sync user-created documents (Excel, Word, PDF, PPT) to File Warehouse"
  task sync_teeem_docs: :environment do
    puts "🔄 Syncing Teeem documents to File Warehouse..."
    puts ""

    total = 0
    success = 0
    failed = 0

    [TeeemSpreadsheet, TeeemDocument, TeeemPresentation, TeeemPdf].each do |model|
      count = model.count
      next if count.zero?

      puts "#{model.name}: #{count} documents"

      model.find_each do |doc|
        total += 1
        begin
          result = doc.sync_to_warehouse!
          if result[:success]
            success += 1
            puts "  ✅ #{doc.name} (#{doc.id})"
          else
            failed += 1
            puts "  ❌ #{doc.name} (#{doc.id}): #{result[:error]}"
          end
        rescue StandardError => e
          failed += 1
          puts "  ❌ #{doc.name} (#{doc.id}): #{e.message}"
        end
      end
      puts ""
    end

    puts "Total: #{total}, Success: #{success}, Failed: #{failed}"
    puts ""
    puts "WarehouseDocument by source_type:"
    WarehouseDocument.group(:source_type).count.each { |k, v| puts "  #{k}: #{v}" }
  end

  desc "Full warehouse setup: link docs, sync attachments, refresh views, capture snapshot"
  task setup: :environment do
    puts "🚀 Running full warehouse setup..."
    puts ""

    # Step 1: Link existing documents
    puts "Step 1: Linking documents..."
    Rake::Task["warehouse:link_documents"].invoke
    puts ""

    # Step 2: Sync Xero attachments (if connected)
    if XeroCredential.current.present?
      puts "Step 2: Syncing Xero attachments..."
      Rake::Task["warehouse:sync_xero_attachments"].invoke
      puts ""
    else
      puts "Step 2: Skipped (no Xero connection)"
      puts ""
    end

    # Step 3: Refresh materialized views
    puts "Step 3: Refreshing views..."
    Rake::Task["warehouse:refresh"].invoke
    puts ""

    # Step 4: Capture daily snapshot
    puts "Step 4: Capturing snapshot..."
    Rake::Task["warehouse:snapshot"].invoke
    puts ""

    puts "✅ Warehouse setup complete!"
  end
end
