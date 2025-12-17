# frozen_string_literal: true

module Api
  module V1
    class JobClaimStagesController < ApplicationController
      before_action :set_job
      before_action :set_stage, only: [:show, :update, :destroy, :match, :unmatch]

      # GET /api/v1/jobs/:job_id/claim_stages
      def index
        stages = @job.job_claim_stages.includes(:claim_stage_template, :external_invoice).ordered

        # Summary calculations
        contract_value = @job.contract_value.to_d
        total_expected = stages.sum(&:expected_amount).to_d
        total_invoiced = stages.sum(&:amount_invoiced).to_d
        total_paid = stages.sum(&:amount_paid).to_d

        render json: {
          success: true,
          data: {
            stages: stages.map { |s| stage_json(s) },
            summary: {
              contract_value: contract_value.to_f,
              total_expected: total_expected.to_f,
              total_invoiced: total_invoiced.to_f,
              total_paid: total_paid.to_f,
              remaining: (contract_value - total_paid).to_f,
              paid_percentage: contract_value.positive? ? ((total_paid / contract_value) * 100).round(1) : 0
            },
            available_invoices: available_invoices_json
          }
        }
      end

      # GET /api/v1/jobs/:job_id/claim_stages/:id
      def show
        render json: { success: true, data: stage_json(@stage) }
      end

      # POST /api/v1/jobs/:job_id/claim_stages
      # Create a custom stage
      def create
        @stage = @job.job_claim_stages.build(stage_params)
        @stage.is_custom = true

        # Calculate expected amount if percentage provided
        if @stage.percentage.present? && @job.contract_value.present?
          @stage.expected_amount = (@job.contract_value.to_d * @stage.percentage / 100).round(2)
        end

        # Auto-set sequence order
        unless @stage.sequence_order.present?
          max_order = @job.job_claim_stages.maximum(:sequence_order) || -1
          @stage.sequence_order = max_order + 1
        end

        if @stage.save
          render json: { success: true, data: stage_json(@stage) }, status: :created
        else
          render json: { success: false, error: @stage.errors.full_messages.join(", ") },
                 status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/jobs/:job_id/claim_stages/:id
      def update
        # If percentage changes, recalculate expected amount
        if params.dig(:job_claim_stage, :percentage).present? && @job.contract_value.present?
          new_percentage = params[:job_claim_stage][:percentage].to_d
          params[:job_claim_stage][:expected_amount] = (@job.contract_value.to_d * new_percentage / 100).round(2)
        end

        if @stage.update(stage_params)
          render json: { success: true, data: stage_json(@stage) }
        else
          render json: { success: false, error: @stage.errors.full_messages.join(", ") },
                 status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/jobs/:job_id/claim_stages/:id
      # Only custom stages can be deleted
      def destroy
        unless @stage.is_custom?
          return render json: { success: false, error: "Cannot delete template-based stages. Use reset to restore from template." },
                        status: :unprocessable_entity
        end

        @stage.destroy
        render json: { success: true, data: { id: params[:id] } }
      end

      # POST /api/v1/jobs/:job_id/claim_stages/auto_match
      def auto_match
        matcher = ClaimStageMatcherService.new(@job)
        result = matcher.auto_match_all

        render json: {
          success: true,
          data: {
            matched: result[:matched],
            unmatched: result[:unmatched],
            errors: result[:errors],
            stages: @job.job_claim_stages.includes(:external_invoice).ordered.map { |s| stage_json(s) }
          }
        }
      end

      # POST /api/v1/jobs/:job_id/claim_stages/:id/match
      def match
        invoice_id = params[:invoice_id]

        unless invoice_id.present?
          return render json: { success: false, error: "invoice_id is required" },
                        status: :unprocessable_entity
        end

        invoice = @job.external_invoices.find_by(id: invoice_id)

        unless invoice
          return render json: { success: false, error: "Invoice not found for this job" },
                        status: :not_found
        end

        begin
          matcher = ClaimStageMatcherService.new(@job)
          matcher.manual_match(@stage, invoice)

          render json: { success: true, data: stage_json(@stage.reload) }
        rescue ArgumentError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/jobs/:job_id/claim_stages/:id/unmatch
      def unmatch
        begin
          matcher = ClaimStageMatcherService.new(@job)
          matcher.unmatch(@stage)

          render json: { success: true, data: stage_json(@stage.reload) }
        rescue ArgumentError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/jobs/:job_id/claim_stages/reset_from_template
      def reset_from_template
        @job.initialize_claim_stages_from_template!

        stages = @job.job_claim_stages.includes(:claim_stage_template, :external_invoice).ordered

        render json: {
          success: true,
          data: {
            message: "Claim stages reset from template",
            stages: stages.map { |s| stage_json(s) }
          }
        }
      end

      # POST /api/v1/jobs/:job_id/claim_stages/reorder
      def reorder
        order_ids = params[:order_ids]

        unless order_ids.is_a?(Array)
          return render json: { success: false, error: "order_ids must be an array" },
                        status: :unprocessable_entity
        end

        JobClaimStage.transaction do
          order_ids.each_with_index do |id, index|
            @job.job_claim_stages.find(id).update!(sequence_order: index)
          end
        end

        stages = @job.job_claim_stages.ordered
        render json: {
          success: true,
          data: { stages: stages.map { |s| stage_json(s) } }
        }
      rescue ActiveRecord::RecordNotFound => e
        render json: { success: false, error: "Stage not found: #{e.message}" },
               status: :not_found
      end

      # POST /api/v1/jobs/:job_id/claim_stages/sync_payments
      def sync_payments
        matcher = ClaimStageMatcherService.new(@job)
        matcher.sync_payments!

        stages = @job.job_claim_stages.includes(:external_invoice).ordered

        render json: {
          success: true,
          data: {
            message: "Payment info synced from Xero",
            stages: stages.map { |s| stage_json(s) }
          }
        }
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Job not found" }, status: :not_found
      end

      def set_stage
        @stage = @job.job_claim_stages.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Stage not found" }, status: :not_found
      end

      def stage_params
        params.require(:job_claim_stage).permit(
          :name, :percentage, :expected_amount, :sequence_order, :description
        )
      end

      def stage_json(stage)
        invoice = stage.external_invoice

        {
          id: stage.id,
          job_id: stage.job_id,
          claim_stage_template_id: stage.claim_stage_template_id,
          name: stage.name,
          percentage: stage.percentage&.to_f,
          expected_amount: stage.expected_amount&.to_f,
          sequence_order: stage.sequence_order,
          description: stage.description,
          is_custom: stage.is_custom,

          # Matching
          match_status: stage.match_status,
          matched_at: stage.matched_at,
          matched: stage.matched?,
          auto_matched: stage.auto_matched?,

          # Payment
          payment_status: stage.payment_status,
          amount_invoiced: stage.amount_invoiced&.to_f,
          amount_paid: stage.amount_paid&.to_f,
          payment_date: stage.payment_date,

          # Variance
          variance_amount: stage.variance_amount&.to_f,
          variance_percent: stage.variance_percent,
          has_variance: stage.has_variance?,

          # Invoice details (if matched)
          invoice: invoice ? {
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            reference: invoice.reference,
            total: invoice.total&.to_f,
            amount_paid: invoice.amount_paid&.to_f,
            status: invoice.status,
            date: invoice.date,
            due_date: invoice.due_date
          } : nil,

          created_at: stage.created_at,
          updated_at: stage.updated_at
        }
      end

      def available_invoices_json
        matcher = ClaimStageMatcherService.new(@job)
        matcher.available_invoices.map do |invoice|
          {
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            reference: invoice.reference,
            description: invoice.description,
            total: invoice.total&.to_f,
            amount_paid: invoice.amount_paid&.to_f,
            status: invoice.status,
            date: invoice.date
          }
        end
      end
    end
  end
end
