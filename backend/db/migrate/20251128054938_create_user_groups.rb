class CreateUserGroups < ActiveRecord::Migration[8.0]
  def change
    create_table :user_groups do |t|
      t.string :name
      t.string :label

      t.timestamps
    end
    add_index :user_groups, :name, unique: true
  end
end
