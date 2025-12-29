# frozen_string_literal: true

# Rename header to header_gantt in sm_schedule_master
# This aligns the database column with the UI display name "Header Gantt"
class RenameHeaderToHeaderGanttInSmScheduleMaster < ActiveRecord::Migration[8.0]
  def change
    rename_column :sm_schedule_master, :header, :header_gantt
  end
end
