class CreateWhsSettings < ActiveRecord::Migration[8.0]
  def change
    create_table :whs_settings do |t|
      t.string :setting_key, null: false
      t.text :setting_value
      t.string :setting_type, default: 'string' # string, integer, boolean, json
      t.text :description

      t.timestamps
    end

    add_index :whs_settings, :setting_key, unique: true
  end
end
