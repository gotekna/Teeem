class AddContractFieldsToJobs < ActiveRecord::Migration[8.0]
  def change
    # Contract details
    add_column :jobs, :plan_number, :string
    add_column :jobs, :contract_price, :decimal, precision: 12, scale: 2
    add_column :jobs, :deposit, :decimal, precision: 12, scale: 2
    add_column :jobs, :prime_cost, :decimal, precision: 12, scale: 2
    add_column :jobs, :provisional_sums, :decimal, precision: 12, scale: 2
    add_column :jobs, :contract_date, :date

    # Build schedule
    add_column :jobs, :build_period, :string
    add_column :jobs, :stage_slab, :string
    add_column :jobs, :stage_frame, :string
    add_column :jobs, :stage_enclosed, :string
    add_column :jobs, :stage_fixing, :string
    add_column :jobs, :stage_practical, :string
    add_column :jobs, :stage_weather, :string
    add_column :jobs, :weekend_work, :string

    # Important dates
    add_column :jobs, :plan_date, :date
    add_column :jobs, :spec_date, :date
    add_column :jobs, :practical_completion_date, :date
    add_column :jobs, :warranty_end_date, :date
  end
end
