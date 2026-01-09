# frozen_string_literal: true

module Api
  module V1
    class JobClaimStagesController < ApplicationController
      before_action :set_job
      before_action :set_stage, only: [:show, :update, :destroy, :match, :unmatch, :create_invoice, :send_to_client, :generate_pdf, :release_retainage]

      # GET /api/v1/jobs/:job_id/claim_stages
      def index
        stages = @job.job_claim_stages.includes(:external_invoice).ordered

        # Summary calculations (handle nil values)
        # SSoT: contract_price is THE ONE
        contract = @job.contract_price.to_d
        total_expected = stages.sum { |s| s.expected_amount.to_d }
        total_invoiced = stages.sum { |s| s.amount_invoiced.to_d }
        total_paid = stages.sum { |s| s.amount_paid.to_d }
        total_retainage_held = JobClaimStage.total_retainage_held_for_job(@job.id)
        total_retainage_released = stages.sum { |s| s.retainage_released? ? s.retainage_amount.to_d : 0 }

        render json: {
          success: true,
          data: {
            stages: stages.map { |s| stage_json(s) },
            summary: {
              # Keep key as contract_value for frontend compatibility
              contract_value: contract.to_f,
              total_expected: total_expected.to_f,
              total_invoiced: total_invoiced.to_f,
              total_paid: total_paid.to_f,
              remaining: (contract - total_paid).to_f,
              paid_percentage: contract.positive? ? ((total_paid / contract) * 100).round(1) : 0,
              # Retainage summary
              total_retainage_held: total_retainage_held.to_f,
              total_retainage_released: total_retainage_released.to_f,
              net_receivable: (total_invoiced - total_paid - total_retainage_held).to_f
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
        # SSoT: contract_price is THE ONE
        if @stage.percentage.present? && @job.contract_price.present?
          @stage.expected_amount = (@job.contract_price.to_d * @stage.percentage / 100).round(2)
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
        # SSoT: contract_price is THE ONE
        if params.dig(:job_claim_stage, :percentage).present? && @job.contract_price.present?
          new_percentage = params[:job_claim_stage][:percentage].to_d
          params[:job_claim_stage][:expected_amount] = (@job.contract_price.to_d * new_percentage / 100).round(2)
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
      # SSoT: Claim stages now come from Schedule Master CLAIM tasks
      # To reset, re-apply the schedule template
      def reset_from_template
        template = @job.job_type&.sm_schedule_master_template

        unless template
          return render json: {
            success: false,
            error: "No schedule template configured for this job type"
          }, status: :unprocessable_entity
        end

        # Clear existing claim stages and re-apply from Schedule Master
        @job.job_claim_stages.destroy_all

        result = SmScheduleMasterTemplateCopyService.new(template, @job, {
          start_date: @job.start_date || Date.current,
          user: current_user,
          clear_existing: true, # Re-apply entire schedule
          create_purchase_orders: false
        }).execute

        if result[:success]
          stages = @job.job_claim_stages.includes(:external_invoice).ordered
          render json: {
            success: true,
            data: {
              message: "Claim stages reset from Schedule Master template",
              stages: stages.map { |s| stage_json(s) },
              tasks_created: result[:tasks_created],
              claim_stages_created: result[:claim_stages_created]
            }
          }
        else
          render json: { success: false, error: result[:errors].join(", ") },
                 status: :unprocessable_entity
        end
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

      # POST /api/v1/jobs/:job_id/claim_stages/:id/create_invoice
      # Create a sales invoice in TEEEM and sync to Xero
      def create_invoice
        # Validate stage doesn't already have an invoice
        if @stage.external_invoice_id.present?
          return render json: { success: false, error: "Stage already has an invoice linked" },
                        status: :unprocessable_entity
        end

        # Get the client contact for the invoice
        client = @job.client
        unless client
          return render json: { success: false, error: "Job has no client contact assigned. Please add a client first." },
                        status: :unprocessable_entity
        end

        # Get Xero credential for tenant_id
        xero_credential = XeroCredential.current
        unless xero_credential
          return render json: { success: false, error: "No Xero connection configured" },
                        status: :unprocessable_entity
        end

        # Find the Xero contact ID for this client
        warehouse_contact = WarehouseContact.find_by(contact_id: client.id, tenant_id: xero_credential.tenant_id)
        external_contact_id = warehouse_contact&.xero_id

        # If no warehouse contact, try legacy ContactExternalLink
        unless external_contact_id
          link = ContactExternalLink.find_by(contact_id: client.id, source: "xero", tenant_id: xero_credential.tenant_id)
          external_contact_id = link&.external_contact_id
        end

        unless external_contact_id
          return render json: {
            success: false,
            error: "Client '#{client.display_name}' is not linked to Xero. Please sync contacts first."
          }, status: :unprocessable_entity
        end

        # Build invoice attributes
        amount = @stage.expected_amount || 0
        # SSoT: Use J{job_number}-{sequence} format for auto-matching
        # Falls back to job_number-stage_name if no sequence set
        reference = if params[:reference].present?
                      params[:reference]
                    elsif @stage.claim_sequence_number.present?
                      "J#{@job.job_number}-#{@stage.claim_sequence_number}"
                    else
                      "#{@job.job_number}-#{@stage.name}"
                    end
        # Include reference in description so it's searchable in Xero
        description = "#{reference} - #{@stage.name} - #{@job.name}"
        due_days = (params[:due_days] || 14).to_i

        # Get tracking data if job has Xero tracking option
        tracking_data = []
        if @job.xero_tracking_option_name.present?
          tracking_data = [{
            "Name" => "Jobs", # Standard tracking category name
            "Option" => @job.xero_tracking_option_name
          }]
        end

        begin
          # Create ExternalInvoice in TEEEM
          invoice = ExternalInvoice.create!(
            source: "xero",
            tenant_id: xero_credential.tenant_id,
            invoice_type: "sales_invoice",
            status: "draft",
            invoice_date: Date.current,
            due_date: Date.current + due_days.days,
            contact_id: client.id,
            external_contact_id: external_contact_id,
            contact_name: client.display_name,
            job_id: @job.id,
            reference: reference,
            subtotal: amount,
            total_tax: 0, # Will be calculated by Xero based on tax type
            total: amount,
            amount_due: amount,
            amount_paid: 0,
            currency_code: "AUD",
            line_items: [{
              "Description" => description,
              "Quantity" => 1,
              "UnitAmount" => amount.to_f,
              "AccountCode" => "200", # Default sales account
              "TaxType" => "OUTPUT", # GST on Income
              "Tracking" => tracking_data
            }],
            tracking_data: tracking_data,
            created_in_teeem: true,
            pending_push: true,
            sync_direction: "export_only",
            sync_enabled: true,
            teeem_updated_at: Time.current
          )

          # Link invoice to claim stage
          matcher = ClaimStageMatcherService.new(@job)
          matcher.manual_match(@stage, invoice)

          # Reload to get updated data
          invoice.reload
          @stage.reload

          render json: {
            success: true,
            data: {
              stage: stage_json(@stage),
              invoice: {
                id: invoice.id,
                invoice_number: invoice.invoice_number || "DRAFT",
                external_id: invoice.external_id,
                total: invoice.total&.to_f,
                status: invoice.status,
                pending_push: invoice.pending_push
              },
              message: "Invoice created as draft in TEEEM. Click 'Send to Client' to sync to Xero."
            }
          }
        rescue StandardError => e
          Rails.logger.error("Failed to create invoice for claim stage #{@stage.id}: #{e.message}")
          Rails.logger.error(e.backtrace.join("\n"))

          render json: { success: false, error: "Failed to create invoice: #{e.message}" },
                 status: :unprocessable_entity
        end
      end

      # POST /api/v1/jobs/:job_id/claim_stages/:id/send_to_client
      # Push draft invoice to Xero
      def send_to_client
        invoice = @stage.external_invoice

        unless invoice
          return render json: { success: false, error: "No invoice linked to this stage" },
                       status: :unprocessable_entity
        end

        unless invoice.pending_push?
          return render json: { success: false, error: "Invoice has already been sent to Xero" },
                       status: :unprocessable_entity
        end

        # Get Xero credential
        xero_credential = XeroCredential.current
        unless xero_credential
          return render json: { success: false, error: "No Xero connection configured" },
                       status: :unprocessable_entity
        end

        begin
          # Push to Xero
          sync_service = ExternalInvoiceSyncService.new(source: "xero", tenant_id: xero_credential.tenant_id)
          sync_service.send(:push_invoice_to_xero, invoice)

          # Reload to get updated data from Xero response
          invoice.reload
          @stage.reload

          render json: {
            success: true,
            data: {
              stage: stage_json(@stage),
              invoice: {
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                external_id: invoice.external_id,
                total: invoice.total&.to_f,
                status: invoice.status
              },
              message: "Invoice sent to Xero successfully"
            }
          }
        rescue StandardError => e
          Rails.logger.error("Failed to send invoice to Xero: #{e.message}")
          Rails.logger.error(e.backtrace.join("\n"))

          render json: { success: false, error: "Failed to send to Xero: #{e.message}" },
                 status: :unprocessable_entity
        end
      end

      # POST /api/v1/jobs/:job_id/claim_stages/:id/generate_pdf
      # Generate invoice PDF from code-driven InvoiceTemplate
      def generate_pdf
        invoice = @stage.external_invoice

        unless invoice
          return render json: { success: false, error: "No invoice linked to this stage" },
                       status: :unprocessable_entity
        end

        # Find invoice template (code-driven JSONB template)
        template_id = params[:template_id]
        template = if template_id.present?
          InvoiceTemplate.find(template_id)
        else
          InvoiceTemplate.default
        end

        unless template
          return render json: { success: false, error: "No invoice template found. Please create an invoice template first." },
                       status: :unprocessable_entity
        end

        begin
          # Generate PDF using InvoicePdfGenerator (code-driven templates)
          generator = InvoicePdfGenerator.new(template: template)
          result = generator.generate(
            invoice: invoice,
            job: @job,
            contact: @job.client || @job.primary_contact,
            claim_stage: @stage
          )

          # Create document record and attach the PDF
          document = CorporateCompanyDocument.new(
            title: "Invoice #{invoice.invoice_number || 'Draft'}",
            document_type: "invoice",
            contact: invoice.contact || @job.client || @job.primary_contact,
            documentable: invoice,
            source: "generated",
            focus: "job"
          )

          # Attach the PDF file
          document.file.attach(
            io: StringIO.new(result[:pdf_content]),
            filename: result[:filename],
            content_type: "application/pdf"
          )

          document.save!

          render json: {
            success: true,
            data: {
              document_id: document.id,
              filename: document.file.filename.to_s,
              url: rails_blob_url(document.file),
              template_name: template.name,
              message: "Invoice PDF generated successfully"
            }
          }
        rescue InvoicePdfGenerator::GenerationError => e
          render json: { success: false, error: "PDF generation failed: #{e.message}" },
                 status: :unprocessable_entity
        rescue StandardError => e
          Rails.logger.error("Failed to generate invoice PDF: #{e.message}")
          Rails.logger.error(e.backtrace.join("\n"))
          render json: { success: false, error: "Failed to generate PDF: #{e.message}" },
                 status: :internal_server_error
        end
      end

      # POST /api/v1/jobs/:job_id/claim_stages/:id/release_retainage
      # Release held retainage for a stage
      def release_retainage
        unless @stage.retainage_held?
          return render json: { success: false, error: "No retainage held on this stage" },
                        status: :unprocessable_entity
        end

        # Optionally link to a release invoice
        release_invoice = nil
        if params[:release_invoice_id].present?
          release_invoice = Gl::Invoice.find_by(id: params[:release_invoice_id])
        end

        if @stage.release_retainage!(release_invoice: release_invoice)
          render json: {
            success: true,
            data: {
              stage: stage_json(@stage.reload),
              message: "Retainage released successfully",
              released_amount: @stage.retainage_amount.to_f
            }
          }
        else
          render json: { success: false, error: "Failed to release retainage" },
                 status: :unprocessable_entity
        end
      end

      # GET /api/v1/jobs/:job_id/claim_stages/retainage_summary
      # Get retainage summary for a job
      def retainage_summary
        stages_with_retainage = @job.job_claim_stages.with_retainage.includes(:external_invoice)

        held = stages_with_retainage.retainage_held
        released = stages_with_retainage.retainage_released

        render json: {
          success: true,
          data: {
            total_retainage_percentage: @job.default_retainage_percentage&.to_f || 0,
            stages_with_retainage: stages_with_retainage.count,
            total_held: held.sum(:retainage_amount).to_f,
            total_released: released.sum(:retainage_amount).to_f,
            held_stages: held.map { |s| { id: s.id, name: s.name, amount: s.retainage_amount.to_f } },
            released_stages: released.map { |s| { id: s.id, name: s.name, amount: s.retainage_amount.to_f, released_at: s.retainage_released_at } }
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
          :name, :percentage, :expected_amount, :sequence_order, :description,
          :retainage_percentage
        )
      end

      def stage_json(stage)
        invoice = stage.external_invoice

        {
          id: stage.id,
          job_id: stage.job_id,
          # SSoT: Claim stages now come from Schedule Master CLAIM tasks (sm_task linkage)
          sm_task_id: stage.sm_task&.id,
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

          # Retainage
          retainage_percentage: stage.retainage_percentage&.to_f,
          retainage_amount: stage.retainage_amount&.to_f,
          retainage_status: stage.retainage_status,
          retainage_released_at: stage.retainage_released_at,
          retainage_held: stage.retainage_held?,
          net_payable: stage.net_payable&.to_f,

          # Invoice details (if matched)
          invoice: invoice ? {
            id: invoice.id,
            external_id: invoice.external_id,
            invoice_number: invoice.invoice_number,
            reference: invoice.reference,
            total: invoice.total&.to_f,
            amount_due: invoice.amount_due&.to_f,
            amount_paid: invoice.amount_paid&.to_f,
            status: invoice.status,
            date: invoice.invoice_date,
            due_date: invoice.due_date,
            fully_paid_date: invoice.fully_paid_date
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
            total: invoice.total&.to_f,
            amount_paid: invoice.amount_paid&.to_f,
            status: invoice.status,
            date: invoice.invoice_date
          }
        end
      end
    end
  end
end
