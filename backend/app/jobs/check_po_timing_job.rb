class CheckPoTimingJob < ApplicationJob
  queue_as :default

  # Check PO timing issues for a specific job (construction)
  # @param job_id [Integer] The job to check
  def perform(job_id)
    job = Job.find(job_id)

    # NEW: Use SmTask (SSoT) instead of ProjectTask
    # SmTask is directly associated with Job via construction_id
    tasks = job.sm_tasks.includes(:purchase_order).where.not(purchase_order_id: nil)

    # Find tasks with late materials
    late_tasks = tasks.select { |task| task.materials_status == "delayed" }

    # Log warnings if any found
    if late_tasks.any?
      Rails.logger.warn("[PO Timing] Found #{late_tasks.count} tasks with delayed materials for #{job.title}")

      late_tasks.each do |task|
        po = task.purchase_order
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
        {
          task_id: task.id,
          task_name: task.name,
          po_number: task.purchase_order.purchase_order_number,
          days_late: (task.purchase_order.required_date - task.start_date).to_i
        }
      end
    }
  end
end
