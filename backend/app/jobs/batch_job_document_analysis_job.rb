# frozen_string_literal: true

# Job to batch analyze job documents with AI
# Processes documents that haven't been analyzed yet
#
# Usage:
#   BatchJobDocumentAnalysisJob.perform_later(job_id: 101)  # Analyze specific job
#   BatchJobDocumentAnalysisJob.perform_later(limit: 50)    # Analyze 50 unanalyzed docs
class BatchJobDocumentAnalysisJob < ApplicationJob
  queue_as :low

  # Default batch size
  DEFAULT_LIMIT = 25

  # Delay between documents to avoid rate limits
  DOCUMENT_DELAY = 3 # seconds

  def perform(options = {})
    job_id = options[:job_id]
    limit = options[:limit] || DEFAULT_LIMIT

    documents = build_query(job_id, limit)
    total = documents.count

    Rails.logger.info("[BatchJobDocumentAnalysis] Starting batch analysis of #{total} documents")

    stats = { analyzed: 0, skipped: 0, errors: 0 }

    documents.each_with_index do |document, index|
      begin
        # Skip if already analyzed recently (within last 24 hours)
        if document.ai_analyzed_at.present? && document.ai_analyzed_at > 24.hours.ago
          Rails.logger.info("[BatchJobDocumentAnalysis] Skipping #{document.id} - recently analyzed")
          stats[:skipped] += 1
          next
        end

        Rails.logger.info("[BatchJobDocumentAnalysis] Analyzing #{index + 1}/#{total}: #{document.file_name}")

        analyzer = JobDocumentAiAnalyzer.new(document)
        result = analyzer.analyze!

        if result[:success]
          stats[:analyzed] += 1
          Rails.logger.info("[BatchJobDocumentAnalysis] #{document.id}: #{result[:suggested_type]} (#{result[:confidence]}%)")
        else
          stats[:errors] += 1
          Rails.logger.warn("[BatchJobDocumentAnalysis] #{document.id}: #{result[:error]}")
        end

        # Rate limit delay between API calls
        sleep(DOCUMENT_DELAY) if index < total - 1

      rescue StandardError => e
        stats[:errors] += 1
        Rails.logger.error("[BatchJobDocumentAnalysis] Error on #{document.id}: #{e.message}")
      end
    end

    Rails.logger.info("[BatchJobDocumentAnalysis] Complete: #{stats[:analyzed]} analyzed, #{stats[:skipped]} skipped, #{stats[:errors]} errors")
    stats
  end

  private

  def build_query(job_id, limit)
    scope = JobDocument.where(ai_analyzed_at: nil)

    # Filter by job if specified
    scope = scope.where(job_id: job_id) if job_id.present?

    # Order by job_id so we process job by job
    scope.order(:job_id, :id).limit(limit)
  end
end
