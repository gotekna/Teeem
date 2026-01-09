# frozen_string_literal: true

module Api
  module V1
    class JobSpecificationsController < ApplicationController
      before_action :set_job
      before_action :set_specification, only: [:show, :update, :destroy]

      # GET /api/v1/jobs/:job_id/specifications
      def index
        specifications = @job.job_specifications
          .includes(:pricebook_item)
          .order(:section_key, :position)

        # Group by section for easier frontend consumption
        grouped = specifications.group_by(&:section_key).transform_values do |items|
          items.map(&:as_json)
        end

        render json: {
          success: true,
          data: {
            specifications: grouped,
            flat_list: specifications.as_json,
            job_id: @job.id,
            job_type: @job.job_type&.name
          }
        }
      end

      # GET /api/v1/jobs/:job_id/specifications/:id
      def show
        render json: { success: true, data: @specification.as_json }
      end

      # POST /api/v1/jobs/:job_id/specifications
      def create
        specification = @job.job_specifications.find_or_initialize_by(
          section_key: specification_params[:section_key],
          item_key: specification_params[:item_key]
        )
        specification.assign_attributes(specification_params)

        if specification.save
          render json: { success: true, data: specification.as_json }, status: :created
        else
          render json: { success: false, error: specification.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/jobs/:job_id/specifications/:id
      def update
        if @specification.update(specification_params)
          render json: { success: true, data: @specification.as_json }
        else
          render json: { success: false, error: @specification.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/jobs/:job_id/specifications/:id
      def destroy
        @specification.destroy
        render json: { success: true, message: "Specification deleted" }
      end

      # POST /api/v1/jobs/:job_id/specifications/initialize_from_template
      def initialize_from_template
        template = SpecificationTemplate.for_job_type(@job.job_type_id)

        unless template
          return render json: { success: false, error: "No template found for this job type" }, status: :not_found
        end

        # Clear existing specifications if requested
        @job.job_specifications.destroy_all if params[:clear_existing]

        # Create specifications from template sections
        created = []
        template.section_list.each do |section|
          section_key = section["key"]
          (section["items"] || []).each_with_index do |item, idx|
            spec = @job.job_specifications.find_or_create_by(
              section_key: section_key,
              item_key: item["key"]
            ) do |s|
              s.position = idx
            end
            created << spec
          end
        end

        render json: {
          success: true,
          data: {
            template_name: template.name,
            specifications_created: created.count,
            specifications: created.map(&:as_json)
          }
        }
      end

      # POST /api/v1/jobs/:job_id/specifications/bulk_update
      def bulk_update
        updates = params[:specifications] || []
        results = []

        updates.each do |spec_params|
          spec = @job.job_specifications.find_or_initialize_by(
            section_key: spec_params[:section_key],
            item_key: spec_params[:item_key]
          )
          spec.assign_attributes(spec_params.permit(:pricebook_item_id, :custom_value, :notes, :position))
          results << { success: spec.save, specification: spec.as_json, errors: spec.errors.full_messages }
        end

        render json: {
          success: results.all? { |r| r[:success] },
          data: results
        }
      end

      # GET /api/v1/jobs/:job_id/specifications/generate_pdf
      def generate_pdf
        generator = TeknaDocumentGenerator.new(:specifications)
        result = generator.generate(job: @job)

        if params[:format] == "html" || params[:preview]
          render html: result[:html].html_safe
        else
          send_data result[:pdf],
                    filename: result[:filename],
                    type: "application/pdf",
                    disposition: params[:download] ? "attachment" : "inline"
        end
      rescue StandardError => e
        Rails.logger.error "PDF generation failed: #{e.message}"
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end

      def set_specification
        @specification = @job.job_specifications.find(params[:id])
      end

      def specification_params
        params.require(:specification).permit(
          :section_key,
          :item_key,
          :pricebook_item_id,
          :custom_value,
          :notes,
          :position
        )
      end
    end
  end
end
