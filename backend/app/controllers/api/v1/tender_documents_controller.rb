# frozen_string_literal: true

module Api
  module V1
    class TenderDocumentsController < ApplicationController
      include AsyncPdfGeneration

      before_action :set_job, only: [:index, :create]
      before_action :set_tender_document, only: [
        :show, :update, :destroy,
        :generate_pdf, :send_to_client,
        :request_revision, :accept, :decline,
        :diff
      ]

      # GET /api/v1/jobs/:job_id/tender_documents
      def index
        docs = @job.tender_documents
                   .includes(:created_by, :locked_by, :pdf_generation)
                   .order(version: :desc)

        render json: {
          success: true,
          data: {
            tender_documents: docs.map { |d| summary_json(d) },
            total_count: docs.count
          }
        }
      end

      # POST /api/v1/jobs/:job_id/tender_documents
      def create
        service = TenderDocumentService.new(job: @job, user: current_user)
        doc = service.create!

        render json: { success: true, data: doc.as_json }, status: :created
      rescue TenderDocumentService::CreationError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/tender_documents/:id
      def show
        render json: { success: true, data: @tender_document.as_json }
      end

      # PATCH /api/v1/tender_documents/:id
      def update
        unless @tender_document.editable?
          return render json: { success: false, error: "Only draft tender documents can be edited" }, status: :unprocessable_entity
        end

        if @tender_document.update(update_params)
          render json: { success: true, data: @tender_document.as_json }
        else
          render json: { success: false, error: @tender_document.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/tender_documents/:id
      def destroy
        unless @tender_document.status == "draft"
          return render json: { success: false, error: "Only draft tender documents can be deleted" }, status: :unprocessable_entity
        end

        @tender_document.destroy!
        render json: { success: true }
      end

      # POST /api/v1/tender_documents/:id/generate_pdf
      def generate_pdf
        pdf_gen = PdfGeneration.create!(
          user: current_user,
          tenant: current_tenant,
          generator_type: "tender_document",
          generator_params: { tender_document_id: @tender_document.id },
          status: "pending"
        )

        @tender_document.update!(pdf_generation: pdf_gen)
        GeneratePdfJob.perform_later(pdf_gen.id)

        render json: {
          success: true,
          data: {
            pdf_generation_id: pdf_gen.id,
            status: "pending"
          }
        }
      end

      # POST /api/v1/tender_documents/:id/send_to_client
      def send_to_client
        unless @tender_document.status.in?(%w[locked sent])
          return render json: { success: false, error: "Tender must be locked before sending" }, status: :unprocessable_entity
        end

        @tender_document.mark_sent!(current_user)
        render json: { success: true, data: @tender_document.as_json }
      end

      # POST /api/v1/tender_documents/:id/request_revision
      def request_revision
        unless @tender_document.status.in?(%w[locked sent])
          return render json: { success: false, error: "Can only request revision on locked/sent tenders" }, status: :unprocessable_entity
        end

        reason = params[:reason] || "Client requested changes"
        @tender_document.request_revision!(current_user, reason: reason)

        render json: { success: true, data: @tender_document.reload.as_json }
      end

      # POST /api/v1/tender_documents/:id/accept
      def accept
        unless @tender_document.status == "sent"
          return render json: { success: false, error: "Can only accept sent tenders" }, status: :unprocessable_entity
        end

        @tender_document.mark_accepted!
        render json: { success: true, data: @tender_document.as_json }
      end

      # POST /api/v1/tender_documents/:id/decline
      def decline
        unless @tender_document.status == "sent"
          return render json: { success: false, error: "Can only decline sent tenders" }, status: :unprocessable_entity
        end

        @tender_document.mark_declined!
        render json: { success: true, data: @tender_document.as_json }
      end

      # GET /api/v1/tender_documents/:id/diff/:other_id
      def diff
        other = TenderDocument.find(params[:other_id])

        # Group items by section for both documents
        current_sections = @tender_document.sections_grouped
        other_sections = other.sections_grouped

        all_section_names = (current_sections.keys + other_sections.keys).uniq.sort

        diff_data = all_section_names.map do |section_name|
          current_items = current_sections[section_name] || []
          other_items = other_sections[section_name] || []

          {
            section_name: section_name,
            current_items: current_items.map(&:as_json),
            other_items: other_items.map(&:as_json),
            current_subtotal: current_items.select { |i| i.item_type == "priced" }.sum(&:total_amount),
            other_subtotal: other_items.select { |i| i.item_type == "priced" }.sum(&:total_amount)
          }
        end

        render json: {
          success: true,
          data: {
            current_version: summary_json(@tender_document),
            other_version: summary_json(other),
            sections: diff_data,
            total_diff: @tender_document.total - other.total
          }
        }
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end

      def set_tender_document
        @tender_document = TenderDocument.find(params[:id])
      end

      def update_params
        params.permit(
          :cover_letter_html,
          :terms_and_conditions_html,
          :base_specification_html,
          :acceptance_page_html,
          :notes_html,
          :valid_until,
          :validity_days,
          settings: {}
        )
      end

      def summary_json(doc)
        {
          id: doc.id,
          document_number: doc.document_number,
          version: doc.version,
          status: doc.status,
          date_prepared: doc.date_prepared,
          valid_until: doc.valid_until,
          subtotal: doc.subtotal,
          gst: doc.gst,
          total: doc.total,
          job_name: doc.job_name,
          job_code: doc.job_code,
          client_name: doc.client_name,
          created_by_name: doc.created_by&.name,
          locked_at: doc.locked_at&.iso8601,
          sent_at: doc.sent_at&.iso8601,
          accepted_at: doc.accepted_at&.iso8601,
          declined_at: doc.declined_at&.iso8601,
          revision_notes: doc.revision_notes,
          has_pdf: doc.storage_blob.present?,
          pdf_status: doc.pdf_generation&.status,
          item_count: doc.tender_document_items.count,
          created_at: doc.created_at.iso8601,
          updated_at: doc.updated_at.iso8601
        }
      end
    end
  end
end
