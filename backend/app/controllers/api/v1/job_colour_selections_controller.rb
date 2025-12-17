# frozen_string_literal: true

module Api
  module V1
    class JobColourSelectionsController < ApplicationController
      before_action :set_job
      before_action :set_colour_selection, only: [:show, :update, :destroy]

      # GET /api/v1/jobs/:job_id/colour_selections
      def index
        selections = @job.job_colour_selections
          .includes(:pricebook_item)
          .order(:category_key, :position)

        # Group by category for easier frontend consumption
        grouped = selections.group_by(&:category_key).transform_values do |items|
          items.map(&:as_json)
        end

        render json: {
          success: true,
          data: {
            colour_selections: grouped,
            flat_list: selections.as_json,
            job_id: @job.id,
            job_type: @job.job_type&.name
          }
        }
      end

      # GET /api/v1/jobs/:job_id/colour_selections/:id
      def show
        render json: { success: true, data: @colour_selection.as_json }
      end

      # POST /api/v1/jobs/:job_id/colour_selections
      def create
        selection = @job.job_colour_selections.find_or_initialize_by(
          category_key: colour_selection_params[:category_key],
          item_key: colour_selection_params[:item_key]
        )
        selection.assign_attributes(colour_selection_params)

        if selection.save
          render json: { success: true, data: selection.as_json }, status: :created
        else
          render json: { success: false, error: selection.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/jobs/:job_id/colour_selections/:id
      def update
        if @colour_selection.update(colour_selection_params)
          render json: { success: true, data: @colour_selection.as_json }
        else
          render json: { success: false, error: @colour_selection.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/jobs/:job_id/colour_selections/:id
      def destroy
        @colour_selection.destroy
        render json: { success: true, message: "Colour selection deleted" }
      end

      # POST /api/v1/jobs/:job_id/colour_selections/initialize_from_template
      def initialize_from_template
        template = ColourSelectionTemplate.for_job_type(@job.job_type_id)

        unless template
          return render json: { success: false, error: "No template found for this job type" }, status: :not_found
        end

        # Clear existing selections if requested
        @job.job_colour_selections.destroy_all if params[:clear_existing]

        # Create colour selections from template categories
        created = []
        template.category_list.each do |category|
          category_key = category["key"]
          (category["items"] || []).each_with_index do |item, idx|
            selection = @job.job_colour_selections.find_or_create_by(
              category_key: category_key,
              item_key: item["key"]
            ) do |s|
              s.position = idx
            end
            created << selection
          end
        end

        render json: {
          success: true,
          data: {
            template_name: template.name,
            selections_created: created.count,
            colour_selections: created.map(&:as_json)
          }
        }
      end

      # POST /api/v1/jobs/:job_id/colour_selections/bulk_update
      def bulk_update
        updates = params[:colour_selections] || []
        results = []

        updates.each do |selection_params|
          selection = @job.job_colour_selections.find_or_initialize_by(
            category_key: selection_params[:category_key],
            item_key: selection_params[:item_key]
          )
          selection.assign_attributes(
            selection_params.permit(:pricebook_item_id, :colour_name, :colour_code, :colour_brand, :notes, :position)
          )
          results << { success: selection.save, colour_selection: selection.as_json, errors: selection.errors.full_messages }
        end

        render json: {
          success: results.all? { |r| r[:success] },
          data: results
        }
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end

      def set_colour_selection
        @colour_selection = @job.job_colour_selections.find(params[:id])
      end

      def colour_selection_params
        params.require(:colour_selection).permit(
          :category_key,
          :item_key,
          :pricebook_item_id,
          :colour_name,
          :colour_code,
          :colour_brand,
          :notes,
          :position
        )
      end
    end
  end
end
