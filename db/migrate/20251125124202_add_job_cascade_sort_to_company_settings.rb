class AddJobCascadeSortToCompanySettings < ActiveRecord::Migration[8.0]
  def change
    add_column :company_settings, :job_cascade_sort, :jsonb
  end
end
