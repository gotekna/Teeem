# frozen_string_literal: true

module Api
  module V1
    class PdfFieldPositionsController < ApplicationController
      before_action :set_pdf_field_position, only: [:show, :update, :destroy]

      # GET /api/v1/pdf_field_positions
      # Params: template (required) - filter by pdf_template_key
      def index
        @positions = PdfFieldPosition.active

        if params[:template].present?
          @positions = @positions.for_template(params[:template])
        end

        @positions = @positions.order(:page, :field_key)

        render json: {
          success: true,
          data: {
            positions: @positions.map { |p| position_json(p) },
            templates: PdfFieldPosition::TEMPLATE_KEYS
          }
        }
      end

      # GET /api/v1/pdf_field_positions/:id
      def show
        render json: { success: true, data: position_json(@position) }
      end

      # POST /api/v1/pdf_field_positions
      def create
        @position = PdfFieldPosition.new(position_params)

        if @position.save
          render json: { success: true, data: position_json(@position) }, status: :created
        else
          render json: { success: false, error: @position.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/pdf_field_positions/:id
      def update
        Rails.logger.info "[PDF] Update called for position #{@position.id}"
        Rails.logger.info "[PDF] Raw params: #{params.inspect}"
        Rails.logger.info "[PDF] Position params: #{position_params.inspect}"

        if @position.update(position_params)
          Rails.logger.info "[PDF] Update successful! New coords: x=#{@position.x}, y=#{@position.y}"
          render json: { success: true, data: position_json(@position) }
        else
          Rails.logger.error "[PDF] Update failed! Errors: #{@position.errors.full_messages.join(', ')}"
          render json: { success: false, error: @position.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      rescue StandardError => e
        Rails.logger.error "[PDF] Exception in update: #{e.class} - #{e.message}"
        Rails.logger.error e.backtrace.first(5).join("\n")
        raise
      end

      # DELETE /api/v1/pdf_field_positions/:id
      def destroy
        @position.destroy
        head :no_content
      end

      # POST /api/v1/pdf_field_positions/preview
      # Generate a preview PDF with current field positions
      # Params: template (required), job_id (optional)
      def preview
        template_key = params[:template]&.to_sym

        unless PdfFieldPosition::TEMPLATE_KEYS.include?(template_key.to_s)
          return render json: { success: false, error: "Invalid template key" }, status: :bad_request
        end

        job = params[:job_id].present? ? Job.find_by(id: params[:job_id]) : Job.first

        engine = Engines::PdfOverlayEngine.new(template_key)
        pdf_content = engine.generate(job: job)

        # Return as base64 for frontend display or save to temp file
        send_data pdf_content,
                  filename: "preview_#{template_key}_#{Time.current.to_i}.pdf",
                  type: "application/pdf",
                  disposition: "inline"
      rescue StandardError => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/pdf_field_positions/bulk_update
      # Update multiple positions at once
      def bulk_update
        positions_data = params[:positions] || []
        updated = []
        errors = []

        positions_data.each do |pos_data|
          position = PdfFieldPosition.find_by(id: pos_data[:id])
          if position
            if position.update(pos_data.permit(:x, :y, :page, :font_size, :active))
              updated << position_json(position)
            else
              errors << { id: pos_data[:id], error: position.errors.full_messages.join(", ") }
            end
          else
            errors << { id: pos_data[:id], error: "Position not found" }
          end
        end

        render json: {
          success: errors.empty?,
          data: { updated: updated, errors: errors }
        }
      end

      private

      def set_pdf_field_position
        Rails.logger.info "[PDF] set_pdf_field_position called with id: #{params[:id]}"
        @position = PdfFieldPosition.find(params[:id])
        Rails.logger.info "[PDF] Found position: #{@position.inspect}"
      end

      def position_params
        params.require(:pdf_field_position).permit(
          :pdf_template_key, :field_key, :display_name,
          :page, :x, :y, :font_size, :test_value, :active,
          :box_width, :box_height, :text_align
        )
      end

      def position_json(position)
        {
          id: position.id,
          pdf_template_key: position.pdf_template_key,
          field_key: position.field_key,
          display_name: position.display_name,
          page: position.page,
          x: position.x.to_f,
          y: position.y.to_f,
          font_size: position.font_size,
          test_value: position.test_value,
          active: position.active,
          box_width: position.box_width,
          box_height: position.box_height,
          text_align: position.text_align || "left",
          updated_at: position.updated_at
        }
      end
    end
  end
end
