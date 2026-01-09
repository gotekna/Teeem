module Api
  module V1
    class EstimateReviewsController < ApplicationController
      before_action :set_estimate, only: [ :create ]
      before_action :set_review, only: [ :show ]

      # POST /api/v1/estimates/:estimate_id/ai_review
      def create
        # Check if estimate is matched to construction
        unless @estimate.construction
          return render json: {
            success: false,
            error: "Estimate must be matched to a construction/job before AI review"
          }, status: :unprocessable_entity
        end

        # Check for existing processing review
        existing_review = @estimate.estimate_reviews.find_by(status: "processing")
        if existing_review
          return render json: {
            success: false,
            error: "AI review already in progress",
            review_id: existing_review.id,
            status: existing_review.status
          }, status: :unprocessable_entity
        end

        # Create review record
        review = @estimate.estimate_reviews.create!(status: "pending")

        # Enqueue background job
        AiReviewJob.perform_later(@estimate.id)

        render json: {
          success: true,
          review_id: review.id,
          status: "processing",
          message: "AI review started. This may take 30-60 seconds."
        }, status: :accepted
      rescue StandardError => e
        Rails.logger.error "Failed to start AI review: #{e.message}"
        render json: {
          success: false,
          error: "Failed to start AI review: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/estimate_reviews/:id
      def show
        if @review.completed?
          render json: format_completed_review
        elsif @review.failed?
          render json: format_failed_review, status: :unprocessable_entity
        else
          render json: format_processing_review
        end
      end

      # GET /api/v1/estimates/:estimate_id/reviews
      def index
        estimate = Estimate.find(params[:estimate_id])
        reviews = estimate.estimate_reviews.recent

        render json: {
          success: true,
          reviews: reviews.map { |r| format_review_summary(r) }
        }
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Estimate not found"
        }, status: :not_found
      end

      # DELETE /api/v1/estimate_reviews/:id
      def destroy
        review = EstimateReview.find(params[:id])
        review.destroy!

        render json: {
          success: true,
          message: "Review deleted successfully"
        }
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Review not found"
        }, status: :not_found
      end

      private

      def set_estimate
        @estimate = Estimate.find(params[:estimate_id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Estimate not found"
        }, status: :not_found
      end

      def set_review
        @review = EstimateReview.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Review not found"
        }, status: :not_found
      end

      def format_completed_review
        {
          success: true,
          review_id: @review.id,
          status: @review.status,
          reviewed_at: @review.reviewed_at,
          confidence_score: @review.confidence_score,
          summary: {
            items_matched: @review.items_matched,
            items_mismatched: @review.items_mismatched,
            items_missing: @review.items_missing,
            items_extra: @review.items_extra,
            total_discrepancies: @review.total_discrepancies
          },
          discrepancies: @review.discrepancies,
          ai_findings: @review.ai_findings
        }
      end

      def format_failed_review
        {
          success: false,
          review_id: @review.id,
          status: @review.status,
          reviewed_at: @review.reviewed_at,
          error: @review.ai_findings&.dig("error") || "Review failed",
          ai_findings: @review.ai_findings
        }
      end

      def format_processing_review
        {
          success: true,
          review_id: @review.id,
          status: @review.status,
          message: "AI review in progress. Check back in 30-60 seconds."
        }
      end

      def format_review_summary(review)
        {
          id: review.id,
          status: review.status,
          confidence_score: review.confidence_score,
          total_discrepancies: review.total_discrepancies,
          reviewed_at: review.reviewed_at,
          created_at: review.created_at
        }
      end
    end
  end
end
