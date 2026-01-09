module Api
  module V1
    module External
      class UnrealEstimatesController < ApplicationController
        before_action :authenticate_api_key!

        def create
          ActiveRecord::Base.transaction do
            # Create estimate record
            estimate = Estimate.new(
              source: "unreal_engine",
              estimator_name: params[:estimator],
              job_name_from_source: params[:job_name],
              total_items: params[:materials]&.length || 0
            )

            # Create line items
            if params[:materials].present?
              params[:materials].each do |material|
                estimate.estimate_line_items.build(
                  category: material[:category],
                  item_description: material[:item],
                  quantity: material[:quantity] || 1.0,
                  unit: material[:unit] || "ea",
                  notes: material[:notes]
                )
              end
            end

            # Try to match to a construction job
            matcher_result = JobMatcherService.new(params[:job_name]).call

            if matcher_result[:success]
              case matcher_result[:status]
              when :auto_matched
                matched_job = matcher_result[:matched_job]
                construction = Job.find(matched_job[:id])
                estimate.match_to_construction!(construction, matched_job[:confidence_score])

                estimate.save!

                # Trigger OneDrive folder creation if not already created
                construction.create_folders_if_needed!

                render json: {
                  success: true,
                  estimate_id: estimate.id,
                  matched_job: {
                    id: construction.id,
                    title: construction.title,
                    confidence_score: matched_job[:confidence_score]
                  },
                  status: "matched",
                  total_items: estimate.total_items,
                  message: "Estimate matched to job ##{construction.id} with #{matched_job[:confidence_score].round(1)}% confidence"
                }, status: :created

              when :suggest_candidates
                estimate.save!

                render json: {
                  success: true,
                  estimate_id: estimate.id,
                  status: "pending",
                  candidate_jobs: matcher_result[:candidate_jobs].map do |candidate|
                    {
                      id: candidate[:id],
                      title: candidate[:title],
                      confidence_score: candidate[:confidence_score]
                    }
                  end,
                  total_items: estimate.total_items,
                  message: "Multiple job matches found. Please select the correct job manually."
                }, status: :created

              when :no_match
                estimate.save!

                render json: {
                  success: true,
                  estimate_id: estimate.id,
                  status: "pending",
                  message: "No matching job found. Please create the job or match manually.",
                  job_name_searched: params[:job_name],
                  total_items: estimate.total_items
                }, status: :created
              end
            else
              render json: {
                success: false,
                error: matcher_result[:error] || "Failed to match job"
              }, status: :unprocessable_entity
            end
          end

        rescue ActiveRecord::RecordInvalid => e
          render json: {
            success: false,
            error: e.message,
            details: e.record.errors.full_messages
          }, status: :unprocessable_entity

        rescue => e
          Rails.logger.error "Unreal Estimate Import Error: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")

          render json: {
            success: false,
            error: "An error occurred while importing the estimate",
            details: e.message
          }, status: :internal_server_error
        end

        private

        def authenticate_api_key!
          api_key = request.headers["X-API-Key"]

          if api_key.blank?
            render json: {
              success: false,
              error: "API key required. Please include X-API-Key header."
            }, status: :unauthorized
            return
          end

          integration = ExternalIntegration.find_by_api_key(api_key)

          if integration.nil?
            render json: {
              success: false,
              error: "Invalid API key"
            }, status: :unauthorized
            return
          end

          # Record usage
          integration.record_usage!

          @current_integration = integration
        end
      end
    end
  end
end
