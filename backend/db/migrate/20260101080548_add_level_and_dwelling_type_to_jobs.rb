class AddLevelAndDwellingTypeToJobs < ActiveRecord::Migration[8.0]
  def change
    add_column :jobs, :level, :string
    add_column :jobs, :dwelling_type, :string
  end
end
