# frozen_string_literal: true

# Monthly Balance Sheet Reports
#
# This migration adds support for monthly balance sheet reports (in addition to annual).
# Reports can now be generated for each month since the Xero connection was established.
#
# New fields:
# - period: Short label like "Jan25", "Feb25" for display
# - period_end_date: Last day of the month (e.g., 2025-01-31) for uniqueness
#
# The unique constraint changes from [company_id, financial_year] to [company_id, period_end_date]
# This allows multiple reports per FY (one per month) while preventing duplicates.
class AddPeriodToBalanceSheetReports < ActiveRecord::Migration[8.0]
  def change
    # Add period fields for monthly reports
    add_column :balance_sheet_reports, :period, :string  # "Jan25", "Feb25", etc.
    add_column :balance_sheet_reports, :period_end_date, :date  # Last day of month (e.g., 2025-01-31)

    # Remove old unique constraint (company + FY)
    remove_index :balance_sheet_reports, name: "idx_bs_reports_unique"

    # Add new unique constraint (company + period_end_date)
    # Allows NULL period_end_date for backwards compatibility with existing annual reports
    add_index :balance_sheet_reports, [:company_id, :period_end_date],
              unique: true,
              name: "idx_bs_reports_company_period",
              where: "period_end_date IS NOT NULL"

    # Note: financial_year index already exists - no need to add
  end
end
