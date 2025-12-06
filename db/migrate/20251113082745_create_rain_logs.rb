class CreateRainLogs < ActiveRecord::Migration[8.0]
  def change
    create_table :rain_logs do |t|
      t.references :construction, null: false, foreign_key: true
      t.date :date, null: false
      t.decimal :rainfall_mm, precision: 10, scale: 2
      t.decimal :hours_affected, precision: 5, scale: 2
      t.string :severity
      t.string :source, null: false, default: 'manual'
      t.references :created_by_user, foreign_key: { to_table: :users }
      t.text :notes
      t.jsonb :weather_api_response

      t.timestamps
    end

    add_index :rain_logs, [ :construction_id, :date ], unique: true
    add_index :rain_logs, :date
    add_index :rain_logs, :source
  end
end
