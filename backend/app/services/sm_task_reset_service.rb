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
      claim_stages_created: 0,
      claim_stages_cleaned: 0,
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
      # It also creates/reuses JobClaimStages for CLAIM tasks
      copy_result = SmScheduleMasterTemplateCopyService.new(template, job, {
        user: user,
        start_date: job.start_date || Date.current,
        clear_existing: true,
        create_purchase_orders: false  # Don't auto-create new POs
      }).execute

      if copy_result[:success]
        result[:tasks_deleted] = original_task_count
        result[:tasks_created] = copy_result[:tasks_created]
        result[:claim_stages_created] = copy_result[:claim_stages_created] || 0
      else
        @errors.concat(copy_result[:errors] || ["Copy failed"])
        raise ActiveRecord::Rollback
      end

      # Step 3: Re-link POs by task_number
      relink_result = relink_pos(po_links)
      result[:po_links_preserved] = relink_result[:preserved]
      result[:po_links_orphaned] = relink_result[:orphaned]

      # Step 4: Clean up orphaned claim stages (no invoice, no task link)
      result[:claim_stages_cleaned] = cleanup_orphaned_claim_stages

      Rails.logger.info "[SmTaskResetService] Reset complete: #{result[:tasks_created]} tasks created, #{result[:po_links_preserved]} PO links preserved, #{result[:po_links_orphaned]} POs orphaned, #{result[:claim_stages_created]} claim stages, #{result[:claim_stages_cleaned]} cleaned"

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
    po_links = capture_po_links_optimized
    template_task_numbers = template.sm_schedule_master_rows.pluck(:task_number).to_set

    preserved_count = 0
    orphaned = []

    po_links.each do |task_number, po_data_list|
      if template_task_numbers.include?(task_number)
        preserved_count += po_data_list.count
      else
        po_data_list.each { |po_data| orphaned << po_data.merge(task_number: task_number) }
      end
    end

    {
      current_task_count: job.sm_tasks.count,
      template_task_count: template.sm_schedule_master_rows.active.count,
      po_links_to_preserve: preserved_count,
      po_links_to_orphan: orphaned.count,
      orphaned_pos: orphaned
    }
  end

  private

  # Optimized: Capture PO links with task details in a single query (for preview)
  # Returns: { task_number => [{ po_id:, po_number:, task_name: }, ...] }
  def capture_po_links_optimized
    links = {}

    # Single query with joins - no N+1
    # Note: Use raw attribute access to avoid alias_attribute conflicts
    PurchaseOrder
      .joins("INNER JOIN sm_tasks ON sm_tasks.id = purchase_orders.sm_task_id")
      .where(sm_tasks: { job_id: job.id })
      .pluck("purchase_orders.id", "purchase_orders.purchase_order_number", "sm_tasks.task_number", "sm_tasks.name")
      .each do |po_id, po_number, task_number, task_name|
        links[task_number] ||= []
        links[task_number] << {
          po_id: po_id,
          po_number: po_number,
          task_name: task_name
        }
      end

    links
  end

  # Capture PO links by task_number before deletion (for reset!)
  # Returns: { task_number => [purchase_order_ids] }
  def capture_po_links
    links = {}

    # Single query - no N+1
    PurchaseOrder
      .joins("INNER JOIN sm_tasks ON sm_tasks.id = purchase_orders.sm_task_id")
      .where(sm_tasks: { job_id: job.id })
      .pluck("sm_tasks.task_number", "purchase_orders.id")
      .each do |task_number, po_id|
        links[task_number] ||= []
        links[task_number] << po_id
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

  # Clean up claim stages that are orphaned after reset:
  # - No invoice linked (external_invoice_id is null)
  # - No SmTask linked (sm_task is nil)
  # - Not custom (is_custom = false, meaning they were created from template)
  def cleanup_orphaned_claim_stages
    # Find claim stages that are:
    # 1. Not linked to any SmTask
    # 2. Don't have an invoice matched
    # 3. Were created from template (not custom)
    orphaned_stages = job.job_claim_stages
                         .where(external_invoice_id: nil)
                         .where(is_custom: false)
                         .left_joins(:sm_task)
                         .where(sm_tasks: { id: nil })

    count = orphaned_stages.count
    if count > 0
      orphaned_stages.destroy_all
      Rails.logger.info "[SmTaskResetService] Cleaned up #{count} orphaned claim stages"
    end
    count
  end
end
