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

    tree[:root_folders] = tree[:root_folders].to_h

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

    # Set tenant context (required for StorageConfiguration)
    tenant = Tenant.first
    ActsAsTenant.current_tenant = tenant
    puts "Using tenant: #{tenant.name}"
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

  desc "Fix task document linkage - sets linkable_id and corrects folder paths"
  task fix_task_links: :environment do
    puts "🔧 Fixing task document linkage..."
    puts ""

    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        config = StorageConfiguration.instance rescue nil
        next unless config

        puts "Tenant: #{tenant.name}"

        fixed = 0
        orphaned = 0
        errors = 0

        # Find task documents without linkable_id
        WarehouseDocument.where(source_type: "task").where(linkable_id: nil).find_each do |doc|
          begin
            # Get the SmTaskAttachment
            attachment = doc.documentable
            unless attachment.is_a?(SmTaskAttachment)
              orphaned += 1
              next
            end

            # Get the task
            task = attachment.sm_task
            unless task
              orphaned += 1
              puts "  ⚠️  ##{doc.id}: SmTaskAttachment ##{attachment.id} has no task (orphaned)"
              next
            end

            # Determine folder based on category
            folder_type = case attachment.category
                          when "response" then :task_responses
                          else :task_attachments
                          end

            new_folder = config.resolve_virtual_path(folder_type, { TaskId: task.id })

            # Update the document
            doc.update!(
              linkable_type: "SmTask",
              linkable_id: task.id,
              folder: new_folder
            )

            fixed += 1
            puts "  ✅ ##{doc.id}: → Task ##{task.id}, folder: #{new_folder}"
          rescue StandardError => e
            errors += 1
            puts "  ❌ ##{doc.id}: #{e.message}"
          end
        end

        puts "  Fixed: #{fixed}, Orphaned: #{orphaned}, Errors: #{errors}"
        puts ""
      end
    end

    puts "Done!"
  end

  desc "Sync missing warehouse entries for task attachments (creates WarehouseDocument for linked docs)"
  task sync_task_attachments: :environment do
    puts "🔄 Syncing missing warehouse entries for task attachments..."
    puts ""

    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        puts "Tenant: #{tenant.name}"

        created = 0
        skipped = 0
        errors = 0

        # Find SmTaskAttachments without corresponding WarehouseDocument
        SmTaskAttachment.includes(:sm_task, :attachable, :warehouse_document).find_each do |att|
          # Skip if already has warehouse document
          if att.warehouse_document.present?
            skipped += 1
            next
          end

          begin
            task = att.sm_task
            unless task
              puts "  ⚠️  SmTaskAttachment ##{att.id}: No task found"
              errors += 1
              next
            end

            # Get the storage blob from the attachable
            blob = att.storage_blob
            unless blob
              puts "  ⚠️  SmTaskAttachment ##{att.id}: No storage blob"
              errors += 1
              next
            end

            # Compute folder path from StorageConfiguration
            # SSoT: Same logic as SmTaskAttachment#compute_task_folder_path
            # FRC (Jan 2026): No hardcoded fallback - fail fast if config is wrong
            config = StorageConfiguration.instance rescue nil
            unless config
              puts "  ⚠️  SmTaskAttachment ##{att.id}: No StorageConfiguration found"
              errors += 1
              next
            end

            # SSoT: task_attachments and task_responses have FULL paths (Jan 2026 FRC fix)
            folder_type = att.category == "response" ? :task_responses : :task_attachments
            folder = config.resolve_virtual_path(folder_type, {
              TaskId: task.id,
              TaskName: task.name&.parameterize || "task-#{task.id}"
            })

            unless folder.present?
              puts "  ⚠️  SmTaskAttachment ##{att.id}: resolve_virtual_path returned blank for #{folder_type}"
              errors += 1
              next
            end

            # Get display name from attachable
            display_name = case att.attachable_type
                           when "WarehouseDocument"
                             att.attachable&.display_name || att.attachable&.original_filename || "Document"
                           when "SyncedEmail"
                             att.attachable&.subject || "Email"
                           else
                             att.read_attribute(:display_name) || "Attachment"
                           end

            # Get original filename
            filename = case att.attachable_type
                       when "WarehouseDocument"
                         att.attachable&.original_filename || att.attachable&.display_name
                       when "SyncedEmail"
                         "#{att.attachable&.subject || 'Email'}.eml"
                       else
                         nil
                       end

            # Create the warehouse document
            wd = WarehouseDocument.create!(
              documentable: att,
              source_type: "task",
              folder: folder,
              display_name: display_name,
              original_filename: filename,
              storage_blob: blob,
              linkable_type: "SmTask",
              linkable_id: task.id,
              metadata: {
                task_id: task.id,
                task_name: task.name,
                category: att.category,
                attachable_type: att.attachable_type,
                attachable_id: att.attachable_id,
                original_warehouse_document_id: att.attachable_type == "WarehouseDocument" ? att.attachable_id : nil
              }
            )

            created += 1
            puts "  ✅ SmTaskAttachment ##{att.id} → WarehouseDocument ##{wd.id} (#{display_name}) [#{folder}]"
          rescue StandardError => e
            errors += 1
            puts "  ❌ SmTaskAttachment ##{att.id}: #{e.message}"
          end
        end

        puts "  Created: #{created}, Skipped: #{skipped}, Errors: #{errors}"
        puts ""
      end
    end

    puts "Done!"
  end

  desc "Fix orphaned documents - move null folder docs to Orphans/YYYY/MM and cleanup broken task attachments"
  task fix_orphans: :environment do
    puts "🔧 Fixing orphaned documents..."
    puts ""

    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        puts "Tenant: #{tenant.name}"

        # 1. Fix WarehouseDocuments with null/blank folders
        null_folder_docs = WarehouseDocument.where(folder: [nil, ""])
        puts "  Documents with null folder: #{null_folder_docs.count}"

        fixed_folders = 0
        moved_to_orphans = 0

        null_folder_docs.find_each do |doc|
          # Try to compute folder from documentable
          if doc.documentable.present? && doc.documentable.respond_to?(:virtual_folder_path)
            begin
              computed = doc.documentable.virtual_folder_path
              if computed.present?
                doc.update!(folder: computed)
                fixed_folders += 1
                next
              end
            rescue StandardError
              # Fall through to other methods
            end
          end

          # For emails/email_attachments - compute from metadata
          if doc.source_type.in?(%w[email email_attachment])
            mailbox = doc.meta("mailbox")
            received_at = doc.meta("received_at")&.then { |t| Time.parse(t) rescue nil }
            date = received_at || doc.created_at || Time.current

            if mailbox.present?
              subfolder = doc.source_type == "email" ? "Email Body" : "Attachments"
              computed = "Emails/#{mailbox}/#{subfolder}/#{date.year}/#{format('%02d', date.month)}"
              doc.update!(folder: computed)
              fixed_folders += 1
              next
            end
          end

          # Move to Orphans/YYYY/MM based on created_at
          date = doc.created_at || Time.current
          orphan_folder = "Orphans/#{date.year}/#{format('%02d', date.month)}"
          doc.update!(folder: orphan_folder)
          moved_to_orphans += 1
        end

        puts "    Fixed with computed folder: #{fixed_folders}"
        puts "    Moved to Orphans: #{moved_to_orphans}"

        # 2. Clean up SmTaskAttachments pointing to deleted records
        broken_attachments = 0
        SmTaskAttachment.find_each do |att|
          if att.attachable.nil?
            att.destroy
            broken_attachments += 1
          end
        end
        puts "    Deleted broken task attachments: #{broken_attachments}"

        puts ""
      end
    end

    puts "Done!"
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

  # ============================================================================
  # WAREHOUSE FOLDER AUTO-SEEDING
  # SSoT: Reads from warehouse_types table (not hardcoded)
  # Creates a root-level WarehouseFolder for any WarehouseType that lacks one
  # ============================================================================

  desc "Ensure each enabled WarehouseType has at least one root WarehouseFolder"
  task ensure_folders: :environment do
    created_count = 0
    skipped_count = 0

    WarehouseType.enabled.find_each do |wt|
      if wt.warehouse_folders.exists?
        skipped_count += 1
      else
        WarehouseFolder.create!(
          warehouse_type: wt,
          name: wt.display_name,
          display_name: wt.display_name,
          folder_segment: wt.display_name,
          order_position: 0,
          enabled: true,
          is_system: wt.is_system,
          warehouse_enabled: true
        )
        puts "  Created root folder for #{wt.code} (#{wt.display_name})"
        created_count += 1
      end
    end

    puts "Warehouse folders: #{created_count} created, #{skipped_count} already exist"
  end

  desc "List all warehouse_folder entries with their paths"
  task list_folders: :environment do
    puts "\nWarehouse Folders:"
    puts "-" * 100

    WarehouseFolder.enabled.ordered
                   .includes(:warehouse_type)
                   .each do |wf|
      type_code = wf.warehouse_type&.code || "unknown"
      puts "#{type_code.ljust(20)} | #{wf.full_folder_path}"
    end
  end
end
