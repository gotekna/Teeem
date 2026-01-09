# frozen_string_literal: true

module Api
  module V1
    class TeknaDocumentsController < ApplicationController
      # Allow unauthenticated access for viewing templates and previews
      skip_before_action :authorize_request, only: [ :templates, :preview ]
      before_action :set_job, only: [ :preview, :generate ]
      before_action :set_contact, only: [ :preview, :generate ]

      # GET /api/v1/tekna_documents/templates
      # Lists all available document templates
      def templates
        templates = TeknaDocumentGenerator::TEMPLATES.map do |key, config|
          {
            key: key.to_s,
            name: key.to_s.titleize,
            category: config[:category],
            layout: config[:layout],
            requires: config[:requires]
          }
        end

        render json: { success: true, data: templates }
      end

      # GET /api/v1/tekna_documents/:id/preview
      # Returns HTML preview for a template
      def preview
        template_key = params[:id].to_sym

        unless TeknaDocumentGenerator::TEMPLATES.key?(template_key)
          return render json: { success: false, error: "Template not found: #{params[:id]}" }, status: :not_found
        end

        generator = TeknaDocumentGenerator.new(template_key)
        html = generator.preview(
          job: @job,
          contact: @contact,
          extra_data: extra_data_params
        )

        if params[:format] == "html" || request.format.html?
          render html: html.html_safe, layout: false
        else
          render json: { success: true, data: { html: html } }
        end
      rescue StandardError => e
        Rails.logger.error("TeknaDocuments preview error: #{e.message}")
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/tekna_documents/:id/generate
      # Generates PDF and returns for download
      def generate
        template_key = params[:id].to_sym

        unless TeknaDocumentGenerator::TEMPLATES.key?(template_key)
          return render json: { success: false, error: "Template not found: #{params[:id]}" }, status: :not_found
        end

        generator = TeknaDocumentGenerator.new(template_key)
        result = generator.generate(
          job: @job,
          contact: @contact,
          extra_data: extra_data_params
        )

        send_data result[:pdf_content],
                  filename: result[:filename],
                  type: "application/pdf",
                  disposition: params[:inline] ? "inline" : "attachment"
      rescue StandardError => e
        Rails.logger.error("TeknaDocuments generate error: #{e.message}")
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/tekna_documents/:id/generate_and_send
      # Generates PDF and sends for e-signature
      def generate_and_send
        template_key = params[:id].to_sym

        unless TeknaDocumentGenerator::TEMPLATES.key?(template_key)
          return render json: { success: false, error: "Template not found: #{params[:id]}" }, status: :not_found
        end

        # Generate the PDF
        generator = TeknaDocumentGenerator.new(template_key)
        result = generator.generate(
          job: @job,
          contact: @contact,
          extra_data: extra_data_params
        )

        # Store the document
        document = store_document(result, template_key)

        # Send for e-signature if requested
        if params[:send_for_signature]
          send_for_signature(document)
        end

        render json: {
          success: true,
          data: {
            document_id: document.id,
            filename: result[:filename],
            message: params[:send_for_signature] ? "Document generated and sent for signature" : "Document generated"
          }
        }
      rescue StandardError => e
        Rails.logger.error("TeknaDocuments generate_and_send error: #{e.message}")
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      private

      def set_job
        @job = Job.find(params[:job_id]) if params[:job_id].present?
      end

      def set_contact
        @contact = Contact.find(params[:contact_id]) if params[:contact_id].present?
      end

      def extra_data_params
        params.permit(:variation_number, :variation_description, variation_items: [ :description, :amount ]).to_h.symbolize_keys
      end

      def store_document(result, template_key)
        # Create a Document record for tracking
        Document.create!(
          job: @job,
          name: result[:filename],
          document_type: template_key.to_s,
          status: "generated",
          generated_at: Time.current
        )
      end

      def send_for_signature(document)
        # Integration with existing e-signature system
        # This would connect to Annature or other e-sign provider
        # For now, just update the document status
        document.update!(status: "pending_signature")
      end
    end
  end
end
