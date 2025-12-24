# frozen_string_literal: true

namespace :financial_reports do
  desc "Create Foundation tables for Bank Statements, P&L, and Balance Sheet reports"
  task setup_foundations: :environment do
    puts "Setting up Financial Report Foundation tables..."

    # ============================================
    # Table 1: Bank Statement Reports (existing table)
    # ============================================
    puts "\n1. Setting up Bank Statement Reports foundation..."

    bank_statement_foundation = Foundation.find_by(database_table_name: "bank_statement_reports")
    unless bank_statement_foundation
      bank_statement_foundation = Foundation.create!(
        slug: "bank-statement-reports",
        name: "Bank Statement Reports",
        description: "Monthly and annual bank statement reports generated from Xero transactions",
        database_table_name: "bank_statement_reports",
        table_type: "system",
        model_class: "BankStatementReport"
      )
    end

    bank_statement_columns = [
      { name: "Bank Account", column_name: "bank_account_name", column_type: "single_line_text", position: 1, is_title: true },
      { name: "Bank Code", column_name: "bank_code", column_type: "choice", position: 2,
        available_choices: %w[NAB WBC BOQ CBA ANZ STRIPE SS OTHER] },
      { name: "Company Code", column_name: "company_code", column_type: "single_line_text", position: 3 },
      { name: "Account Number", column_name: "account_number", column_type: "single_line_text", position: 4 },
      { name: "Financial Year", column_name: "financial_year", column_type: "single_line_text", position: 5 },
      { name: "Month", column_name: "month", column_type: "whole_number", position: 6 },
      { name: "Year", column_name: "year", column_type: "whole_number", position: 7 },
      { name: "Report Type", column_name: "report_type", column_type: "choice", position: 8,
        available_choices: %w[monthly annual] },
      { name: "Period Start", column_name: "period_start", column_type: "date", position: 9 },
      { name: "Period End", column_name: "period_end", column_type: "date", position: 10 },
      { name: "Transaction Count", column_name: "transaction_count", column_type: "whole_number", position: 11 },
      { name: "Total In", column_name: "total_in", column_type: "currency", position: 12 },
      { name: "Total Out", column_name: "total_out", column_type: "currency", position: 13 },
      { name: "Net Change", column_name: "net_change", column_type: "currency", position: 14 },
      { name: "Status", column_name: "status", column_type: "choice", position: 15,
        available_choices: %w[pending generating completed failed] },
      { name: "File Name", column_name: "file_name", column_type: "single_line_text", position: 16 },
      { name: "Download URL", column_name: "cloudinary_url", column_type: "url", position: 17 },
      { name: "Generated At", column_name: "generated_at", column_type: "date_and_time", position: 18 },
      { name: "Error Message", column_name: "error_message", column_type: "multiple_lines_text", position: 19 }
    ]

    bank_statement_columns.each do |col_attrs|
      bank_statement_foundation.columns.find_or_create_by!(column_name: col_attrs[:column_name]) do |c|
        c.assign_attributes(col_attrs.except(:column_name))
      end
    end

    puts "   - Created foundation: #{bank_statement_foundation.name} (ID: #{bank_statement_foundation.id})"
    puts "   - Created #{bank_statement_foundation.columns.count} columns"

    # ============================================
    # Table 2: Profit & Loss Reports (new table)
    # ============================================
    puts "\n2. Setting up Profit & Loss Reports foundation..."

    pl_foundation = Foundation.find_by(database_table_name: "profit_loss_reports")
    unless pl_foundation
      pl_foundation = Foundation.create!(
        slug: "profit-loss-reports",
        name: "Profit & Loss Reports",
        description: "End of year Profit & Loss reports from Xero",
        database_table_name: "profit_loss_reports",
        table_type: "system",
        model_class: "ProfitLossReport"
      )
    end

    pl_columns = [
      { name: "Company", column_name: "company_name", column_type: "single_line_text", position: 1, is_title: true },
      { name: "Company Code", column_name: "company_code", column_type: "single_line_text", position: 2 },
      { name: "Financial Year", column_name: "financial_year", column_type: "single_line_text", position: 3 },
      { name: "Report Date", column_name: "report_date", column_type: "date", position: 4 },
      { name: "Period Start", column_name: "period_start", column_type: "date", position: 5 },
      { name: "Period End", column_name: "period_end", column_type: "date", position: 6 },
      { name: "Total Revenue", column_name: "total_revenue", column_type: "currency", position: 7 },
      { name: "Total Expenses", column_name: "total_expenses", column_type: "currency", position: 8 },
      { name: "Net Profit", column_name: "net_profit", column_type: "currency", position: 9 },
      { name: "Status", column_name: "status", column_type: "choice", position: 10,
        available_choices: %w[pending generating completed failed] },
      { name: "File Name", column_name: "file_name", column_type: "single_line_text", position: 11 },
      { name: "Download URL", column_name: "cloudinary_url", column_type: "url", position: 12 },
      { name: "Generated At", column_name: "generated_at", column_type: "date_and_time", position: 13 },
      { name: "Error Message", column_name: "error_message", column_type: "multiple_lines_text", position: 14 }
    ]

    pl_columns.each do |col_attrs|
      pl_foundation.columns.find_or_create_by!(column_name: col_attrs[:column_name]) do |c|
        c.assign_attributes(col_attrs.except(:column_name))
      end
    end

    puts "   - Created foundation: #{pl_foundation.name} (ID: #{pl_foundation.id})"
    puts "   - Created #{pl_foundation.columns.count} columns"

    # ============================================
    # Table 3: Balance Sheet Reports (new table)
    # ============================================
    puts "\n3. Setting up Balance Sheet Reports foundation..."

    bs_foundation = Foundation.find_by(database_table_name: "balance_sheet_reports")
    unless bs_foundation
      bs_foundation = Foundation.create!(
        slug: "balance-sheet-reports",
        name: "Balance Sheet Reports",
        description: "End of year Balance Sheet reports from Xero",
        database_table_name: "balance_sheet_reports",
        table_type: "system",
        model_class: "BalanceSheetReport"
      )
    end

    bs_columns = [
      { name: "Company", column_name: "company_name", column_type: "single_line_text", position: 1, is_title: true },
      { name: "Company Code", column_name: "company_code", column_type: "single_line_text", position: 2 },
      { name: "Financial Year", column_name: "financial_year", column_type: "single_line_text", position: 3 },
      { name: "Report Date", column_name: "report_date", column_type: "date", position: 4 },
      { name: "Total Assets", column_name: "total_assets", column_type: "currency", position: 5 },
      { name: "Total Liabilities", column_name: "total_liabilities", column_type: "currency", position: 6 },
      { name: "Net Assets", column_name: "net_assets", column_type: "currency", position: 7 },
      { name: "Status", column_name: "status", column_type: "choice", position: 8,
        available_choices: %w[pending generating completed failed] },
      { name: "File Name", column_name: "file_name", column_type: "single_line_text", position: 9 },
      { name: "Download URL", column_name: "cloudinary_url", column_type: "url", position: 10 },
      { name: "Generated At", column_name: "generated_at", column_type: "date_and_time", position: 11 },
      { name: "Error Message", column_name: "error_message", column_type: "multiple_lines_text", position: 12 }
    ]

    bs_columns.each do |col_attrs|
      bs_foundation.columns.find_or_create_by!(column_name: col_attrs[:column_name]) do |c|
        c.assign_attributes(col_attrs.except(:column_name))
      end
    end

    puts "   - Created foundation: #{bs_foundation.name} (ID: #{bs_foundation.id})"
    puts "   - Created #{bs_foundation.columns.count} columns"

    puts "\n✅ All Financial Report foundations created successfully!"
    puts "\nFoundation IDs:"
    puts "  - Bank Statement Reports: #{bank_statement_foundation.id}"
    puts "  - Profit & Loss Reports: #{pl_foundation.id}"
    puts "  - Balance Sheet Reports: #{bs_foundation.id}"
  end

  desc "Generate bank statements for a company"
  task :generate_bank_statements, [ :company_id, :financial_year ] => :environment do |_t, args|
    company = Company.find(args[:company_id])
    financial_year = args[:financial_year] || "FY2025"

    puts "Generating bank statements for #{company.name} (#{financial_year})..."

    # Get all bank accounts linked to Xero for this company
    bank_accounts = company.bank_accounts.where.not(xero_account_id: nil)

    if bank_accounts.empty?
      puts "No Xero-linked bank accounts found for this company."
      exit
    end

    bank_accounts.each do |account|
      puts "\nProcessing: #{account.display_name}"

      # Generate monthly statements
      (1..12).each do |month|
        report = BankStatementReport.find_or_initialize_by(
          bank_account_id: account.xero_account_id,
          financial_year: financial_year,
          month: month
        )

        next if report.persisted? && report.completed?

        report.bank_account_name = account.display_name
        report.bank_code = account.bank_code
        report.company_code = company.short_code || company.name[0..1].upcase
        report.account_number = account.account_number
        report.report_type = "monthly"
        report.save!

        puts "  - Month #{month}: Created/Updated"
      end
    end

    puts "\n✅ Bank statement records created. Run generate! on each to produce PDFs."
  end

  desc "Create P&L and Balance Sheet reports for Tekna Admin"
  task create_tekna_admin_reports: :environment do
    company = Company.find(4) # Tekna Admin Pty Ltd
    puts "Creating reports for #{company.name}..."

    # Create P&L Report for FY2025
    pl = ProfitLossReport.find_or_initialize_by(company_id: 4, financial_year: "FY2025")
    pl.company_name = company.name
    pl.company_code = "TA"
    pl.period_start = Date.new(2024, 7, 1)
    pl.period_end = Date.new(2025, 6, 30)
    pl.save!
    puts "P&L Report created: ID=#{pl.id}"

    # Create Balance Sheet Report for FY2025
    bs = BalanceSheetReport.find_or_initialize_by(company_id: 4, financial_year: "FY2025")
    bs.company_name = company.name
    bs.company_code = "TA"
    bs.report_date = Date.new(2025, 6, 30)
    bs.save!
    puts "Balance Sheet Report created: ID=#{bs.id}"

    puts "\n✅ Reports created for Tekna Admin!"
  end

  desc "Generate all financial reports for all Xero-connected companies"
  task generate_all: :environment do
    puts "Generating financial reports for all Xero-connected companies..."

    companies = CorporateCompany.with_xero
    puts "Found #{companies.count} companies with Xero connection"

    companies.each do |company|
      puts "\n=== #{company.name} ==="

      # Bank Statements
      begin
        result = BankStatementReport.generate_historical!(company)
        puts "  Bank Statements: #{result[:created]} created"
      rescue StandardError => e
        puts "  Bank Statements: ERROR - #{e.message[0..80]}"
      end

      # P&L Reports
      begin
        result = ProfitLossReport.generate_historical!(company)
        puts "  P&L Reports: #{result[:created]} created"
      rescue StandardError => e
        puts "  P&L Reports: ERROR - #{e.message[0..80]}"
      end

      # Balance Sheet Reports
      begin
        result = BalanceSheetReport.generate_historical!(company)
        puts "  Balance Sheets: #{result[:created]} created"
      rescue StandardError => e
        puts "  Balance Sheets: ERROR - #{e.message[0..80]}"
      end
    end

    puts "\n✅ All financial reports generated!"
  end
end
