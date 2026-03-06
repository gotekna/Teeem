# frozen_string_literal: true

module Api
  module V1
    module Sda
      class OutcomesController < ApplicationController
        before_action :set_outcome, only: [:show, :update, :destroy]

        # GET /api/v1/sda/outcomes
        def index
          outcomes = SdaParticipantOutcome.includes(:property, :contact, :tenancy, :assessed_by_user)
                                          .order(assessment_date: :desc)
          outcomes = apply_filters(outcomes)

          render_success(outcomes.as_json(include: {
            property: { only: [:id, :name, :street_address] },
            contact: { only: [:id, :display_name] },
            tenancy: { only: [:id] },
            assessed_by_user: { only: [:id, :full_name] }
          }))
        end

        # GET /api/v1/sda/outcomes/:id
        def show
          render_success(@outcome.as_json(include: {
            property: { only: [:id, :name, :street_address] },
            contact: { only: [:id, :display_name, :email, :phone] },
            tenancy: { only: [:id] },
            assessed_by_user: { only: [:id, :full_name, :email] }
          }))
        end

        # POST /api/v1/sda/outcomes
        def create
          outcome = SdaParticipantOutcome.new(outcome_params)

          if outcome.save
            render_success(outcome, status: :created)
          else
            render_validation_errors(outcome)
          end
        end

        # PATCH /api/v1/sda/outcomes/:id
        def update
          if @outcome.update(outcome_params)
            render_success(@outcome)
          else
            render_validation_errors(@outcome)
          end
        end

        # DELETE /api/v1/sda/outcomes/:id
        def destroy
          @outcome.destroy
          render_success
        end

        # GET /api/v1/sda/outcomes/summary
        # Returns average ratings per property across all outcomes.
        def summary
          property_ids = params[:property_id].present? ? [params[:property_id]] : nil

          scope = SdaParticipantOutcome.all
          scope = scope.where(property_id: property_ids) if property_ids

          data = scope.group(:property_id).select(
            :property_id,
            "AVG(overall_satisfaction) AS avg_overall_satisfaction",
            "AVG(housing_quality_rating) AS avg_housing_quality_rating",
            "AVG(maintenance_response_rating) AS avg_maintenance_response_rating",
            "AVG(safety_rating) AS avg_safety_rating",
            "AVG(independence_rating) AS avg_independence_rating",
            "AVG(community_access_rating) AS avg_community_access_rating",
            "COUNT(*) AS outcome_count"
          )

          property_map = Property.where(id: data.map(&:property_id))
                                 .index_by(&:id)

          result = data.map do |row|
            property = property_map[row.property_id]
            ratings = [
              row.avg_overall_satisfaction,
              row.avg_housing_quality_rating,
              row.avg_maintenance_response_rating,
              row.avg_safety_rating,
              row.avg_independence_rating,
              row.avg_community_access_rating
            ].compact.map(&:to_f)

            overall_avg = ratings.any? ? (ratings.sum / ratings.length).round(1) : nil

            {
              propertyId: row.property_id,
              propertyName: property&.name || property&.street_address,
              outcomeCount: row.outcome_count.to_i,
              averageRatings: {
                overallSatisfaction: row.avg_overall_satisfaction&.to_f&.round(1),
                housingQuality: row.avg_housing_quality_rating&.to_f&.round(1),
                maintenanceResponse: row.avg_maintenance_response_rating&.to_f&.round(1),
                safety: row.avg_safety_rating&.to_f&.round(1),
                independence: row.avg_independence_rating&.to_f&.round(1),
                communityAccess: row.avg_community_access_rating&.to_f&.round(1)
              },
              overallAverage: overall_avg
            }
          end

          render_success(result)
        end

        private

        def set_outcome
          @outcome = SdaParticipantOutcome.find(params[:id])
        end

        def outcome_params
          params.require(:sda_participant_outcome).permit(
            :property_id, :contact_id, :tenancy_id, :assessed_by_user_id,
            :outcome_type, :assessment_date, :goals_status, :notes,
            :overall_satisfaction, :housing_quality_rating,
            :maintenance_response_rating, :safety_rating,
            :independence_rating, :community_access_rating,
            :next_review_date
          )
        end

        def apply_filters(scope)
          scope = scope.where(property_id: params[:property_id]) if params[:property_id].present?
          scope = scope.where(contact_id: params[:contact_id]) if params[:contact_id].present?
          scope = scope.where(outcome_type: params[:outcome_type]) if params[:outcome_type].present?
          scope
        end
      end
    end
  end
end
