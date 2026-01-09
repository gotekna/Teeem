class AddContractItemsToJobs < ActiveRecord::Migration[8.0]
  def change
    # Item 13: Liquidated Damages - default $50.00 per day
    add_column :jobs, :liquidated_damages, :decimal, precision: 10, scale: 2, default: 50.00
    # Item 14: Who gets certification - true = Owner, false = Contractor
    add_column :jobs, :certification_by_owner, :boolean, default: false
  end
end
