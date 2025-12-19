# Add thumbnail support for instant PDF preview
# Thumbnails are generated on upload and stored in SharePoint alongside PDFs
class AddThumbnailToJobPlanRevisions < ActiveRecord::Migration[7.0]
  def change
    add_column :job_plan_revisions, :thumbnail_file_id, :string
    add_column :job_plan_revisions, :thumbnail_url, :string
    add_column :job_plan_revisions, :thumbnail_generated_at, :datetime
    add_index :job_plan_revisions, :thumbnail_file_id
  end
end
