# frozen_string_literal: true

class AddXeroTrackingCategoryNameToTenantSettings < ActiveRecord::Migration[7.1]
  def change
    add_column :tenant_settings, :xero_tracking_category_name, :string, default: "Job",
      comment: "Xero tracking category name used for job matching (e.g., 'Job', 'JOB ID')"
  end
end
