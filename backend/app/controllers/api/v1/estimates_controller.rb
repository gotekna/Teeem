module Api
  module V1
    class EstimatesController < ApplicationController
      before_action :set_estimate, only: [ :show, :match, :destroy, :generate_purchase_orders ]

      def index
        estimates = Estimate.includes(:construction, :estimate_line_items)
                            .order(created_at: :desc)

        # Filter by status if provided
        estimates = estimates.where(status: params[:status]) if params[:status].present?

        render json: {
          success: true,
          data: estimates.map { |e| estimate_json(e) }
        }
      end

      def show
        render json: {
          success: true,
          data: estimate_json(@estimate, include_line_items: true)
        }
      end

      def match
        construction_id = params[:job_id]

        if construction_id.blank?
          render json: {
            success: false,
            error: "construction_id is required"
          }, status: :unprocessable_entity
          return
        end

        construction = Job.find_by(id: construction_id)

        if construction.nil?
          render json: {
            success: false,
            error: "Construction job with ID #{construction_id} not found"
          }, status: :not_found
          return
        end

        @estimate.match_to_construction!(construction, nil)

        # Trigger OneDrive folder creation if not already created
        construction.create_folders_if_needed!

        render json: {
          success: true,
          data: estimate_json(@estimate),
          message: "Estimate matched to #{construction.title}"
        }

      rescue ActiveRecord::RecordInvalid => e
        render json: {
          success: false,
          error: e.message,
          details: e.record.errors.full_messages
        }, status: :unprocessable_entity
      end

      def destroy
        @estimate.destroy!

        render json: {
          success: true,
          message: "Estimate deleted successfully"
        }
      end

      def generate_purchase_orders
        service = EstimateToPurchaseOrderService.new(@estimate)
        result = service.execute

        if result[:success]
          render json: result, status: :created
        else
          render json: { error: result[:error] }, status: :unprocessable_entity
        end
      end

      private

      def set_estimate
        @estimate = Estimate.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Estimate not found"
        }, status: :not_found
      end

      def estimate_json(estimate, include_line_items: false)
        json = {
          id: estimate.id,
          source: estimate.source,
          estimator_name: estimate.estimator_name,
          job_name_from_source: estimate.job_name_from_source,
          status: estimate.status,
          matched_automatically: estimate.matched_automatically,
          match_confidence_score: estimate.match_confidence_score,
          total_items: estimate.total_items,
          imported_at: estimate.imported_at,
          created_at: estimate.created_at,
          updated_at: estimate.updated_at
        }

        if estimate.construction.present?
          json[:construction] = {
            id: estimate.construction.id,
            title: estimate.construction.title
          }
        end

        if include_line_items
          json[:line_items] = estimate.estimate_line_items.map do |item|
            {
              id: item.id,
              category: item.category,
              item_description: item.item_description,
              quantity: item.quantity,
              unit: item.unit,
              notes: item.notes
            }
          end
        end

        json
      end
    end
  end
end
