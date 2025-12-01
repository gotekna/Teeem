class CreateColumnTypeDefinitions < ActiveRecord::Migration[8.0]
  def change
    create_table :column_type_definitions do |t|
      t.string :type_key, null: false
      t.string :display_name, null: false
      t.string :category
      t.string :sql_type, null: false
      t.string :rails_type
      t.integer :default_max_length
      t.integer :default_min_length
      t.decimal :default_min_value, precision: 15, scale: 2
      t.decimal :default_max_value, precision: 15, scale: 2
      t.text :validation_regex
      t.text :validation_rules
      t.text :example_values
      t.text :used_for
      t.string :icon
      t.string :emoji
      t.boolean :needs_config, default: false
      t.boolean :is_active, default: true
      t.integer :version, default: 1
      t.datetime :version_updated_at
      t.timestamps
    end

    add_index :column_type_definitions, :type_key, unique: true
    add_index :column_type_definitions, :category
    add_index :column_type_definitions, :is_active
  end
end
