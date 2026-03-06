# frozen_string_literal: true

module Api
  module V1
    module Sda
      class ConflictOfInterestsController < ApplicationController
        before_action :set_record, only: [:show, :update, :destroy, :review]

        # GET /api/v1/sda/conflict_of_interests
        def index
          records = SdaConflictOfInterest
            .includes(:declarant_user, :declarant_contact, :related_property, :reviewed_by_user)
            .order(declaration_date: :desc)

          records = apply_filters(records)

          render_success(records.as_json(include: {
            declarant_user: { only: [:id, :name, :email] },
            declarant_contact: { only: [:id, :display_name] },
            related_property: { only: [:id, :name, :street_address] }
          }))
        end

        # GET /api/v1/sda/conflict_of_interests/:id
        def show
          render_success(@record.as_json(include: {
            declarant_user: { only: [:id, :name, :email] },
            declarant_contact: { only: [:id, :display_name] },
            related_property: { only: [:id, :name, :street_address] },
            related_contact: { only: [:id, :display_name] },
            reviewed_by_user: { only: [:id, :name, :email] }
          }))
        end

        # POST /api/v1/sda/conflict_of_interests
        def create
          record = SdaConflictOfInterest.new(record_params)

          if record.save
            render_success(record, status: :created)
          else
            render_validation_errors(record)
          end
        end

        # PATCH /api/v1/sda/conflict_of_interests/:id
        def update
          if @record.update(record_params)
            render_success(@record)
          else
            render_validation_errors(@record)
          end
        end

        # DELETE /api/v1/sda/conflict_of_interests/:id
        def destroy
          @record.destroy
          render_success
        end

        # POST /api/v1/sda/conflict_of_interests/:id/review
        def review
          attrs = {
            reviewed_by_user: current_user,
            reviewed_date: Date.current,
            reviewer_notes: params[:reviewer_notes],
            status: params[:new_status] || "managed"
          }

          if @record.update(attrs)
            render_success(@record)
          else
            render_validation_errors(@record)
          end
        end

        # GET /api/v1/sda/conflict_of_interests/needs_review
        def needs_review
          records = SdaConflictOfInterest
            .includes(:declarant_user, :declarant_contact, :related_property)
            .needs_review
            .order(review_date: :asc)

          render_success(records.as_json(include: {
            declarant_user: { only: [:id, :name, :email] },
            declarant_contact: { only: [:id, :display_name] },
            related_property: { only: [:id, :name, :street_address] }
          }))
        end

        private

        def set_record
          @record = SdaConflictOfInterest.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render_error("Conflict of interest not found", status: :not_found)
        end

        def record_params
          params.require(:sda_conflict_of_interest).permit(
            :declarant_type, :declarant_user_id, :declarant_contact_id,
            :declarant_name, :conflict_type, :status, :severity,
            :description, :parties_involved,
            :related_property_id, :related_contact_id,
            :management_plan, :mitigation_actions,
            :review_date, :resolved_date,
            :declaration_date
          )
        end

        def apply_filters(scope)
          scope = scope.where(declarant_type: params[:declarant_type]) if params[:declarant_type].present?
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where(severity: params[:severity]) if params[:severity].present?
          scope = scope.where(conflict_type: params[:conflict_type]) if params[:conflict_type].present?
          scope
        end
      end
    end
  end
end
