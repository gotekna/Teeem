# frozen_string_literal: true

# Batch regenerates bank statement PDF reports.
# Designed for bulk operations when bringing in new companies.
# Processes reports in batches and can auto-continue with subsequent jobs.
class BankStatementBatchRegenerateJob < ApplicationJob
  queue_as :default

  # Returns progress stats for batch regeneration
  def self.progress(company_id: nil, force: false)
    scope = BankStatementReport.all
    scope = scope.where(company_id: company_id) if company_id.present?

    total = scope.count
    completed = scope.where(status: "completed").where.not(generated_at: nil).count

    if force
      # When force=true, all reports need regeneration
      pending = total
      completed_count = 0
    else
      completed_count = completed
      pending = total - completed_count
    end

    {
      total: total,
      completed: completed_count,
      pending: pending,
      percent: total > 0 ? ((completed_count.to_f / total) * 100).round(1) : 0
    }
  end

  def perform(company_id: nil, batch_size: 10, force: false, auto_continue: false)
    Rails.logger.info("Starting BankStatementBatchRegenerateJob (company_id: #{company_id}, batch_size: #{batch_size}, force: #{force})")

    scope = BankStatementReport.all
    scope = scope.where(company_id: company_id) if company_id.present?

    # Find reports that need regeneration
    reports = if force
                scope.order(:id).limit(batch_size)
              else
                scope.where(status: ["pending", "failed"])
                     .or(scope.where(generated_at: nil))
                     .order(:id)
                     .limit(batch_size)
              end

    results = { processed: 0, succeeded: 0, failed: 0, errors: [] }

    reports.each do |report|
      result = report.generate!
      results[:processed] += 1

      if result[:success]
        results[:succeeded] += 1
        Rails.logger.info("Regenerated: #{report.file_name}")
      else
        results[:failed] += 1
        results[:errors] << "#{report.file_name}: #{result[:error]}"
        Rails.logger.error("Failed to regenerate #{report.file_name}: #{result[:error]}")
      end
    rescue StandardError => e
      results[:processed] += 1
      results[:failed] += 1
      results[:errors] << "#{report.file_name}: #{e.message}"
      Rails.logger.error("Error regenerating #{report.file_name}: #{e.message}")
    end

    # Auto-continue if there are more reports to process
    if auto_continue && results[:processed] == batch_size
      remaining = self.class.progress(company_id: company_id, force: force)[:pending]
      if remaining > 0
        Rails.logger.info("Auto-continuing: #{remaining} reports remaining")
        self.class.perform_later(
          company_id: company_id,
          batch_size: batch_size,
          force: force,
          auto_continue: true
        )
      end
    end

    Rails.logger.info("BankStatementBatchRegenerateJob completed: #{results.inspect}")
    results
  end
end
