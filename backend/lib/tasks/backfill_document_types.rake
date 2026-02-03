# frozen_string_literal: true

namespace :reports do
  desc "Backfill document_type_id on financial reports"
  task backfill_document_types: :environment do
    # Find or create the required document types
    pl_type = DocumentType.find_or_create_by!(name: "Profit and Loss") do |dt|
      dt.abbreviation = "P&L"
      dt.ui_name = "{DocTypeName} {MonthYearLong}"
    end

    bs_type = DocumentType.find_or_create_by!(name: "Balance Sheet") do |dt|
      dt.abbreviation = "BS"
      dt.ui_name = "{DocTypeName} {MonthYearLong}"
    end

    bank_type = DocumentType.find_or_create_by!(name: "Bank Statement") do |dt|
      dt.abbreviation = "BANK"
      dt.ui_name = "{BankCode} {MonthYearLong}"
    end

    puts "Document Types:"
    puts "  P&L ID: #{pl_type.id}, template: #{pl_type.ui_name}"
    puts "  BS ID: #{bs_type.id}, template: #{bs_type.ui_name}"
    puts "  Bank ID: #{bank_type.id}, template: #{bank_type.ui_name}"

    # Backfill document_type_id on all reports
    pl_count = ProfitLossReport.where(document_type_id: nil).update_all(document_type_id: pl_type.id)
    puts "Updated #{pl_count} P&L reports"

    bs_count = BalanceSheetReport.where(document_type_id: nil).update_all(document_type_id: bs_type.id)
    puts "Updated #{bs_count} Balance Sheet reports"

    bank_count = BankStatementReport.where(document_type_id: nil).update_all(document_type_id: bank_type.id)
    puts "Updated #{bank_count} Bank Statement reports"

    puts "Backfill complete!"
  end
end
