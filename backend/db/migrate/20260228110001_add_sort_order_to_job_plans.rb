# frozen_string_literal: true

# FRC (Feb 2026): Scripts and diagnostic queries ORDER BY sort_order on job_plans
# but the column didn't exist. Many other ordered tables (tender_headers, tenders,
# warehouse_documents, etc.) already have sort_order. Adding it to job_plans
# allows manual ordering of plans within a job/tab.
#
# Sentry: TEEEM-BACKEND-C3 (1 event)
class AddSortOrderToJobPlans < ActiveRecord::Migration[8.0]
  def change
    add_column :job_plans, :sort_order, :integer, default: 0, null: false
  end
end
