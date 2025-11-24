class AddAvailableChoicesToColumns < ActiveRecord::Migration[8.0]
  def change
    add_column :columns, :available_choices, :text
  end
end
