class CreateClaimStageTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :claim_stage_templates do |t|
      t.timestamps
    end
  end
end
