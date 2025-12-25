class RenameSmTemplateRowsColumnsToGanttUiNames < ActiveRecord::Migration[7.2]
  def change
    # Rename columns in sm_template_rows to match Gantt UI names
    # (and align with tasks table which already uses these names)

    # require_supervisor_check → confirm
    if column_exists?(:sm_template_rows, :require_supervisor_check)
      rename_column :sm_template_rows, :require_supervisor_check, :confirm
    end

    # require_supplier_confirm → supplier_confirm
    if column_exists?(:sm_template_rows, :require_supplier_confirm)
      rename_column :sm_template_rows, :require_supplier_confirm, :supplier_confirm
    end

    # manually_positioned → hold
    if column_exists?(:sm_template_rows, :manually_positioned)
      rename_column :sm_template_rows, :manually_positioned, :hold
    end

    # is_completed → completed
    if column_exists?(:sm_template_rows, :is_completed)
      rename_column :sm_template_rows, :is_completed, :completed
    end

    # Rename manual_start_date → hold_date (to match the "hold" naming)
    if column_exists?(:sm_template_rows, :manual_start_date)
      rename_column :sm_template_rows, :manual_start_date, :hold_date
    end

    # Also rename in tasks table for consistency
    if column_exists?(:tasks, :manually_positioned)
      rename_column :tasks, :manually_positioned, :hold
    end

    if column_exists?(:tasks, :manually_positioned_at)
      rename_column :tasks, :manually_positioned_at, :hold_at
    end

    # Rename require_supervisor_check in tasks table if it exists
    if column_exists?(:tasks, :require_supervisor_check)
      rename_column :tasks, :require_supervisor_check, :require_confirm
    end
  end
end
