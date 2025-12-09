class DocumentVerificationJob < ApplicationJob
  queue_as :default

  # Retry on transient errors
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  def perform(document_id)
    document = CorporateCompanyDocument.find(document_id)

    Rails.logger.info("Starting AI verification for document #{document_id}: #{document.title}")

    result = DocumentVerificationService.new(document).verify!

    if result[:success]
      Rails.logger.info("AI verification completed for document #{document_id}: status=#{result[:analysis][:status]}, confidence=#{result[:analysis][:confidence]}")
    else
      Rails.logger.warn("AI verification failed for document #{document_id}: #{result[:error]}")
    end

    result
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.error("Document #{document_id} not found: #{e.message}")
    raise # Re-raise to let job retry mechanism handle it
  end
end
