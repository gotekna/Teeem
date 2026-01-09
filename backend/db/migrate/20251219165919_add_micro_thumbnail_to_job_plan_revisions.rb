class AddMicroThumbnailToJobPlanRevisions < ActiveRecord::Migration[8.0]
  def change
    add_column :job_plan_revisions, :micro_thumbnail_base64, :text
  end
end
