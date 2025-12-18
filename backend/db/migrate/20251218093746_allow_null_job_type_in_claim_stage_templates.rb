class AllowNullJobTypeInClaimStageTemplates < ActiveRecord::Migration[8.0]
  def change
    change_column_null :claim_stage_templates, :job_type_id, true
  end
end
