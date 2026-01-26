# Job to process unverified documents in bulk using existing DocumentVerificationService
# This leverages the existing AI document pipeline, not reinventing the wheel
class BatchDocumentVerificationJob < ApplicationJob
  queue_as :low

  # Process unverified documents in batches
  # @param scope [Symbol] - :pending (default), :all_unverified, :failed
  # @param limit [Integer] - Maximum documents to process in this run
  # @param company_id [Integer, nil] - Optional: limit to specific company
  def perform(scope: :pending, limit: 100, company_id: nil)
    documents = build_query(scope, company_id).limit(limit)

    results = {
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    }

    documents.find_each do |doc|
      results[:processed] += 1

      begin
        # Skip if no OneDrive file to analyze
        unless doc.storage_reference.present?
          results[:skipped] += 1
          next
        end

        # Use existing DocumentVerificationService
        result = DocumentVerificationService.new(doc).verify!

        if result[:success]
          results[:success] += 1
          Rails.logger.info("[BatchVerification] Verified doc #{doc.id}: #{doc.title}")
        else
          results[:failed] += 1
          results[:errors] << { doc_id: doc.id, error: result[:error] }
        end

      rescue StandardError => e
        results[:failed] += 1
        results[:errors] << { doc_id: doc.id, error: e.message }
        Rails.logger.error("[BatchVerification] Error processing doc #{doc.id}: #{e.message}")
      end

      # Rate limiting - don't overwhelm Claude API
      sleep(0.5) if results[:processed] % 10 == 0
    end

    Rails.logger.info("[BatchVerification] Complete: #{results.slice(:processed, :success, :failed, :skipped)}")
    results
  end

  private

  def build_query(scope, company_id)
    query = CorporateCompanyDocument.all

    # Filter by company if specified
    query = query.where(company_id: company_id) if company_id.present?

    # Filter by verification status
    case scope.to_sym
    when :pending
      # Never verified or explicitly pending
      query.where(ai_verification_status: [ nil, "pending" ])
    when :all_unverified
      # Anything not verified
      query.where.not(ai_verification_status: "verified")
    when :failed
      # Previously failed verification
      query.where(ai_verification_status: "error")
    when :needs_review
      # Needs human review
      query.where(ai_verification_status: "needs_review")
    else
      query.where(ai_verification_status: [ nil, "pending" ])
    end
  end
end
