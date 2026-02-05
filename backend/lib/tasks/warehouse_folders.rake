# frozen_string_literal: true

namespace :warehouse do
  namespace :folders do
    # ═══════════════════════════════════════════════════════════════════════════
    # BACKFILL FOLDER_PATH ON WAREHOUSE_FOLDERS TABLE (Feb 2026)
    # ═══════════════════════════════════════════════════════════════════════════
    # The folder_path column stores the complete path template for each folder.
    # This ensures all warehouse-enabled folders have a path like:
    #   "Corporate/{{CompanyGroup}}/{{CompanyCode}}/Xero/Bank/Statement"
    # ═══════════════════════════════════════════════════════════════════════════

    desc "Backfill folder_path for all warehouse-enabled WarehouseFolder records"
    task backfill_folder_paths: :environment do
      puts "=" * 60
      puts "Backfilling folder_path for WarehouseFolder records..."
      puts "=" * 60

      updated_count = 0
      skipped_count = 0
      error_count = 0

      # Get all warehouse_types that exist
      warehouse_types = WarehouseFolder.distinct.pluck(:warehouse_type)

      warehouse_types.each do |warehouse_type|
        puts "\n[#{warehouse_type}]"

        # Process in order: root folders first (they need folder_path for children to inherit)
        process_folders_by_depth(warehouse_type, nil, 0) do |folder, depth|
          indent = "  " * (depth + 1)

          if folder.folder_path.present?
            skipped_count += 1
            next
          end

          # Reload parent to get latest folder_path
          folder.parent&.reload if folder.parent_id.present?

          if folder.save
            updated_count += 1
            puts "#{indent}+ #{folder.display_name} -> #{folder.folder_path}"
          else
            error_count += 1
            puts "#{indent}! #{folder.display_name} - FAILED: #{folder.errors.full_messages.join(', ')}"
          end
        end
      end

      puts "\n" + "=" * 60
      puts "Backfill complete!"
      puts "  Updated: #{updated_count}"
      puts "  Skipped (already had path): #{skipped_count}"
      puts "  Errors: #{error_count}"
      puts "=" * 60
    end

    desc "Show all WarehouseFolder records missing folder_path"
    task missing_folder_paths: :environment do
      puts "WarehouseFolder records WITHOUT folder_path:"
      puts "=" * 60

      folders = WarehouseFolder.where(warehouse_enabled: true)
                               .where("folder_path IS NULL OR folder_path = ''")
                               .includes(:parent)
                               .order(:warehouse_type, :parent_id, :order_position)

      if folders.empty?
        puts "All warehouse-enabled folders have folder_path set!"
      else
        current_type = nil
        folders.each do |folder|
          if folder.warehouse_type != current_type
            current_type = folder.warehouse_type
            puts "\n#{current_type.upcase}:"
          end

          parent_name = folder.parent&.display_name || "(root)"
          puts "  - #{folder.display_name} [parent: #{parent_name}] (id: #{folder.id})"
        end

        puts "\n" + "=" * 60
        puts "Total: #{folders.count} folders missing folder_path"
        puts "Run 'rails warehouse:folders:backfill_folder_paths' to fix"
      end
    end

    # Helper to process folders depth-first (roots first, then children)
    def process_folders_by_depth(warehouse_type, parent_id, depth, &block)
      folders = WarehouseFolder.where(
        warehouse_type: warehouse_type,
        parent_id: parent_id,
        warehouse_enabled: true
      ).order(:order_position)

      folders.find_each do |folder|
        yield(folder, depth) if block_given?

        # Recursively process children
        process_folders_by_depth(warehouse_type, folder.id, depth + 1, &block)
      end
    end

    # ═══════════════════════════════════════════════════════════════════════════
    # LEGACY: RECOMPUTE WAREHOUSE_DOCUMENT FOLDER PATHS
    # ═══════════════════════════════════════════════════════════════════════════

    desc "Recompute all folder paths from StorageConfiguration templates"
    task recompute_all: :environment do
      puts "Recomputing all WarehouseDocument folder paths from templates..."

      Tenant.find_each do |tenant|
        ActsAsTenant.with_tenant(tenant) do
          recompute_folders_for_tenant(tenant)
        end
      end

      puts "Done!"
    end

    desc "Recompute folder paths for specific source_type (e.g., task, email)"
    task :recompute, [:source_type] => :environment do |_, args|
      source_type = args[:source_type]
      unless source_type.present?
        puts "Usage: rails warehouse:folders:recompute[task]"
        exit 1
      end

      puts "Recomputing folders for source_type: #{source_type}..."

      Tenant.find_each do |tenant|
        ActsAsTenant.with_tenant(tenant) do
          recompute_folders_for_source_type(tenant, source_type)
        end
      end

      puts "Done!"
    end

    desc "Show current folder distribution (dry run)"
    task audit: :environment do
      puts "Folder Distribution Audit"
      puts "=" * 60

      Tenant.find_each do |tenant|
        ActsAsTenant.with_tenant(tenant) do
          puts "\nTenant: #{tenant.name}"
          puts "-" * 40

          # Group by source_type and show folder patterns
          WarehouseDocument.group(:source_type).count.each do |source_type, count|
            puts "\n  #{source_type}: #{count} documents"

            # Show top 5 folder patterns for this source_type
            folders = WarehouseDocument
              .where(source_type: source_type)
              .group(:folder)
              .order(Arel.sql("COUNT(*) DESC"))
              .limit(5)
              .count

            folders.each do |folder, folder_count|
              puts "    - #{folder || '(nil)'}: #{folder_count}"
            end
          end
        end
      end
    end

    def recompute_folders_for_tenant(tenant)
      config = StorageConfiguration.instance rescue nil
      return puts "  No StorageConfiguration for tenant #{tenant.name}" unless config

      updated = 0
      errors = 0

      WarehouseDocument.find_each do |doc|
        new_folder = compute_folder(config, doc)
        next if new_folder.blank? || doc.folder == new_folder

        if doc.update_column(:folder, new_folder)
          updated += 1
        end
      rescue StandardError => e
        errors += 1
      end

      puts "  Tenant #{tenant.name}: Updated #{updated} documents (#{errors} errors)"
    end

    def recompute_folders_for_source_type(tenant, source_type)
      config = StorageConfiguration.instance rescue nil
      return puts "  No StorageConfiguration for tenant #{tenant.name}" unless config

      updated = 0
      errors = 0

      WarehouseDocument.where(source_type: source_type).find_each do |doc|
        new_folder = compute_folder(config, doc)
        next if new_folder.blank? || doc.folder == new_folder

        old_folder = doc.folder
        if doc.update_column(:folder, new_folder)
          updated += 1
          puts "    #{doc.id}: '#{old_folder}' → '#{new_folder}'" if updated <= 10
        end
      rescue StandardError => e
        errors += 1
      end

      puts "  Tenant #{tenant.name}: Updated #{updated} documents (#{errors} errors)"
      puts "    (showing first 10 changes)" if updated > 10
    end

    def compute_folder(config, doc)
      warehouse_type = case doc.source_type
                       when "task" then :task_attachments
                       when "email" then :email
                       when "email_attachment" then :email_attachments
                       when "corporate" then :corporate
                       when "job" then :job
                       when "contact" then :contact
                       when "xero" then :bank_statement
                       when "case" then :case
                       else doc.source_type.to_sym
                       end

      tokens = extract_tokens(doc)
      config.resolve_virtual_path(warehouse_type, tokens)
    end

    def extract_tokens(doc)
      tokens = {}
      documentable = doc.documentable

      # Task context - handle both SmTask and SmTaskAttachment
      if doc.source_type == "task" && documentable.present?
        if documentable.is_a?(SmTask)
          tokens[:TaskId] = documentable.id
        elsif documentable.respond_to?(:sm_task) && documentable.sm_task
          # SmTaskAttachment - get the task via association
          tokens[:TaskId] = documentable.sm_task.id
        end
      end

      # Job context
      if documentable.respond_to?(:job) && documentable.job
        tokens[:JobCode] = documentable.job.job_code
      elsif documentable.respond_to?(:job_code)
        tokens[:JobCode] = documentable.job_code
      end

      # Contact context
      if documentable.respond_to?(:contact) && documentable.contact
        tokens[:ContactName] = documentable.contact.display_name.presence || "Contact-#{documentable.contact.id}"
      end

      # Corporate company context
      if documentable.respond_to?(:corporate_company) && documentable.corporate
        cc = documentable.corporate
        tokens[:CompanyCode] = cc.company_code
        tokens[:CompanyGroup] = cc.company_group&.name.presence || "Default"
      end

      # Case context
      if documentable.respond_to?(:case_number)
        tokens[:CaseId] = documentable.case_number
      end

      # Email context
      if doc.source_type.in?(%w[email email_attachment])
        tokens[:Mailbox] = doc.meta("mailbox") || "Unknown"
        received_at = doc.email_received_at || doc.created_at || Time.current
        tokens[:Year] = received_at.year.to_s
        tokens[:Month] = received_at.strftime("%m")
      end

      # Date tokens
      date = doc.created_at || Time.current
      tokens[:Year] ||= date.year.to_s
      tokens[:Month] ||= date.strftime("%m")

      tokens
    end
  end
end
