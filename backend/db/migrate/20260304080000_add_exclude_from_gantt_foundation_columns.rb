class AddExcludeFromGanttFoundationColumns < ActiveRecord::Migration[7.2]
  def up
    # Add Foundation column for sm-schedule-master
    foundation = Foundation.find_by(slug: 'sm-schedule-master')
    if foundation
      existing = foundation.columns.find_by(column_name: 'exclude_from_gantt')
      unless existing
        # Place near is_active (position ~70s range for status columns)
        foundation.columns.create!(
          column_name: 'exclude_from_gantt',
          name: 'Exclude from Gantt',
          column_type: 'boolean',
          position: 90,
          description: 'Hidden from Gantt chart by default. Use Gantt toolbar to reveal excluded tasks.'
        )
        Rails.logger.info "Created exclude_from_gantt column for sm-schedule-master Foundation"
      end
    end

    # Add Foundation column for sm-tasks
    tasks_foundation = Foundation.find_by(slug: 'sm-tasks')
    if tasks_foundation
      existing = tasks_foundation.columns.find_by(column_name: 'exclude_from_gantt')
      unless existing
        tasks_foundation.columns.create!(
          column_name: 'exclude_from_gantt',
          name: 'Exclude from Gantt',
          column_type: 'boolean',
          position: 90,
          description: 'Hidden from Gantt chart by default. Use Gantt toolbar to reveal excluded tasks.'
        )
        Rails.logger.info "Created exclude_from_gantt column for sm-tasks Foundation"
      end
    end
  end

  def down
    foundation = Foundation.find_by(slug: 'sm-schedule-master')
    foundation&.columns&.find_by(column_name: 'exclude_from_gantt')&.destroy

    tasks_foundation = Foundation.find_by(slug: 'sm-tasks')
    tasks_foundation&.columns&.find_by(column_name: 'exclude_from_gantt')&.destroy
  end
end
