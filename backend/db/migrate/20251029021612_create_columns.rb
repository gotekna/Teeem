class CreateColumns < ActiveRecord::Migration[8.0]
  def change
    create_table :columns do |t|
      t.references :table, null: false, foreign_key: true
      t.string :name, null: false
      t.string :column_name, null: false
      t.string :column_type, null: false
      t.integer :max_length
      t.integer :min_length
      t.string :default_value
      t.text :description
      t.boolean :searchable, default: true
      t.boolean :is_title, default: false
      t.boolean :is_unique, default: false
      t.boolean :required, default: false
      t.decimal :min_value
      t.decimal :max_value
      t.text :validation_message
      t.integer :position
      t.integer :lookup_table_id
      t.string :lookup_display_column
      t.boolean :is_multiple, default: false

      t.timestamps
    end

    add_index :columns, [ :table_id, :column_name ], unique: true
    add_index :columns, :lookup_table_id
  end
end
