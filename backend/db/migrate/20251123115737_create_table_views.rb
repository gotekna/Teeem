class CreateTableViews < ActiveRecord::Migration[8.0]
  def change
    create_table :table_views do |t|
      t.integer :table_id
      t.integer :user_id
      t.string :name
      t.string :view_type
      t.json :filters
      t.json :columns
      t.json :sort_order
      t.boolean :is_default, default: false

      t.timestamps
    end

    add_index :table_views, :table_id
    add_index :table_views, :user_id
    add_index :table_views, [ :table_id, :user_id ]
  end
end
