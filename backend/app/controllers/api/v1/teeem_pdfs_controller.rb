# frozen_string_literal: true

module Api
  module V1
    class TeeemPdfsController < ApplicationController
      before_action :set_pdf, only: [:show, :update, :destroy]

      # GET /api/v1/teeem_pdfs
      # Optional params:
      #   - job_id: filter by job (returns PDFs attached to this job)
      #   - unattached: if "true", returns only PDFs not attached to any job
      def index
        pdfs = current_user.teeem_pdfs.user_pdfs.recent

        # Filter by job if specified
        if params[:job_id].present?
          pdfs = pdfs.for_job(params[:job_id])
        elsif params[:unattached] == "true"
          pdfs = pdfs.unattached
        end

        render json: {
          success: true,
          data: pdfs.map { |p| pdf_summary(p) }
        }
      end

      # GET /api/v1/teeem_pdfs/:id
      def show
        render json: {
          success: true,
          data: pdf_detail(@pdf)
        }
      end

      # POST /api/v1/teeem_pdfs
      def create
        pdf = current_user.teeem_pdfs.build(pdf_params)

        if pdf.save
          render json: {
            success: true,
            data: pdf_detail(pdf)
          }, status: :created
        else
          render json: {
            success: false,
            error: pdf.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/teeem_pdfs/:id
      def update
        # Update page_count from data if provided
        if params[:teeem_pdf][:data].present?
          params[:teeem_pdf][:page_count] = params[:teeem_pdf][:data]["pages"]&.length || 1
        end

        if @pdf.update(pdf_params)
          render json: {
            success: true,
            data: pdf_detail(@pdf)
          }
        else
          render json: {
            success: false,
            error: @pdf.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/teeem_pdfs/:id
      def destroy
        @pdf.destroy
        render json: { success: true }
      end

      private

      def set_pdf
        @pdf = current_user.teeem_pdfs.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "PDF not found" }, status: :not_found
      end

      def pdf_params
        params.require(:teeem_pdf).permit(:name, :is_template, :job_id, :description, :page_count, data: {})
      end

      def pdf_summary(pdf)
        {
          id: pdf.id,
          name: pdf.name,
          description: pdf.description,
          isTemplate: pdf.is_template,
          jobId: pdf.job_id,
          jobName: pdf.job&.name,
          pageCount: pdf.page_count,
          updatedAt: pdf.updated_at.iso8601,
          createdAt: pdf.created_at.iso8601
        }
      end

      def pdf_detail(pdf)
        {
          id: pdf.id,
          name: pdf.name,
          description: pdf.description,
          isTemplate: pdf.is_template,
          data: pdf.data,
          jobId: pdf.job_id,
          jobName: pdf.job&.name,
          pageCount: pdf.page_count,
          updatedAt: pdf.updated_at.iso8601,
          createdAt: pdf.created_at.iso8601
        }
      end
    end
  end
end
