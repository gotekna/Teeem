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

      # GET /api/v1/pdf_field_positions/detect_fields
      # Parse PDF to detect form fields (AcroForms) with positions and sizes
      # Used by the masterpiece field editor to show clickable hotspots
      def detect_fields
        template_key = params[:template]

        unless template_key.present?
          return render json: { success: false, error: "Template key required" }, status: :bad_request
        end

        result = PdfFormParserService.parse(template_key)

        if result[:success]
          render json: {
            success: true,
            detected_fields: result[:detected_fields],
            total_count: result[:total_count],
            pages: result[:pages]
          }
        else
          render json: { success: false, error: result[:error] }, status: :unprocessable_entity
        end
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

      # GET /api/v1/pdf_field_positions/preview_values
      # Returns computed field values for a job (for preview in field editor)
      # Params: template (required), job_id (required)
      def preview_values
        template_key = params[:template]&.to_sym
        job_id = params[:job_id]

        unless template_key.present? && job_id.present?
          return render json: { success: false, error: "template and job_id required" }, status: :bad_request
        end

        job = Job.find_by(id: job_id)
        unless job
          return render json: { success: false, error: "Job not found" }, status: :not_found
        end

        # Get computed values from PDF overlay engine
        engine = Engines::PdfOverlayEngine.new(template_key)
        values = engine.compute_preview_values(job: job)

        render json: {
          success: true,
          values: values,
          job: { id: job.id, name: job.name }
        }
      rescue StandardError => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # GET /api/v1/pdf_field_positions/template
      # Returns the blank PDF template (no form fields filled)
      # Params: template (required)
      def template
        template_key = params[:template]

        unless template_key.present?
          return render json: { success: false, error: "Template key required" }, status: :bad_request
        end

        # Map template key to file path
        template_paths = {
          "qbcc_contract" => Rails.root.join("app/views/tekna_documents/templates/qbcc/qbcc_contract.pdf"),
          "qbcc_consumer_guide" => Rails.root.join("app/views/tekna_documents/templates/qbcc/qbcc_consumer_guide.pdf"),
          "qbcc_general_conditions" => Rails.root.join("app/views/tekna_documents/templates/qbcc/qbcc_general_conditions.pdf")
        }

        pdf_path = template_paths[template_key]

        unless pdf_path && File.exist?(pdf_path)
          return render json: { success: false, error: "Template not found: #{template_key}" }, status: :not_found
        end

        send_file pdf_path,
                  filename: "#{template_key}.pdf",
                  type: "application/pdf",
                  disposition: "inline"
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
