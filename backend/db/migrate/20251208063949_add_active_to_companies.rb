class AddActiveToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :active, :boolean, default: true
  end
end
