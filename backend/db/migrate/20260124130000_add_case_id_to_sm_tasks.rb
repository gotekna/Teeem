# frozen_string_literal: true

class AddCaseIdToSmTasks < ActiveRecord::Migration[7.1]
  def change
    add_reference :sm_tasks, :case, null: true, foreign_key: { to_table: :cases }
  end
end
