# frozen_string_literal: true

# Job to analyze a single job document with AI
# Enqueue with: JobDocumentAnalysisJob.perform_later(document_id)
class JobDocumentAnalysisJob < ApplicationJob
  queue_as :low

  # Rate limiting - max 10 documents per minute to avoid API limits
  RATE_LIMIT_DELAY = 6 # seconds between each document

  def perform(document_id)
    document = JobDocument.find_by(id: document_id)

    unless document
      Rails.logger.warn("[JobDocumentAnalysisJob] Document #{document_id} not found")
      return
    end

    Rails.logger.info("[JobDocumentAnalysisJob] Analyzing document #{document_id}: #{document.file_name}")

    analyzer = JobDocumentAiAnalyzer.new(document)
    result = analyzer.analyze!

    if result[:success]
      Rails.logger.info("[JobDocumentAnalysisJob] Document #{document_id} analyzed: #{result[:suggested_type]} (#{result[:confidence]}% confidence)")
    else
      Rails.logger.error("[JobDocumentAnalysisJob] Failed to analyze document #{document_id}: #{result[:error]}")
    end

    result
  end
end
