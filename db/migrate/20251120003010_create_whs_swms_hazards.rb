class CreateWHSSWMSHazards < ActiveRecord::Migration[8.0]
  def change
    create_table :whs_swms_hazards do |t|
      t.references :whs_swms, null: false, foreign_key: true

      # Hazard details
      t.text :hazard_description, null: false
      t.integer :likelihood, null: false # 1-5 scale
      t.integer :consequence, null: false # 1-5 scale
      t.integer :risk_score, null: false # likelihood x consequence
      t.string :risk_level # low, medium, high, extreme (calculated)
      t.text :affected_persons
      t.integer :position, default: 0 # For ordering hazards

      t.timestamps
    end

    add_index :whs_swms_hazards, :risk_level
  end
end
