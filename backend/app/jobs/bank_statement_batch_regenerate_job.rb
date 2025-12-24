# frozen_string_literal: true

# BankStatementBatchRegenerateJob
#
# Regenerates bank statement PDFs and creates CorporateCompanyDocument records
# in batches. Designed to be resilient to dyno restarts and timeouts.
#
# Features:
# - Processes in small batches (default: 10) to avoid timeouts
# - Skips already-completed reports (has CorporateCompanyDocument)
# - Can be filtered by company_id
# - Self-enqueuing for next batch (or run manually)
# - Uses database state for progress tracking (no Redis needed)
#
# Usage:
#   # Start processing all companies
#   BankStatementBatchRegenerateJob.perform_later
#
#   # Process specific company only
#   BankStatementBatchRegenerateJob.perform_later(company_id: 123)
#
#   # Force regeneration (even if document exists)
#   BankStatementBatchRegenerateJob.perform_later(force: true)
#
#   # Custom batch size
#   BankStatementBatchRegenerateJob.perform_later(batch_size: 5)
#
class BankStatementBatchRegenerateJob < ApplicationJob
  queue_as :low

  # @param options [Hash] Configuration options
  #   - :company_id [Integer] Optional: limit to specific company
  #   - :batch_size [Integer] Number of reports to process per batch (default: 10)
  #   - :force [Boolean] Force regeneration even if document exists (default: false)
  #   - :auto_continue [Boolean] Auto-enqueue next batch when done (default: false)
  def perform(options = {})
    options = options.with_indifferent_access
    company_id = options[:company_id]
    batch_size = (options[:batch_size] || 10).to_i
    force = options[:force] == true
    auto_continue = options[:auto_continue] == true

    # Get reports that need processing
    reports = reports_needing_processing(company_id: company_id, force: force)
                .limit(batch_size)
                .to_a

    if reports.empty?
      log_completion(company_id)
      return { status: "complete", processed: 0, remaining: 0 }
    end

    results = {
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    }

    reports.each do |report|
      process_report(report, results)
      results[:processed] += 1

      # Small pause to avoid overwhelming external APIs
      sleep(0.5) if results[:processed] % 5 == 0
    end

    remaining = reports_needing_processing(company_id: company_id, force: force).count

    Rails.logger.info(
      "[BankStatementBatchRegenerateJob] Batch complete: " \
      "processed=#{results[:processed]}, success=#{results[:success]}, " \
      "failed=#{results[:failed]}, remaining=#{remaining}"
    )

    # Auto-continue if there's more work
    if auto_continue && remaining > 0
      Rails.logger.info("[BankStatementBatchRegenerateJob] Auto-enqueuing next batch...")
      self.class.perform_later(
        company_id: company_id,
        batch_size: batch_size,
        force: force,
        auto_continue: true
      )
    end

    {
      status: remaining > 0 ? "in_progress" : "complete",
      processed: results[:processed],
      success: results[:success],
      failed: results[:failed],
      remaining: remaining,
      errors: results[:errors].first(10) # Limit error reporting
    }
  end

  # Class method to get current progress (can be called from controller)
  def self.progress(company_id: nil, force: false)
    total = base_scope(company_id).count
    completed = completed_scope(company_id).count
    pending = force ? total : (total - completed)

    {
      total: total,
      completed: completed,
      pending: pending,
      percent: total > 0 ? ((completed.to_f / total) * 100).round(1) : 100
    }
  end

  private

  def reports_needing_processing(company_id:, force:)
    scope = self.class.base_scope(company_id)

    unless force
      # Exclude reports that already have a CorporateCompanyDocument
      completed_ids = CorporateCompanyDocument
        .where(source: "xero")
        .where("external_id LIKE 'bank_statement_report:%'")
        .pluck(:external_id)
        .map { |id| id.gsub("bank_statement_report:", "").to_i }

      scope = scope.where.not(id: completed_ids) if completed_ids.any?
    end

    scope.order(:id)
  end

  def process_report(report, results)
    Rails.logger.info("[BankStatementBatchRegenerateJob] Processing report #{report.id}: #{report.display_name}")

    # Check if already has document (double-check in case of race condition)
    external_id = "bank_statement_report:#{report.id}"
    if CorporateCompanyDocument.exists?(source: "xero", external_id: external_id)
      Rails.logger.info("[BankStatementBatchRegenerateJob] Report #{report.id} already has document - skipping")
      results[:skipped] += 1
      return
    end

    # Generate the report (this also uploads to SharePoint and creates document)
    result = report.generate!

    if result[:success]
      results[:success] += 1
      Rails.logger.info("[BankStatementBatchRegenerateJob] Successfully regenerated report #{report.id}")
    else
      results[:failed] += 1
      results[:errors] << { report_id: report.id, error: result[:error] }
      Rails.logger.error("[BankStatementBatchRegenerateJob] Failed to regenerate report #{report.id}: #{result[:error]}")
    end
  rescue StandardError => e
    results[:failed] += 1
    results[:errors] << { report_id: report.id, error: e.message }
    Rails.logger.error("[BankStatementBatchRegenerateJob] Error processing report #{report.id}: #{e.message}")
  end

  def log_completion(company_id)
    if company_id
      Rails.logger.info("[BankStatementBatchRegenerateJob] All reports for company #{company_id} have been processed")
    else
      Rails.logger.info("[BankStatementBatchRegenerateJob] All reports have been processed")
    end
  end

  # Class methods for progress tracking
  class << self
    def base_scope(company_id = nil)
      scope = BankStatementReport.where(status: "completed")
      scope = scope.where(company_id: company_id) if company_id.present?
      scope
    end

    def completed_scope(company_id = nil)
      # Reports that have CorporateCompanyDocument records
      completed_ids = CorporateCompanyDocument
        .where(source: "xero")
        .where("external_id LIKE 'bank_statement_report:%'")

      if company_id.present?
        completed_ids = completed_ids.where(company_id: company_id)
      end

      ids = completed_ids.pluck(:external_id)
                         .map { |id| id.gsub("bank_statement_report:", "").to_i }

      base_scope(company_id).where(id: ids)
    end
  end
end
