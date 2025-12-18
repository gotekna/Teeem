class AddConstructionDaysToJobs < ActiveRecord::Migration[8.0]
  def change
    add_column :jobs, :construction_days, :integer, default: 300
  end
end
