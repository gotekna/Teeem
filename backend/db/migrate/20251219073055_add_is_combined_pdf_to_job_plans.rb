# frozen_string_literal: true

class AddIsCombinedPdfToJobPlans < ActiveRecord::Migration[8.0]
  def up
    # Add column with default false
    add_column :job_plans, :is_combined_pdf, :boolean, default: false, null: false

    # Backfill existing "All Plans" entries
    execute <<-SQL
      UPDATE job_plans SET is_combined_pdf = true WHERE display_name = 'All Plans'
    SQL
  end

  def down
    remove_column :job_plans, :is_combined_pdf
  end
end
