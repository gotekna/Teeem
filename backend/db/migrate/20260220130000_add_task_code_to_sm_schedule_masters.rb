class AddTaskCodeToSmScheduleMasters < ActiveRecord::Migration[8.0]
  def up
    # Add task_code column - user-editable code/number for display
    # task_number remains for internal predecessor logic (auto-assigned = id)
    add_column :sm_schedule_masters, :task_code, :string, limit: 50

    # Also add to sm_tasks (the job-level instantiated copies)
    add_column :sm_tasks, :task_code, :string, limit: 50

    # Add Foundation column for sm-schedule-master
    foundation = Foundation.find_by(slug: 'sm-schedule-master')
    if foundation
      existing = foundation.columns.find_by(column_name: 'task_code')
      unless existing
        # Position 1 puts it near the top, right alongside task_number
        foundation.columns.create!(
          column_name: 'task_code',
          name: 'Task Code',
          column_type: 'single_line_text',
          position: 0,
          searchable: true,
          description: 'Optional user-defined code for this task. Shows as "CODE - Task Name" when set.'
        )
        Rails.logger.info "Created task_code column for sm-schedule-master Foundation"
      end
    end

    # Add Foundation column for sm-tasks
    tasks_foundation = Foundation.find_by(slug: 'sm-tasks')
    if tasks_foundation
      existing = tasks_foundation.columns.find_by(column_name: 'task_code')
      unless existing
        tasks_foundation.columns.create!(
          column_name: 'task_code',
          name: 'Task Code',
          column_type: 'single_line_text',
          position: 0,
          searchable: true,
          description: 'User-defined code copied from schedule master template.'
        )
        Rails.logger.info "Created task_code column for sm-tasks Foundation"
      end
    end
  end

  def down
    remove_column :sm_schedule_masters, :task_code, if_exists: true
    remove_column :sm_tasks, :task_code, if_exists: true

    # Remove Foundation columns
    foundation = Foundation.find_by(slug: 'sm-schedule-master')
    foundation&.columns&.find_by(column_name: 'task_code')&.destroy

    tasks_foundation = Foundation.find_by(slug: 'sm-tasks')
    tasks_foundation&.columns&.find_by(column_name: 'task_code')&.destroy
  end
end
