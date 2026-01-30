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

  desc "Run all production fixes"
  task all: [:fix_jobs_linkable, :fix_orphaned_attachments] do
    puts ""
    puts "All production fixes complete!"
  end
end
