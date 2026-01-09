# frozen_string_literal: true

namespace :po_task do
  desc "Backup PO-Task links before SSoT migration (Option B)"
  task backup: :environment do
    puts "Backing up PO-Task links..."

    backup = PurchaseOrder.where.not(sm_task_id: nil).includes(:sm_task).map do |po|
      task = po.sm_task
      next unless task

      {
        po_id: po.id,
        po_number: po.purchase_order_number,
        job_id: po.job_id,
        task_id: task.id,
        sm_schedule_master_id: task.sm_schedule_master_id, # Template row - STABLE
        task_name: task.name
      }
    end.compact

    filename = "tmp/po_task_backup_#{Time.current.strftime('%Y%m%d_%H%M%S')}.json"
    File.write(filename, JSON.pretty_generate(backup))

    puts "Backed up #{backup.count} PO-Task links to #{filename}"
    puts "Sample: #{backup.first.inspect}" if backup.any?
  end

  desc "Restore PO-Task links after SSoT migration (Option B)"
  task restore: :environment do
    # Find the latest backup file
    backup_files = Dir.glob("tmp/po_task_backup_*.json").sort.reverse
    if backup_files.empty?
      puts "ERROR: No backup files found in tmp/"
      exit 1
    end

    filename = backup_files.first
    puts "Restoring from #{filename}..."

    backup = JSON.parse(File.read(filename))
    restored = 0
    warnings = []

    backup.each do |entry|
      po = PurchaseOrder.find_by(id: entry["po_id"])
      unless po
        warnings << "PO #{entry['po_id']} not found (was: #{entry['po_number']})"
        next
      end

      # Already linked to correct task?
      if po.sm_task_id == entry["task_id"]
        restored += 1
        next
      end

      # Find task by stable identifiers
      task = SmTask.find_by(
        job_id: entry["job_id"],
        sm_schedule_master_id: entry["sm_schedule_master_id"]
      )

      if task
        po.update_column(:sm_task_id, task.id)
        puts "Reconnected PO #{po.id} -> Task #{task.id} (#{task.name})"
        restored += 1
      else
        warnings << "No task found for PO #{entry['po_id']} (was: #{entry['task_name']})"
      end
    end

    puts "\nRestored: #{restored}/#{backup.count}"
    if warnings.any?
      puts "\nWarnings (#{warnings.count}):"
      warnings.each { |w| puts "  - #{w}" }
    end
  end

  desc "Verify PO-Task links match (pre-migration check)"
  task verify: :environment do
    puts "Verifying PO-Task bidirectional links..."

    mismatches = []

    # Check POs with sm_task_id
    PurchaseOrder.where.not(sm_task_id: nil).includes(:sm_task).find_each do |po|
      task = po.sm_task
      next unless task

      # Does the task link back?
      if task.purchase_order_id != po.id
        mismatches << {
          po_id: po.id,
          po_task_link: po.sm_task_id,
          task_po_link: task.purchase_order_id,
          issue: "Task doesn't link back to PO"
        }
      end
    end

    # Check tasks with purchase_order_id
    SmTask.where.not(purchase_order_id: nil).includes(:purchase_order).find_each do |task|
      po = task.purchase_order
      next unless po

      # Does the PO link back?
      if po.sm_task_id != task.id
        mismatches << {
          task_id: task.id,
          task_po_link: task.purchase_order_id,
          po_task_link: po.sm_task_id,
          issue: "PO doesn't link back to task"
        }
      end
    end

    if mismatches.empty?
      puts "All #{PurchaseOrder.where.not(sm_task_id: nil).count} PO-Task links are in sync!"
    else
      puts "Found #{mismatches.count} mismatches:"
      mismatches.each { |m| puts "  #{m.inspect}" }
    end
  end
end
