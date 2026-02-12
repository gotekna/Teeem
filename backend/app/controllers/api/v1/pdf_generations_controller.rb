# frozen_string_literal: true

module Api
  module V1
    class PdfGenerationsController < ApplicationController
      # GET /api/v1/pdf_generations
      # List recent PDF generations, optionally filtered by generator_type and status
      # Used to resume in-progress generations (e.g., Director Change wizard reopened)
      def index
        scope = PdfGeneration.where(tenant_id: current_tenant&.id)

        scope = scope.where(generator_type: params[:generator_type]) if params[:generator_type].present?
        # Support comma-separated statuses: ?status=pending,processing,completed
        if params[:status].present?
          statuses = params[:status].to_s.split(",").map(&:strip)
          scope = scope.where(status: statuses)
        end

        # Filter by generator_params key/value (e.g., company_id=36)
        if params[:params_filter].present?
          params[:params_filter].each do |key, value|
            scope = scope.where("generator_params->>? = ?", key.to_s, value.to_s)
          end
        end

        pdf_gens = scope.order(created_at: :desc).limit(params[:limit] || 5)

        render json: {
          success: true,
          data: pdf_gens.map { |pg| serialize(pg) }
        }
      end

      # POST /api/v1/pdf_generations
      # Enqueue a new PDF generation job
      def create
        pdf_gen = PdfGeneration.create!(
          generator_type: params[:generator_type],
          generator_params: params[:generator_params]&.to_unsafe_h || {},
          user: current_user,
          tenant: current_tenant,
          status: "pending"
        )

        GeneratePdfJob.perform_later(pdf_gen.id)

        render json: {
          success: true,
          data: serialize(pdf_gen)
        }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/pdf_generations/:id
      # Check status of a PDF generation (polling endpoint)
      def show
        pdf_gen = PdfGeneration.find(params[:id])

        unless pdf_gen.user_id == current_user&.id || pdf_gen.tenant_id == current_tenant&.id
          return render json: { success: false, error: "Not found" }, status: :not_found
        end

        render json: {
          success: true,
          data: serialize(pdf_gen)
        }
      end

      # PATCH /api/v1/pdf_generations/:id/cancel
      # Cancel a pending or processing PDF generation
      def cancel
        pdf_gen = PdfGeneration.find(params[:id])

        unless pdf_gen.tenant_id == current_tenant&.id
          return render json: { success: false, error: "Not found" }, status: :not_found
        end

        unless pdf_gen.pending_or_processing?
          return render json: { success: false, error: "Cannot cancel - status is #{pdf_gen.status}" }, status: :unprocessable_entity
        end

        pdf_gen.update!(status: "failed", error_message: "Cancelled by user")

        render json: { success: true, data: serialize(pdf_gen) }
      end

      # GET /api/v1/pdf_generations/:id/download
      # Download the generated PDF (redirects to presigned URL or streams inline)
      def download
        pdf_gen = PdfGeneration.find(params[:id])

        unless pdf_gen.user_id == current_user&.id || pdf_gen.tenant_id == current_tenant&.id
          return render json: { success: false, error: "Not found" }, status: :not_found
        end

        if pdf_gen.pending_or_processing?
          render html: waiting_page(pdf_gen).html_safe, content_type: "text/html"
          return
        end

        if pdf_gen.failed?
          render json: { success: false, error: pdf_gen.error_message || "Generation failed" }, status: :unprocessable_entity
          return
        end

        # ⚠️ DO NOT SIMPLIFY - Stream vs Redirect (Feb 2026)
        # ════════════════════════════════════════════════════════════
        # Why: fetch() following a redirect to S3/Wasabi presigned URL gets
        #      blocked by CORS (S3 doesn't return Access-Control-Allow-Origin).
        # ❌ WRONG: Always redirect_to presigned URL — breaks frontend fetch()
        # ✅ CORRECT: Stream content for API requests (Authorization header),
        #            redirect for browser navigation (no auth header)
        # ════════════════════════════════════════════════════════════
        stream_directly = request.headers["Authorization"].present? || params[:stream] == "true"

        if stream_directly && pdf_gen.storage_blob
          send_data pdf_gen.storage_blob.download,
                    filename: pdf_gen.result_filename || "document.pdf",
                    type: "application/pdf",
                    disposition: params[:inline] ? "inline" : "attachment"
        elsif (url = pdf_gen.download_url)
          redirect_to url, allow_other_host: true
        elsif pdf_gen.storage_blob
          send_data pdf_gen.storage_blob.download,
                    filename: pdf_gen.result_filename || "document.pdf",
                    type: "application/pdf",
                    disposition: params[:inline] ? "inline" : "attachment"
        else
          render json: { success: false, error: "PDF not available" }, status: :not_found
        end
      end

      private

      def serialize(pdf_gen)
        data = {
          id: pdf_gen.id,
          status: pdf_gen.status,
          generatorType: pdf_gen.generator_type,
          filename: pdf_gen.result_filename,
          createdAt: pdf_gen.created_at&.iso8601,
          updatedAt: pdf_gen.updated_at&.iso8601,
          userName: pdf_gen.user&.display_name
        }

        # Include company context from generator_params (for cross-company lists)
        if pdf_gen.generator_params["company_id"].present?
          company = Corporate.find_by(id: pdf_gen.generator_params["company_id"])
          data[:companyName] = company&.name
          data[:companyId] = pdf_gen.generator_params["company_id"].to_s
        end

        if pdf_gen.completed?
          data[:downloadUrl] = download_api_v1_pdf_generation_path(pdf_gen)
        end

        data[:error] = pdf_gen.error_message if pdf_gen.failed?

        # Include result data from generator (e.g., e-sig request info, documents list)
        if pdf_gen.completed? && pdf_gen.generator_params["_result"].present?
          data[:result] = pdf_gen.generator_params["_result"]
        end

        data
      end

      def waiting_page(pdf_gen)
        <<~HTML
          <!DOCTYPE html>
          <html>
          <head>
            <title>Generating PDF...</title>
            <meta http-equiv="refresh" content="2">
            <style>
              body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
              .container { text-align: center; padding: 2rem; }
              .spinner { width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
              @keyframes spin { to { transform: rotate(360deg); } }
              h2 { color: #374151; margin-bottom: 0.5rem; }
              p { color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="spinner"></div>
              <h2>Generating PDF</h2>
              <p>This page will refresh automatically...</p>
            </div>
          </body>
          </html>
        HTML
      end
    end
  end
end
