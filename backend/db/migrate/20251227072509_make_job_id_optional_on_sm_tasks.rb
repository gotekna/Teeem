class MakeJobIdOptionalOnSmTasks < ActiveRecord::Migration[8.0]
  def change
    change_column_null :sm_tasks, :job_id, true
  end
end
