class AddDescriptionToJobTypes < ActiveRecord::Migration[8.0]
  def change
    add_column :job_types, :description, :text
  end
end
