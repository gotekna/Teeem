class AddIconToJobTypes < ActiveRecord::Migration[8.0]
  def change
    add_column :job_types, :icon, :string
  end
end
