# frozen_string_literal: true

# Generates bank statement PDF reports for all bank accounts and periods.
# Creates monthly reports for each bank account/month combination with transactions.
class BankStatementReportGenerationJob < ApplicationJob
  queue_as :default

  def perform(options = {})
    Rails.logger.info("Starting BankStatementReportGenerationJob")

    results = {
      created: 0,
      regenerated: 0,
      skipped: 0,
      failed: 0,
      errors: []
    }

    # Get all unique bank account + FY + month combinations
    combinations = XeroBankTransaction
      .select(:bank_account_id, :bank_account_name, :financial_year, :transaction_month, :transaction_year)
      .distinct
      .where.not(financial_year: nil)
      .where.not(transaction_month: nil)

    Rails.logger.info("Found #{combinations.count} bank/FY/month combinations")

    combinations.each do |combo|
      begin
        process_combination(combo, options, results)
      rescue StandardError => e
        results[:failed] += 1
        results[:errors] << "#{combo.bank_account_name} #{combo.financial_year} #{combo.transaction_month}: #{e.message}"
        Rails.logger.error("Failed to process #{combo.bank_account_name}: #{e.message}")
      end
    end

    Rails.logger.info("BankStatementReportGenerationJob completed: #{results.inspect}")
    results
  end

  private

  def process_combination(combo, options, results)
    # Find or create the report record
    report = BankStatementReport.find_or_initialize_by(
      bank_account_id: combo.bank_account_id,
      financial_year: combo.financial_year,
      month: combo.transaction_month
    )

    # Set metadata if new
    if report.new_record?
      report.bank_account_name = combo.bank_account_name
      report.year = combo.transaction_year
      report.report_type = "monthly"
      report.period_start = Date.new(combo.transaction_year, combo.transaction_month, 1)
      report.period_end = report.period_start.end_of_month
      report.save!
      results[:created] += 1
    end

    # Check if we need to generate/regenerate
    force = options[:force] == true
    if force || report.needs_regeneration?
      result = report.generate!
      if result[:success]
        results[:regenerated] += 1
        Rails.logger.info("Generated report: #{report.file_name}")
      else
        results[:failed] += 1
        results[:errors] << "#{combo.bank_account_name} #{combo.financial_year}/#{combo.transaction_month}: #{result[:error]}"
      end
    else
      results[:skipped] += 1
    end
  end
end
