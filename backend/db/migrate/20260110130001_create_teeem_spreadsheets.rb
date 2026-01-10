class CreateTeeemSpreadsheets < ActiveRecord::Migration[8.0]
  def change
    create_table :teeem_spreadsheets do |t|
      t.string :name, null: false, default: "Untitled Spreadsheet"
      t.jsonb :data, null: false, default: {}
      t.references :user, null: false, foreign_key: true
      t.boolean :is_template, null: false, default: false

      t.timestamps
    end

    add_index :teeem_spreadsheets, :name
    add_index :teeem_spreadsheets, :is_template
    add_index :teeem_spreadsheets, [:user_id, :updated_at]
  end
end
