class CheckPoTimingJob < ApplicationJob
  queue_as :default

  # Check PO timing issues for a specific construction
  # @param construction_id [Integer] The construction to check
  def perform(construction_id)
    construction = Construction.find(construction_id)
    project = construction.project

    unless project
      Rails.logger.info("No project found for construction #{construction.title}")
      return {
        construction_id: construction.id,
        construction_title: construction.title,
        status: "no_project",
        message: "Construction does not have an associated project"
      }
    end

    # Find tasks with late materials
    late_tasks = project.project_tasks.select { |task| task.materials_status == "delayed" }

    # Log warnings if any found
    if late_tasks.any?
      Rails.logger.warn("Found #{late_tasks.count} tasks with delayed materials for #{construction.title}")

      late_tasks.each do |task|
        po = task.purchase_order
        days_late = (po.required_on_site_date - task.planned_start_date).to_i

        Rails.logger.warn(
          "Task '#{task.name}' (ID: #{task.id}): " \
          "PO #{po.purchase_order_number} delivers #{days_late} days after task start. " \
          "PO delivery: #{po.required_on_site_date}, Task start: #{task.planned_start_date}"
        )
      end

      # TODO: Send notification/email to project manager
      # Example:
      # ProjectMailer.materials_timing_alert(construction, late_tasks).deliver_later
    else
      Rails.logger.info("All materials timing validated for #{construction.title}")
    end

    # Return summary
    {
      construction_id: construction.id,
      construction_title: construction.title,
      total_tasks: project.project_tasks.count,
      tasks_with_pos: project.project_tasks.count { |t| t.has_purchase_order? },
      late_tasks_count: late_tasks.count,
      late_tasks: late_tasks.map do |task|
        {
          task_id: task.id,
          task_name: task.name,
          po_number: task.purchase_order.purchase_order_number,
          days_late: (task.purchase_order.required_on_site_date - task.planned_start_date).to_i
        }
      end
    }
  end
end
