class AddHasUiToTables < ActiveRecord::Migration[8.0]
  def change
    unless column_exists?(:tables, :has_ui)
      add_column :tables, :has_ui, :boolean, default: false
    end
  end
end
