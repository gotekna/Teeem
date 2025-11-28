class RenameChangesColumnInCompanyActivities < ActiveRecord::Migration[8.0]
  def change
    # Rename 'changes' to 'change_details' to avoid conflict with ActiveRecord's changes method
    rename_column :company_activities, :changes, :change_details
  end
end
