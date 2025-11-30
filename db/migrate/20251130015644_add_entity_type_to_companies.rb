class AddEntityTypeToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :entity_type, :string, default: 'company'
  end
end
