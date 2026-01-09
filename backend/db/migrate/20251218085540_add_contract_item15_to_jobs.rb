class AddContractItem15ToJobs < ActiveRecord::Migration[8.0]
  def change
    # Item 15: Prime Cost and Provisional Sums details (what they are)
    add_column :jobs, :prime_cost_details, :text
    add_column :jobs, :provisional_sums_details, :text
    # Item 15: Special Conditions checkbox and details
    add_column :jobs, :has_special_conditions, :boolean, default: false
    add_column :jobs, :special_conditions, :text
  end
end
