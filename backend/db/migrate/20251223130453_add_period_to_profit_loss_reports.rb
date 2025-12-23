# frozen_string_literal: true

# Monthly Profit & Loss Reports
#
# This migration adds support for monthly P&L reports (in addition to annual).
# Reports can now be generated for each month since the Xero connection was established.
#
# New field:
# - period: Short label like "Jan25", "Feb25" for display (already has period_start/period_end dates)
#
# The unique constraint changes from [company_id, financial_year] to [company_id, period_end]
# This allows multiple reports per FY (one per month) while preventing duplicates.
class AddPeriodToProfitLossReports < ActiveRecord::Migration[8.0]
  def change
    # Add period display label for monthly reports
    add_column :profit_loss_reports, :period, :string  # "Jan25", "Feb25", etc.

    # Remove old unique constraint (company + FY)
    remove_index :profit_loss_reports, name: "idx_pl_reports_unique"

    # Add new unique constraint (company + period_end)
    # Allows NULL period_end for backwards compatibility with existing annual reports
    add_index :profit_loss_reports, [:company_id, :period_end],
              unique: true,
              name: "idx_pl_reports_company_period",
              where: "period_end IS NOT NULL"

    # Note: financial_year index already exists - no need to add
  end
end
