# frozen_string_literal: true

class AddDocsortToMeasurements < ActiveRecord::Migration[7.1]
  def change
    # Allow measurements to be linked to DocsortItem for standalone takeoff
    add_reference :unreal_measurements, :docsort_item, foreign_key: true, index: true

    # Make job_id nullable - measurements can exist without a job when from DocSort
    change_column_null :unreal_measurements, :job_id, true

    # Also allow page_scales to be linked to DocsortItem
    add_reference :page_scales, :docsort_item, foreign_key: true, index: true

    # Make job_plan_id nullable on page_scales for standalone takeoff
    change_column_null :page_scales, :job_plan_id, true
  end
end
