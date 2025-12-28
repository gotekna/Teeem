# frozen_string_literal: true

module Api
  module V1
    class JobClaimsController < ApplicationController
      before_action :set_job, only: [ :index, :create ]
      before_action :set_job_claim, only: [ :show, :update, :destroy ]

      # GET /api/v1/jobs/:job_id/job_claims
      def index
        @job_claims = @job.job_claims.recent

        # Filter by status
        if params[:status].present?
          @job_claims = @job_claims.where(status: params[:status])
        end

        # Filter unpaid only
        if params[:unpaid] == "true"
          @job_claims = @job_claims.unpaid
        end

        render json: {
          success: true,
          job_claims: @job_claims.as_json(
            
            methods: [ :payment_percentage, :outstanding_amount ]
          )
        }
      end

      # GET /api/v1/job_claims/:id
      def show
        render json: {
          success: true,
          job_claim: @job_claim.as_json(
            
            methods: [ :payment_percentage, :outstanding_amount ],
            include: {
              job: {},
              contact: {}
            }
          )
        }
      end

      # POST /api/v1/jobs/:job_id/job_claims
      def create
        @job_claim = @job.job_claims.build(job_claim_params)

        if @job_claim.save
          render json: {
            success: true,
            job_claim: @job_claim.as_json(
              
              methods: [ :payment_percentage, :outstanding_amount ]
            )
          }, status: :created
        else
          render json: {
            success: false,
            errors: @job_claim.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/job_claims/:id
      def update
        if @job_claim.update(job_claim_params)
          render json: {
            success: true,
            job_claim: @job_claim.as_json(
              
              methods: [ :payment_percentage, :outstanding_amount ]
            )
          }
        else
          render json: {
            success: false,
            errors: @job_claim.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/job_claims/:id
      def destroy
        @job_claim.destroy
        render json: {
          success: true,
          message: "Job claim deleted successfully"
        }
      end

      # POST /api/v1/job_claims/bulk_delete
      # Batch delete with 1000 item cap for performance
      def bulk_delete
        ids = params[:ids]
        return render json: { success: false, error: "No IDs provided" }, status: :bad_request if ids.blank?

        # Cap at 1000 items per request to prevent abuse
        ids = ids.first(1000) if ids.is_a?(Array)

        job_claims = JobClaim.where(id: ids)
        deleted_count = 0
        errors = []

        job_claims.each do |job_claim|
          # Check if claim is linked to Xero (may want to preserve these)
          if job_claim.xero_invoice_id.present? && params[:force] != "true"
            errors << { id: job_claim.id, invoice_number: job_claim.invoice_number, error: "Linked to Xero invoice" }
            next
          end

          job_claim.destroy
          deleted_count += 1
        end

        render json: {
          success: errors.empty?,
          deleted_count: deleted_count,
          requested_count: ids.size,
          errors: errors.presence
        }
      end

      # POST /api/v1/job_claims/bulk_create
      # Batch create with 1000 item cap for performance
      def bulk_create
        claims_data = params[:claims]
        return render json: { success: false, error: "No claims data provided" }, status: :bad_request if claims_data.blank?

        # Cap at 1000 items per request
        claims_data = claims_data.first(1000) if claims_data.is_a?(Array)

        # Performance: Pre-cache all jobs to avoid N+1 find_by queries
        job_ids = claims_data.filter_map { |c| c[:job_id] }.uniq
        jobs_by_id = Job.where(id: job_ids).index_by(&:id)

        created_count = 0
        errors = []
        created_claims = []

        claims_data.each_with_index do |claim_data, index|
          job = jobs_by_id[claim_data[:job_id].to_i]
          unless job
            errors << { index: index, error: "Job not found: #{claim_data[:job_id]}" }
            next
          end

          job_claim = job.job_claims.build(
            invoice_number: claim_data[:invoice_number],
            description: claim_data[:description],
            amount: claim_data[:amount],
            amount_paid: claim_data[:amount_paid] || 0,
            status: claim_data[:status] || "draft",
            date: claim_data[:date],
            due_date: claim_data[:due_date],
            xero_invoice_id: claim_data[:xero_invoice_id],
            xero_contact_id: claim_data[:xero_contact_id],
            contact_name: claim_data[:contact_name],
            contact_id: claim_data[:contact_id]
          )

          if job_claim.save
            created_count += 1
            created_claims << job_claim.as_json
          else
            errors << { index: index, invoice_number: claim_data[:invoice_number], error: job_claim.errors.full_messages.join(", ") }
          end
        end

        render json: {
          success: errors.empty?,
          created_count: created_count,
          requested_count: claims_data.size,
          created_claims: created_claims,
          errors: errors.presence
        }
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Job not found" }, status: :not_found
      end

      def set_job_claim
        @job_claim = JobClaim.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Job claim not found" }, status: :not_found
      end

      def job_claim_params
        params.require(:job_claim).permit(
          :invoice_number,
          :description,
          :amount,
          :amount_paid,
          :status,
          :date,
          :due_date,
          :xero_invoice_id,
          :xero_contact_id,
          :contact_name,
          :contact_id
        )
      end
    end
  end
end
