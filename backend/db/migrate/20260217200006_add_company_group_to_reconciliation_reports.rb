# frozen_string_literal: true

class AddCompanyGroupToReconciliationReports < ActiveRecord::Migration[7.2]
  def change
    add_reference :reconciliation_reports, :company_group, foreign_key: true, null: true
    add_index :reconciliation_reports, [:company_group_id, :as_of_date], name: "idx_reconciliation_reports_on_group_and_date"
  end
end
