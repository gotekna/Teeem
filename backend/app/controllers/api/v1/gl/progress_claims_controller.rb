# frozen_string_literal: true

module Api
  module V1
    module Gl
      class ProgressClaimsController < ApplicationController
        # GET /api/v1/gl/progress_claims
        def index
          claims = current_company.gl_progress_claims
                                  .includes(:job, :contact, :created_by, :lines)
                                  .order(claim_date: :desc)

          # Filter by job
          claims = claims.where(job_id: params[:job_id]) if params[:job_id].present?

          # Filter by status
          claims = claims.where(status: params[:status]) if params[:status].present?

          # Filter by contact
          claims = claims.where(contact_id: params[:contact_id]) if params[:contact_id].present?

          render json: {
            success: true,
            data: claims.map { |c| claim_json(c) }
          }
        end

        # GET /api/v1/gl/progress_claims/:id
        def show
          claim = find_claim

          render json: {
            success: true,
            data: claim_json(claim, include_lines: true, include_history: true)
          }
        end

        # POST /api/v1/gl/progress_claims
        def create
          claim = current_company.gl_progress_claims.build(claim_params)
          claim.created_by = current_user

          if claim.save
            render json: {
              success: true,
              data: claim_json(claim, include_lines: true),
              message: "Progress claim created"
            }
          else
            render json: {
              success: false,
              error: claim.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/progress_claims/:id
        def update
          claim = find_claim

          unless claim.status == "draft"
            return render json: {
              success: false,
              error: "Cannot update a #{claim.status} claim"
            }, status: :unprocessable_entity
          end

          if claim.update(claim_params)
            render json: {
              success: true,
              data: claim_json(claim, include_lines: true),
              message: "Progress claim updated"
            }
          else
            render json: {
              success: false,
              error: claim.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/progress_claims/:id
        def destroy
          claim = find_claim

          unless claim.status == "draft"
            return render json: {
              success: false,
              error: "Cannot delete a #{claim.status} claim"
            }, status: :unprocessable_entity
          end

          claim.destroy

          render json: {
            success: true,
            message: "Progress claim deleted"
          }
        end

        # POST /api/v1/gl/progress_claims/:id/submit
        def submit
          claim = find_claim
          claim.submit!

          render json: {
            success: true,
            data: claim_json(claim),
            message: "Claim submitted for approval"
          }
        end

        # POST /api/v1/gl/progress_claims/:id/approve
        def approve
          claim = find_claim
          claim.approve!(current_user)

          render json: {
            success: true,
            data: claim_json(claim),
            message: "Claim approved"
          }
        end

        # POST /api/v1/gl/progress_claims/:id/certify
        def certify
          claim = find_claim
          claim.certify!

          render json: {
            success: true,
            data: claim_json(claim),
            message: "Claim certified"
          }
        end

        # POST /api/v1/gl/progress_claims/:id/generate_invoice
        def generate_invoice
          claim = find_claim
          invoice = claim.generate_invoice!

          if invoice
            render json: {
              success: true,
              data: claim_json(claim),
              invoice_id: invoice.id,
              message: "Invoice generated"
            }
          else
            render json: {
              success: false,
              error: "Cannot generate invoice for this claim"
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/progress_claims/:id/release_retainage
        def release_retainage
          claim = find_claim
          amount = params[:amount].to_d

          if claim.release_retainage!(amount)
            render json: {
              success: true,
              data: claim_json(claim),
              message: "Retainage released: $#{amount}"
            }
          else
            render json: {
              success: false,
              error: "Cannot release that amount"
            }, status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/progress_claims/job_summary/:job_id
        def job_summary
          job = Job.find(params[:job_id])
          claims = current_company.gl_progress_claims.for_job(job.id)

          render json: {
            success: true,
            data: {
              job_id: job.id,
              job_name: job.name,
              contract_value: claims.first&.contract_value || 0,
              variations_approved: claims.sum(:variations_approved),
              adjusted_contract_value: claims.first&.adjusted_contract_value || 0,
              total_claimed_pct: claims.approved.sum(:this_claim_pct),
              total_claimed_amount: claims.approved.sum(:this_claim_amount),
              total_retainage_held: claims.approved.sum(:retainage_amount) - claims.approved.sum(:retainage_released),
              claims_count: claims.count,
              pending_claims: claims.where(status: %w[draft submitted]).count
            }
          }
        end

        # GET /api/v1/gl/progress_claims/retainage_summary
        def retainage_summary
          claims = current_company.gl_progress_claims.approved

          by_job = claims.group(:job_id).pluck(
            :job_id,
            Arel.sql("SUM(retainage_amount) as held"),
            Arel.sql("SUM(retainage_released) as released")
          ).map do |job_id, held, released|
            job = Job.find(job_id)
            {
              job_id: job_id,
              job_name: job.name,
              retainage_held: held,
              retainage_released: released,
              retainage_outstanding: held - released
            }
          end

          render json: {
            success: true,
            data: {
              total_held: claims.sum(:retainage_amount),
              total_released: claims.sum(:retainage_released),
              total_outstanding: claims.sum(:retainage_amount) - claims.sum(:retainage_released),
              by_job: by_job
            }
          }
        end

        private

        def find_claim
          current_company.gl_progress_claims.find(params[:id])
        end

        def claim_params
          params.permit(
            :job_id, :contact_id, :claim_date, :claim_number,
            :period_from, :period_to, :contract_value, :variations_approved,
            :this_claim_pct, :retainage_pct, :notes,
            lines_attributes: [:id, :description, :category, :contract_value, :previous_pct, :this_pct, :sort_order, :_destroy]
          )
        end

        def claim_json(claim, include_lines: false, include_history: false)
          data = {
            id: claim.id,
            claim_number: claim.claim_number,
            claim_sequence: claim.claim_sequence,
            claim_date: claim.claim_date,
            period_from: claim.period_from,
            period_to: claim.period_to,
            job_id: claim.job_id,
            job_name: claim.job.name,
            contact_id: claim.contact_id,
            contact_name: claim.contact.name,
            contract_value: claim.contract_value,
            variations_approved: claim.variations_approved,
            adjusted_contract_value: claim.adjusted_contract_value,
            previous_claimed_pct: claim.previous_claimed_pct,
            this_claim_pct: claim.this_claim_pct,
            total_claimed_pct: claim.total_claimed_pct,
            previous_claimed_amount: claim.previous_claimed_amount,
            this_claim_amount: claim.this_claim_amount,
            total_claimed_amount: claim.total_claimed_amount,
            retainage_pct: claim.retainage_pct,
            retainage_amount: claim.retainage_amount,
            retainage_released: claim.retainage_released,
            gst_amount: claim.gst_amount,
            net_claim_amount: claim.net_claim_amount,
            total_payable: claim.total_payable,
            remaining_to_claim: claim.remaining_to_claim,
            remaining_pct: claim.remaining_pct,
            status: claim.status,
            submitted_at: claim.submitted_at,
            approved_at: claim.approved_at,
            certified_at: claim.certified_at,
            invoice_id: claim.invoice_id,
            notes: claim.notes,
            created_by: claim.created_by&.name,
            approved_by: claim.approved_by&.name,
            created_at: claim.created_at
          }

          if include_lines
            data[:lines] = claim.lines.map do |line|
              {
                id: line.id,
                description: line.description,
                category: line.category,
                contract_value: line.contract_value,
                previous_pct: line.previous_pct,
                this_pct: line.this_pct,
                total_pct: line.total_pct,
                this_claim_amount: line.this_claim_amount,
                sort_order: line.sort_order
              }
            end
          end

          if include_history
            data[:previous_claims] = claim.previous_claims.map do |pc|
              {
                id: pc.id,
                claim_number: pc.claim_number,
                claim_sequence: pc.claim_sequence,
                this_claim_pct: pc.this_claim_pct,
                this_claim_amount: pc.this_claim_amount,
                status: pc.status,
                claim_date: pc.claim_date
              }
            end
          end

          data
        end

        def current_company
          @current_company ||= CorporateCompany.find(
            params[:corporate_company_id] || current_user.corporate_company_id
          )
        end
      end
    end
  end
end
