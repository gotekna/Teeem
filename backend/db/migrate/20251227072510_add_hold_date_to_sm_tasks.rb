class AddHoldDateToSmTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_tasks, :hold_date, :date
  end
end
