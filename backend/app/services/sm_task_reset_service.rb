# frozen_string_literal: true

# SmTaskResetService - Nuclear reset of job tasks with PO preservation
#
# This service deletes ALL SmTasks for a job and re-syncs fresh from template,
# while preserving PO links by task_number.
#
# Usage:
#   service = SmTaskResetService.new(job, template, user: current_user)
#   result = service.reset!
#
# Returns:
#   {
#     success: true/false,
#     tasks_deleted: 430,
#     tasks_created: 450,
#     po_links_preserved: 12,
#     po_links_orphaned: 2,
#     errors: []
#   }
#
class SmTaskResetService
  attr_reader :job, :template, :user, :errors

  def initialize(job, template, user: nil)
    @job = job
    @template = template
    @user = user
    @errors = []
  end

  def reset!
    result = {
      success: false,
      po_links_preserved: 0,
      po_links_orphaned: 0,
      tasks_deleted: 0,
      tasks_created: 0,
      errors: []
    }

    ActiveRecord::Base.transaction do
      # Step 1: Capture current task count and PO links BEFORE deleting
      original_task_count = job.sm_tasks.count
      po_links = capture_po_links
      Rails.logger.info "[SmTaskResetService] Captured #{po_links.values.flatten.count} PO links for #{po_links.keys.count} task_numbers from #{original_task_count} tasks"

      # Step 2: Delete all tasks using existing copy service with clear_existing
      # The copy service handles clearing and creating in one atomic operation
      copy_result = SmScheduleMasterTemplateCopyService.new(template, job, {
        user: user,
        start_date: job.start_date || Date.current,
        clear_existing: true,
        create_purchase_orders: false  # Don't auto-create new POs
      }).execute

      if copy_result[:success]
        result[:tasks_deleted] = original_task_count
        result[:tasks_created] = copy_result[:tasks_created]
      else
        @errors.concat(copy_result[:errors] || ["Copy failed"])
        raise ActiveRecord::Rollback
      end

      # Step 3: Re-link POs by task_number
      relink_result = relink_pos(po_links)
      result[:po_links_preserved] = relink_result[:preserved]
      result[:po_links_orphaned] = relink_result[:orphaned]

      Rails.logger.info "[SmTaskResetService] Reset complete: #{result[:tasks_created]} tasks created, #{result[:po_links_preserved]} PO links preserved, #{result[:po_links_orphaned]} POs orphaned"

      result[:success] = true
    end

    result[:errors] = @errors
    result
  rescue StandardError => e
    Rails.logger.error "[SmTaskResetService] Error: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
    result[:success] = false
    result[:errors] = @errors + [e.message]
    result
  end

  # Preview what will happen without making changes
  def preview
    po_links = capture_po_links
    template_task_numbers = template.sm_schedule_masters.pluck(:task_number).to_set

    preserved = []
    orphaned = []

    po_links.each do |task_number, po_ids|
      if template_task_numbers.include?(task_number)
        po_ids.each { |po_id| preserved << { task_number: task_number, po_id: po_id } }
      else
        po_ids.each { |po_id| orphaned << { task_number: task_number, po_id: po_id } }
      end
    end

    {
      current_task_count: job.sm_tasks.count,
      template_task_count: template.sm_schedule_masters.active.count,
      po_links_to_preserve: preserved.count,
      po_links_to_orphan: orphaned.count,
      orphaned_pos: orphaned.map do |item|
        po = PurchaseOrder.find_by(id: item[:po_id])
        {
          po_id: item[:po_id],
          po_number: po&.purchase_order_number,
          task_number: item[:task_number],
          task_name: job.sm_tasks.find_by(task_number: item[:task_number])&.name
        }
      end
    }
  end

  private

  # Capture PO links by task_number before deletion
  # Returns: { task_number => [purchase_order_ids] }
  def capture_po_links
    links = {}

    job.sm_tasks.each do |task|
      # Use the SSoT method for getting linked PO
      po = task.linked_purchase_order
      next unless po

      links[task.task_number] ||= []
      links[task.task_number] << po.id
    end

    links
  end

  # Re-link POs to new tasks by task_number
  def relink_pos(po_links)
    preserved = 0
    orphaned = 0

    # Build a map of task_number -> new task for efficient lookup
    new_tasks_by_number = job.sm_tasks.reload.index_by(&:task_number)

    po_links.each do |task_number, po_ids|
      new_task = new_tasks_by_number[task_number]

      po_ids.each do |po_id|
        if new_task
          # Re-link PO to new task
          PurchaseOrder.where(id: po_id).update_all(sm_task_id: new_task.id)
          preserved += 1
          Rails.logger.info "[SmTaskResetService] Re-linked PO #{po_id} to task #{new_task.id} (task_number: #{task_number})"
        else
          # Task no longer exists in template - orphan the PO
          PurchaseOrder.where(id: po_id).update_all(sm_task_id: nil)
          orphaned += 1
          Rails.logger.warn "[SmTaskResetService] Orphaned PO #{po_id} - task_number #{task_number} no longer exists in template"
        end
      end
    end

    { preserved: preserved, orphaned: orphaned }
  end
end
