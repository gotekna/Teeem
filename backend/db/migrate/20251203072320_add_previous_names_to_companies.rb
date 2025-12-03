class AddPreviousNamesToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :previous_names, :text, array: true, default: []
  end
end
