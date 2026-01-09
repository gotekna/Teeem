class AddResidentOwnerToJobs < ActiveRecord::Migration[8.0]
  def change
    # Default to true (IS a resident owner) - can be toggled off for companies/investors
    add_column :jobs, :resident_owner, :boolean, default: true
  end
end
