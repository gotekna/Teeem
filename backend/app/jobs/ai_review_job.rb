class AiReviewJob < ApplicationJob
  queue_as :default

  def perform(estimate_id)
    estimate = Estimate.find(estimate_id)

    Rails.logger.info "Starting AI review for estimate #{estimate_id}"

    service = PlanReviewService.new(estimate)
    result = service.call

    if result[:success]
      Rails.logger.info "AI review completed for estimate #{estimate_id}"
    else
      Rails.logger.error "AI review failed for estimate #{estimate_id}: #{result[:error]}"
    end

    result
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.error "Estimate not found: #{estimate_id}"
    { success: false, error: "Estimate not found" }
  rescue StandardError => e
    Rails.logger.error "AI review job failed: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    { success: false, error: e.message }
  end
end
