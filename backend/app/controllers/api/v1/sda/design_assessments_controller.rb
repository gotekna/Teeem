# frozen_string_literal: true

module Api
  module V1
    module Sda
      class DesignAssessmentsController < ApplicationController
        before_action :set_design_assessment, only: [:show, :update, :destroy]

        # GET /api/v1/sda/design_assessments
        def index
          assessments = SdaDesignAssessment.includes(:property).order(created_at: :desc)
          assessments = apply_filters(assessments)

          render_success(assessments.as_json(include: {
            property: { only: [:id, :name, :street_address, :suburb] }
          }))
        end

        # GET /api/v1/sda/design_assessments/:id
        def show
          render_success(@design_assessment.as_json(include: {
            property: { only: [:id, :name, :street_address, :suburb, :sda_category] }
          }))
        end

        # POST /api/v1/sda/design_assessments
        def create
          assessment = SdaDesignAssessment.new(design_assessment_params)

          if assessment.save
            render_success(assessment, status: :created)
          else
            render_validation_errors(assessment)
          end
        end

        # PATCH /api/v1/sda/design_assessments/:id
        def update
          if @design_assessment.update(design_assessment_params)
            render_success(@design_assessment)
          else
            render_validation_errors(@design_assessment)
          end
        end

        # DELETE /api/v1/sda/design_assessments/:id
        def destroy
          @design_assessment.destroy
          render_success
        end

        private

        def set_design_assessment
          @design_assessment = SdaDesignAssessment.find(params[:id])
        end

        def design_assessment_params
          params.require(:sda_design_assessment).permit(
            :property_id, :status, :design_standard_version,
            :assessment_date, :assessor_name, :assessor_organisation,
            :total_items_assessed, :compliant_items, :non_compliant_items,
            :modification_deadline, :certificate_blob_id,
            :notes, :recommendations
          )
        end

        def apply_filters(scope)
          scope = scope.where(property_id: params[:property_id]) if params[:property_id].present?
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope
        end
      end
    end
  end
end
