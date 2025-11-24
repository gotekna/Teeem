class AddWhpsAppointeeToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :wphs_appointee, :boolean, default: false, null: false
    add_index :users, :wphs_appointee
  end
end
