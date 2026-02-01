class AddResponseZipCacheToSmTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_tasks, :response_zip_fingerprint, :string
    add_column :sm_tasks, :response_zip_path, :string
    add_column :sm_tasks, :response_zip_created_at, :datetime
  end
end
