# frozen_string_literal: true

class AddBoardPriorityToSmTasks < ActiveRecord::Migration[7.0]
  def change
    # Per-status board priority for Task Hub BoardView drag-and-drop ordering
    # Format: { "not_started": 1.5, "started": 2.0, ... }
    # Empty {} = use date ordering (default)
    # Non-NULL value for status = manual priority ordering
    add_column :sm_tasks, :board_priority, :jsonb, default: {}
  end
end
