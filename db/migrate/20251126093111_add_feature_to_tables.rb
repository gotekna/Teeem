class AddFeatureToTables < ActiveRecord::Migration[8.0]
  def change
    add_column :tables, :feature, :string
  end
end
