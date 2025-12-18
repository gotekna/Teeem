class AddFinanceApprovalToJobs < ActiveRecord::Migration[8.0]
  def change
    # Item 12: Finance Approval - IS or IS NOT subject to finance approval
    # nil = not yet asked, true = IS subject to finance, false = IS NOT subject
    add_column :jobs, :finance_approval_required, :boolean
    # Date by which finance must be approved (if required)
    add_column :jobs, :finance_approval_date, :date
  end
end
