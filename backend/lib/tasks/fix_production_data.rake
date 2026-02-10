# One-time data fix tasks for production
namespace :fix do
  desc "Fix Jobs WarehouseDocuments linkable"
  task fix_jobs_linkable: :environment do
    ActsAsTenant.current_tenant = Tenant.find(2)

    # Get all Jobs documents without linkable
    jobs_docs = WarehouseDocument.where(source_type: "job", linkable_type: nil)
    puts "Jobs documents without linkable: #{jobs_docs.count}"

    # Get all jobs for lookup
    all_jobs = Job.all.index_by(&:job_code)
    puts "Total jobs in database: #{all_jobs.count}"

    fixed = 0
    not_found = 0

    jobs_docs.find_each do |doc|
      # Extract job code from folder path (e.g., "Jobs/464 Chelsea Road Ransome 4154 QLD/Plans")
      folder_parts = doc.folder.to_s.split("/")
      job_folder_name = folder_parts[1] # Second segment after "Jobs/"

      unless job_folder_name.present?
        puts "  Skip WD##{doc.id}: Can't parse job from folder: #{doc.folder}"
        not_found += 1
        next
      end

      # Try to find the job by job_code matching the folder name
      job = all_jobs[job_folder_name]

      # If not found by exact match, try finding by partial match
      job ||= Job.find_by("job_code LIKE ?", "%#{job_folder_name}%")

      # Try to find by address/name in folder
      job ||= Job.where("job_code LIKE ? OR name LIKE ?",
        "%#{job_folder_name.split.first(3).join(' ')}%",
        "%#{job_folder_name.split.first(3).join(' ')}%"
      ).first

      if job
        doc.update_columns(linkable_type: "Job", linkable_id: job.id)
        puts "  Fixed WD##{doc.id}: Linked to Job##{job.id} (#{job.job_code})"
        fixed += 1
      else
        puts "  Skip WD##{doc.id}: No job found for folder: #{job_folder_name}"
        not_found += 1
      end
    end

    puts ""
    puts "=" * 60
    puts "Fixed: #{fixed}"
    puts "Not found: #{not_found}"
  end

  desc "Fix orphaned SmTaskAttachments"
  task fix_orphaned_attachments: :environment do
    ActsAsTenant.current_tenant = Tenant.find(2)

    # Get all WarehouseDocuments that reference SmTaskAttachment as documentable
    all_task_wds = WarehouseDocument
      .where(documentable_type: "SmTaskAttachment")
      .where(linkable_type: "SmTask")

    puts "Total WarehouseDocuments linked to SmTaskAttachments: #{all_task_wds.count}"

    # Find orphaned ones (where the SmTaskAttachment no longer exists)
    orphaned = all_task_wds.select { |wd| SmTaskAttachment.unscoped.where(id: wd.documentable_id).empty? }

    puts "Orphaned WarehouseDocuments (SmTaskAttachment deleted): #{orphaned.count}"

    return if orphaned.empty?

    # Group by task
    by_task = orphaned.group_by { |wd| wd.linkable_id }
    puts "Tasks with orphaned attachments: #{by_task.count}"

    total_created = 0
    total_errors = 0

    by_task.each do |task_id, docs|
      task = SmTask.find_by(id: task_id)
      unless task
        puts "  Task ##{task_id} not found - skipping #{docs.count} orphaned WDs"
        docs.each(&:destroy)
        next
      end

      puts ""
      puts "=" * 60
      puts "Task ##{task_id}: #{task.name}"
      puts "  Orphaned WDs: #{docs.count}"

      docs.each do |wd|
        attachable_type = wd.metadata&.dig('attachable_type')
        attachable_id = wd.metadata&.dig('attachable_id')
        category = wd.metadata&.dig('category') || 'info'

        unless attachable_type && attachable_id
          puts "  WD##{wd.id}: No attachable info in metadata - deleting orphan"
          wd.destroy
          next
        end

        # Check if original attachable exists
        attachable_exists = begin
          attachable_type.constantize.exists?(attachable_id)
        rescue
          false
        end

        unless attachable_exists
          puts "  WD##{wd.id}: #{attachable_type}##{attachable_id} not found - deleting orphan"
          wd.destroy
          next
        end

        # Check if attachment already exists
        existing = SmTaskAttachment.unscoped.find_by(
          sm_task_id: task.id,
          attachable_type: attachable_type,
          attachable_id: attachable_id
        )

        if existing
          puts "  #{attachable_type}##{attachable_id} already exists as SmTaskAttachment##{existing.id}"
          # Delete the orphaned WD since we have a new one
          wd.destroy
          next
        end

        begin
          # Create new SmTaskAttachment
          attachment = SmTaskAttachment.create!(
            sm_task_id: task.id,
            attachable_type: attachable_type,
            attachable_id: attachable_id,
            category: category,
            attachment_type: attachable_type == 'SyncedEmail' ? 'email' : 'document'
          )

          # Delete the orphaned WD (new one created by callback)
          wd.destroy

          puts "  Created SmTaskAttachment##{attachment.id} for #{attachable_type}##{attachable_id}"
          total_created += 1
        rescue => e
          puts "  Error: #{e.message}"
          total_errors += 1
        end
      end
    end

    puts ""
    puts "=" * 60
    puts "COMPLETE"
    puts "=" * 60
    puts "Created: #{total_created} SmTaskAttachments"
    puts "Errors: #{total_errors}"
  end

  desc "Backfill missing warehouse_documents for SmTaskAttachments"
  task backfill_task_attachments: :environment do
    ActsAsTenant.current_tenant = Tenant.find(2)

    # Find SmTaskAttachments without warehouse_document
    missing = SmTaskAttachment.unscoped
      .left_joins(:warehouse_document)
      .where(warehouse_documents: { id: nil })

    puts "SmTaskAttachments without warehouse_document: #{missing.count}"

    created = 0
    errors = 0
    skipped = 0

    missing.find_each do |attachment|
      task = attachment.sm_task
      unless task
        puts "  Skip ##{attachment.id}: No sm_task found"
        skipped += 1
        next
      end

      # Get storage blob from attachable
      blob = if attachment.attachable.respond_to?(:storage_blob) && attachment.attachable.storage_blob
               attachment.attachable.storage_blob
             elsif attachment.attachable&.warehouse_document&.storage_blob
               attachment.attachable.warehouse_document.storage_blob
             end

      unless blob
        puts "  Skip ##{attachment.id}: No storage_blob"
        skipped += 1
        next
      end

      # Create warehouse document
      begin
        folder = attachment.virtual_folder_path rescue "Tasks/Unknown"

        name = case attachment.attachable_type
               when "WarehouseDocument"
                 attachment.attachable&.display_name || attachment.attachable&.original_filename || "Document"
               when "SyncedEmail"
                 attachment.attachable&.subject || "Email"
               else
                 "Attachment"
               end

        attachment.create_warehouse_document!(
          tenant_id: task.tenant_id,
          source_type: "task",
          folder: folder,
          display_name: name,
          original_filename: blob.original_filename,
          storage_blob: blob,
          linkable_type: "SmTask",
          linkable_id: task.id,
          metadata: {
            task_id: task.id,
            task_name: task.name,
            category: attachment.category,
            attachable_type: attachment.attachable_type,
            attachable_id: attachment.attachable_id
          }
        )

        puts "  Created WD for SmTaskAttachment##{attachment.id}"
        created += 1
      rescue => e
        puts "  Error ##{attachment.id}: #{e.message}"
        errors += 1
      end
    end

    puts ""
    puts "=" * 60
    puts "Created: #{created} WarehouseDocuments"
    puts "Skipped: #{skipped}"
    puts "Errors: #{errors}"
  end

  desc "Audit and fix unassigned warehouse_type documents"
  task fix_unassigned_warehouse_type: :environment do
    ActsAsTenant.current_tenant = Tenant.find(2)

    unassigned = WarehouseDocument.where(warehouse_type: "unassigned")
    total = unassigned.count
    puts "=" * 70
    puts "UNASSIGNED WAREHOUSE DOCUMENTS: #{total}"
    puts "=" * 70

    if total == 0
      puts "No unassigned documents found. Nothing to fix."
      next
    end

    # ── AUDIT ──────────────────────────────────────────────────
    puts ""
    puts "── AUDIT ──────────────────────────────────────────────"

    puts ""
    puts "By source_type:"
    unassigned.group(:source_type).count.sort_by { |_, v| -v }.each do |st, count|
      puts "  #{st.inspect}: #{count}"
    end

    puts ""
    puts "By documentable_type:"
    unassigned.group(:documentable_type).count.sort_by { |_, v| -v }.each do |dt, count|
      puts "  #{dt.inspect}: #{count}"
    end

    puts ""
    puts "By linkable_type:"
    unassigned.group(:linkable_type).count.sort_by { |_, v| -v }.each do |lt, count|
      puts "  #{lt.inspect}: #{count}"
    end

    puts ""
    puts "By folder_path (top 20):"
    unassigned.group(:folder_path).count.sort_by { |_, v| -v }.first(20).each do |fp, count|
      puts "  #{fp.inspect}: #{count}"
    end

    puts ""
    puts "Sample records (first 10):"
    unassigned.limit(10).each do |doc|
      puts "  WD##{doc.id}: ui_name=#{doc.ui_name.inspect}, source_type=#{doc.source_type.inspect}, " \
           "documentable=#{doc.documentable_type}##{doc.documentable_id}, " \
           "linkable=#{doc.linkable_type}##{doc.linkable_id}, " \
           "folder_path=#{doc.folder_path.inspect}"
    end

    # ── DRY RUN ────────────────────────────────────────────────
    # Determine the correct source_type for each unassigned record
    puts ""
    puts "── CLASSIFICATION ─────────────────────────────────────"

    classifications = { fix: [], skip: [] }

    unassigned.find_each do |doc|
      new_source_type = infer_source_type(doc)

      if new_source_type
        classifications[:fix] << { id: doc.id, old: doc.source_type, new: new_source_type }
      else
        classifications[:skip] << { id: doc.id, source_type: doc.source_type, documentable_type: doc.documentable_type }
      end
    end

    fixable = classifications[:fix]
    skipped = classifications[:skip]

    puts "Fixable: #{fixable.count}"
    fixable.group_by { |r| "#{r[:old].inspect} → #{r[:new]}" }.sort_by { |_, v| -v.count }.each do |label, records|
      puts "  #{label}: #{records.count}"
    end

    puts "Skipped (no inference possible): #{skipped.count}"
    skipped.first(5).each do |r|
      puts "  WD##{r[:id]}: source_type=#{r[:source_type].inspect}, documentable=#{r[:documentable_type].inspect}"
    end

    if fixable.empty?
      puts ""
      puts "Nothing to fix."
      next
    end

    # ── APPLY FIX ──────────────────────────────────────────────
    puts ""
    puts "── APPLYING FIX ─────────────────────────────────────"

    # Warehouse type mapping (same as derive_warehouse_type)
    wt_map = {
      "task" => "task",
      "email" => "email", "email_attachment" => "email",
      "corporate" => "corporate", "xero" => "corporate", "financial" => "corporate", "asset" => "corporate",
      "job" => "job", "compliance" => "job",
      "contact" => "contact", "people" => "contact",
      "case" => "case",
      "notebook" => "notebook",
      "user" => "user",
      "warehouse" => "warehouse", "template" => "warehouse",
      "esignature" => "e_signing"
    }

    fixed = 0
    errors = 0

    fixable.each do |record|
      new_wt = wt_map[record[:new]] || "unassigned"
      begin
        WarehouseDocument.where(id: record[:id]).update_all(
          source_type: record[:new],
          warehouse_type: new_wt
        )
        fixed += 1
      rescue => e
        puts "  Error WD##{record[:id]}: #{e.message}"
        errors += 1
      end
    end

    puts ""
    puts "=" * 70
    puts "COMPLETE"
    puts "=" * 70
    puts "Fixed: #{fixed}"
    puts "Errors: #{errors}"
    puts "Skipped: #{skipped.count}"
    puts ""

    # Verify
    remaining = WarehouseDocument.where(warehouse_type: "unassigned").count
    puts "Remaining unassigned: #{remaining}"
  end

  desc "Run all production fixes"
  task all: [:fix_jobs_linkable, :fix_orphaned_attachments, :backfill_task_attachments] do
    puts ""
    puts "All production fixes complete!"
  end
end

# Infer the correct source_type for an unassigned WarehouseDocument
def infer_source_type(doc)
  # 1. From linkable_type (most precise)
  case doc.linkable_type
  when "Job" then return "job"
  when "Contact" then return "contact"
  when "CorporateCompany" then return "corporate"
  when "SmTask" then return "task"
  end

  # 2. From documentable_type
  case doc.documentable_type
  when "SyncedEmail" then return "email_attachment"
  when "EmailWarehouse" then return "email"
  when "JobDocument" then return "job"
  when "SmTaskAttachment" then return "task"
  when "CorporateDocument" then return "corporate"
  when "ContactDocument" then return "contact"
  when "XeroInvoice", "XeroBankTransaction" then return "xero"
  end

  # 3. From folder_path
  fp = doc.folder_path.to_s.downcase
  if fp.start_with?("email")
    return "email_attachment"
  elsif fp.start_with?("job")
    return "job"
  elsif fp.start_with?("contact")
    return "contact"
  elsif fp.start_with?("task")
    return "task"
  elsif fp.start_with?("corporate")
    return "corporate"
  end

  # 4. From existing source_type if present but not in mapping
  return doc.source_type if doc.source_type.present?

  # Can't determine
  nil
end
