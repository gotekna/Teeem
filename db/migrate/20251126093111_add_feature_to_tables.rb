class AddFeatureToTables < ActiveRecord::Migration[8.0]
  def change
    add_column :tables, :feature, :string unless column_exists?(:tables, :feature)
  end
end
