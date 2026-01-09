class RenameJobTitleToName < ActiveRecord::Migration[8.0]
  def change
    rename_column :jobs, :title, :name
  end
end
