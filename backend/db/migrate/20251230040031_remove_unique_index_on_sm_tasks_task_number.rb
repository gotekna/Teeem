class RemoveUniqueIndexOnSmTasksTaskNumber < ActiveRecord::Migration[8.0]
  def change
    # Remove the unique index that's blocking task_number sync from templates
    # task_number comes from SmScheduleMaster and can be duplicated across jobs
    remove_index :sm_tasks, name: "index_sm_tasks_on_job_id_and_task_number", if_exists: true
  end
end
