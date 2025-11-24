class CreateWHSSWMSControls < ActiveRecord::Migration[8.0]
  def change
    create_table :whs_swms_controls do |t|
      t.references :whs_swms_hazard, null: false, foreign_key: true

      # Control measure details
      t.text :control_description, null: false
      t.string :control_type, null: false # elimination, substitution, engineering, administrative, ppe
      t.string :responsibility
      t.integer :residual_likelihood # After control
      t.integer :residual_consequence # After control
      t.integer :residual_risk_score # Recalculated
      t.string :residual_risk_level # Recalculated
      t.integer :position, default: 0 # For ordering controls

      t.timestamps
    end

    add_index :whs_swms_controls, :control_type
  end
end
