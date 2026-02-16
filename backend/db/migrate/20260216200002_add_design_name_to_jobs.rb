class AddDesignNameToJobs < ActiveRecord::Migration[8.0]
  def change
    add_column :jobs, :design_name, :string
  end
end
