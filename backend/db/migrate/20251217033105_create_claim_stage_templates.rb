class CreateClaimStageTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :claim_stage_templates do |t|
      t.references :job_type, null: false, foreign_key: true
      t.string :name, null: false
      t.decimal :percentage, precision: 5, scale: 2, null: false
      t.integer :sequence_order, default: 0, null: false
      t.string :description
      t.string :invoice_match_pattern
      t.boolean :is_active, default: true, null: false
      t.timestamps

      t.index [:job_type_id, :sequence_order], name: "idx_claim_stage_templates_ordering"
      t.index [:job_type_id, :name], unique: true, name: "idx_claim_stage_templates_unique_name"
    end
  end
end
