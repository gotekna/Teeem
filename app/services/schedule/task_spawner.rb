# Service to spawn child tasks (photos, certificates, subtasks)
# when a parent task is completed or meets certain conditions

module Schedule
  class TaskSpawner
    attr_reader :parent_task, :errors

    def initialize(parent_task)
      @parent_task = parent_task
      @errors = []
    end

    # Spawn all required child tasks based on template configuration
    def spawn_all
      return { success: false, errors: [ "Task has no template row" ] } unless parent_task.schedule_template_row

      spawned = []

      ActiveRecord::Base.transaction do
        spawned << spawn_photo_task if should_spawn_photo?
        spawned << spawn_certificate_task if should_spawn_certificate?
        spawned += spawn_subtasks if should_spawn_subtasks?
      end

      { success: true, spawned_tasks: spawned.compact }
    rescue StandardError => e
      @errors << e.message
      Rails.logger.error("TaskSpawner failed for task #{parent_task.id}: #{e.message}")
      { success: false, errors: @errors }
    end

    # Spawn only photo task
    def spawn_photo_task
      return nil unless should_spawn_photo?
      return nil if photo_task_exists?

      row = parent_task.schedule_template_row

      task = ProjectTask.create!(
        project: parent_task.project,
        parent_task: parent_task,
        spawned_type: "photo",
        name: "Photo - #{parent_task.name}",
        task_type: "documentation",
        category: "photo",
        status: "not_started",
        progress_percentage: 0,
        duration_days: 0,  # Photos are instant once uploaded
        sequence_order: parent_task.sequence_order + 0.1,
        planned_start_date: parent_task.actual_end_date || parent_task.planned_end_date,
        planned_end_date: parent_task.actual_end_date || parent_task.planned_end_date,
        notes: "Photo documentation for: #{parent_task.name}"
      )

      Rails.logger.info("Spawned photo task #{task.id} for parent task #{parent_task.id}")
      task
    end

    # Spawn only certificate task
    def spawn_certificate_task
      return nil unless should_spawn_certificate?
      return nil if certificate_task_exists?

      row = parent_task.schedule_template_row
      cert_lag = row.cert_lag_days || 10

      completion_date = parent_task.actual_end_date || parent_task.planned_end_date
      cert_due_date = completion_date + cert_lag.days

      task = ProjectTask.create!(
        project: parent_task.project,
        parent_task: parent_task,
        spawned_type: "certificate",
        name: "Certificate - #{parent_task.name}",
        task_type: "documentation",
        category: "certificate",
        status: "not_started",
        progress_percentage: 0,
        duration_days: 0,
        sequence_order: parent_task.sequence_order + 0.2,
        planned_start_date: completion_date,
        planned_end_date: cert_due_date,
        notes: "Certificate required #{cert_lag} days after completion of: #{parent_task.name}"
      )

      Rails.logger.info("Spawned certificate task #{task.id} for parent task #{parent_task.id} (due #{cert_due_date})")
      task
    end

    # Spawn all subtasks
    def spawn_subtasks
      return [] unless should_spawn_subtasks?
      return [] if subtasks_exist?

      row = parent_task.schedule_template_row
      subtask_names = row.subtask_list

      return [] if subtask_names.empty?

      subtasks = []
      subtask_names.each_with_index do |name, index|
        task = ProjectTask.create!(
          project: parent_task.project,
          parent_task: parent_task,
          spawned_type: "subtask",
          name: name,
          task_type: parent_task.task_type,
          category: parent_task.category,
          status: "not_started",
          progress_percentage: 0,
          duration_days: 1,  # Default 1 day per subtask
          sequence_order: parent_task.sequence_order + 0.3 + (index * 0.01),
          planned_start_date: parent_task.planned_start_date,
          planned_end_date: parent_task.planned_start_date + 1.day,
          supplier_name: parent_task.supplier_name,
          notes: "Subtask of: #{parent_task.name}"
        )

        subtasks << task
      end

      Rails.logger.info("Spawned #{subtasks.count} subtasks for parent task #{parent_task.id}")
      subtasks
    end

    private

    def should_spawn_photo?
      row = parent_task.schedule_template_row
      row && row.require_photo && parent_task.status == "complete"
    end

    def should_spawn_certificate?
      row = parent_task.schedule_template_row
      row && row.require_certificate && parent_task.status == "complete"
    end

    def should_spawn_subtasks?
      row = parent_task.schedule_template_row
      row && row.has_subtasks && parent_task.status == "in_progress"
    end

    def photo_task_exists?
      parent_task.spawned_tasks.photo_tasks.exists?
    end

    def certificate_task_exists?
      parent_task.spawned_tasks.certificate_tasks.exists?
    end

    def subtasks_exist?
      parent_task.spawned_tasks.subtasks.exists?
    end
  end
end
