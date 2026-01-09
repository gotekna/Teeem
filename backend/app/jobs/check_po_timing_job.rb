class CheckPoTimingJob < ApplicationJob
  queue_as :default

  # Check PO timing issues for a specific job (construction)
  # @param job_id [Integer] The job to check
  def perform(job_id)
    job = Job.find(job_id)

    # SSoT: Find tasks with linked POs via PurchaseOrder.sm_task_id (Option B)
    # Get all task IDs that have a PO pointing to them
    task_ids_with_po = PurchaseOrder.where(job_id: job_id)
                                     .where.not(sm_task_id: nil)
                                     .pluck(:sm_task_id)

    tasks = job.sm_tasks.where(id: task_ids_with_po)

    # Find tasks with late materials
    late_tasks = tasks.select { |task| task.materials_status == "delayed" }

    # Log warnings if any found
    if late_tasks.any?
      Rails.logger.warn("[PO Timing] Found #{late_tasks.count} tasks with delayed materials for #{job.title}")

      late_tasks.each do |task|
        po = task.linked_purchase_order
        next unless po
        days_late = (po.required_date - task.start_date).to_i

        Rails.logger.warn(
          "[PO Timing] Task '#{task.name}' (ID: #{task.id}): " \
          "PO #{po.purchase_order_number} delivers #{days_late} days after task start. " \
          "PO delivery: #{po.required_date}, Task start: #{task.start_date}"
        )
      end

      # TODO: Send notification/email to project manager
      # Example:
      # ProjectMailer.materials_timing_alert(job, late_tasks).deliver_later
    else
      Rails.logger.info("[PO Timing] All materials timing validated for #{job.title}")
    end

    # Return summary
    {
      job_id: job.id,
      job_title: job.title,
      total_tasks: job.sm_tasks.count,
      tasks_with_pos: tasks.count,
      late_tasks_count: late_tasks.count,
      late_tasks: late_tasks.map do |task|
        po = task.linked_purchase_order
        {
          task_id: task.id,
          task_name: task.name,
          po_number: po&.purchase_order_number,
          days_late: po && task.start_date ? (po.required_date - task.start_date).to_i : 0
        }
      end
    }
  end
end
