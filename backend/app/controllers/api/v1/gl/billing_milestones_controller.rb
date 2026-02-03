# frozen_string_literal: true

module Api
  module V1
    module Gl
      class BillingMilestonesController < ApplicationController
        # GET /api/v1/gl/billing_milestones
        def index
          milestones = current_company.gl_billing_milestones
                                      .includes(:job, :contact, :invoice)

          # Filter by job
          milestones = milestones.where(job_id: params[:job_id]) if params[:job_id].present?

          # Filter by status
          milestones = milestones.where(status: params[:status]) if params[:status].present?

          # Filter by contact
          milestones = milestones.where(contact_id: params[:contact_id]) if params[:contact_id].present?

          render json: {
            success: true,
            data: milestones.map { |m| milestone_json(m) }
          }
        end

        # GET /api/v1/gl/billing_milestones/:id
        def show
          milestone = find_milestone

          render json: {
            success: true,
            data: milestone_json(milestone, include_deliverables: true)
          }
        end

        # POST /api/v1/gl/billing_milestones
        def create
          milestone = current_company.gl_billing_milestones.build(milestone_params)

          if milestone.save
            render json: {
              success: true,
              data: milestone_json(milestone),
              message: "Milestone created"
            }
          else
            render json: {
              success: false,
              error: milestone.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/billing_milestones/:id
        def update
          milestone = find_milestone

          if milestone.status.in?(%w[invoiced paid])
            return render json: {
              success: false,
              error: "Cannot update an invoiced milestone"
            }, status: :unprocessable_entity
          end

          if milestone.update(milestone_params)
            render json: {
              success: true,
              data: milestone_json(milestone),
              message: "Milestone updated"
            }
          else
            render json: {
              success: false,
              error: milestone.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/billing_milestones/:id
        def destroy
          milestone = find_milestone

          if milestone.status.in?(%w[invoiced paid])
            return render json: {
              success: false,
              error: "Cannot delete an invoiced milestone"
            }, status: :unprocessable_entity
          end

          milestone.destroy

          render json: {
            success: true,
            message: "Milestone deleted"
          }
        end

        # POST /api/v1/gl/billing_milestones/:id/start
        def start
          milestone = find_milestone
          milestone.start!

          render json: {
            success: true,
            data: milestone_json(milestone),
            message: "Milestone started"
          }
        end

        # POST /api/v1/gl/billing_milestones/:id/complete
        def complete
          milestone = find_milestone
          milestone.complete!(user: current_user, notes: params[:notes])

          render json: {
            success: true,
            data: milestone_json(milestone),
            message: "Milestone completed"
          }
        end

        # POST /api/v1/gl/billing_milestones/:id/generate_invoice
        def generate_invoice
          milestone = find_milestone
          invoice = milestone.generate_invoice!

          if invoice
            render json: {
              success: true,
              data: milestone_json(milestone),
              invoice_id: invoice.id,
              message: "Invoice generated"
            }
          else
            render json: {
              success: false,
              error: "Cannot generate invoice for this milestone"
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/billing_milestones/:id/cancel
        def cancel
          milestone = find_milestone

          if milestone.cancel!
            render json: {
              success: true,
              data: milestone_json(milestone),
              message: "Milestone cancelled"
            }
          else
            render json: {
              success: false,
              error: "Cannot cancel this milestone"
            }, status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/billing_milestones/job_summary/:job_id
        def job_summary
          job = Job.find(params[:job_id])
          summary = Gl::BillingMilestone.job_summary(job)

          render json: {
            success: true,
            data: summary.merge(
              job_id: job.id,
              job_name: job.name,
              milestones: current_company.gl_billing_milestones.for_job(job.id).map { |m| milestone_json(m) }
            )
          }
        end

        # GET /api/v1/gl/billing_milestones/billable
        def billable
          milestones = current_company.gl_billing_milestones
                                      .billable
                                      .includes(:job, :contact)

          render json: {
            success: true,
            data: milestones.map { |m| milestone_json(m) },
            total_billable: milestones.sum(:amount)
          }
        end

        # GET /api/v1/gl/billing_milestones/overdue
        def overdue
          milestones = current_company.gl_billing_milestones
                                      .overdue
                                      .includes(:job, :contact)

          render json: {
            success: true,
            data: milestones.map { |m| milestone_json(m) }
          }
        end

        # POST /api/v1/gl/billing_milestones/reorder
        def reorder
          params[:milestones].each_with_index do |id, index|
            current_company.gl_billing_milestones.find(id).update!(sort_order: index)
          end

          render json: {
            success: true,
            message: "Milestones reordered"
          }
        end

        private

        def find_milestone
          current_company.gl_billing_milestones.find(params[:id])
        end

        def milestone_params
          params.permit(
            :job_id, :contact_id, :name, :description, :amount,
            :percentage_of_contract, :is_percentage, :target_date,
            :auto_invoice, :sort_order, deliverables: []
          )
        end

        def milestone_json(milestone, include_deliverables: false)
          data = {
            id: milestone.id,
            name: milestone.name,
            description: milestone.description,
            job_id: milestone.job_id,
            job_name: milestone.job.name,
            contact_id: milestone.contact_id,
            contact_name: milestone.contact.name,
            amount: milestone.amount,
            is_percentage: milestone.is_percentage,
            percentage_of_contract: milestone.percentage_of_contract,
            target_date: milestone.target_date,
            completed_date: milestone.completed_date,
            status: milestone.status,
            progress_status: milestone.progress_status,
            days_until_target: milestone.days_until_target,
            auto_invoice: milestone.auto_invoice,
            invoice_id: milestone.invoice_id,
            invoiced_at: milestone.invoiced_at,
            completed_by: milestone.completed_by&.name,
            completion_notes: milestone.completion_notes,
            sort_order: milestone.sort_order,
            created_at: milestone.created_at
          }

          data[:deliverables] = milestone.deliverables_array if include_deliverables

          data
        end

        def current_company
          @current_company ||= Corporate.find(
            params[:corporate_id] || current_user.corporate_id
          )
        end
      end
    end
  end
end
