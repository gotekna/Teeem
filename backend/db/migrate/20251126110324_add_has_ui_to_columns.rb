class AddHasUiToColumns < ActiveRecord::Migration[8.0]
  def change
    unless column_exists?(:columns, :has_ui)
      add_column :columns, :has_ui, :boolean, default: false
    end
  end
end
