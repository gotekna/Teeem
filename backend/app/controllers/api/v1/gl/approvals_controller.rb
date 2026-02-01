# frozen_string_literal: true

module Api
  module V1
    module Gl
      class ApprovalsController < ApplicationController
        # ==========================================
        # APPROVAL WORKFLOWS (Templates)
        # ==========================================

        # GET /api/v1/gl/approvals/workflows
        def workflows
          workflows = current_company.gl_approval_workflows
                                     .includes(:steps)
                                     .order(:priority)

          render json: {
            success: true,
            data: workflows.map { |w| workflow_json(w) }
          }
        end

        # GET /api/v1/gl/approvals/workflows/:id
        def show_workflow
          workflow = current_company.gl_approval_workflows.find(params[:id])

          render json: {
            success: true,
            data: workflow_json(workflow, include_steps: true)
          }
        end

        # POST /api/v1/gl/approvals/workflows
        def create_workflow
          workflow = current_company.gl_approval_workflows.build(workflow_params)
          workflow.created_by = current_user

          if workflow.save
            render json: {
              success: true,
              data: workflow_json(workflow, include_steps: true),
              message: "Approval workflow created"
            }
          else
            render json: {
              success: false,
              error: workflow.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/approvals/workflows/:id
        def update_workflow
          workflow = current_company.gl_approval_workflows.find(params[:id])

          if workflow.update(workflow_params)
            render json: {
              success: true,
              data: workflow_json(workflow, include_steps: true),
              message: "Workflow updated"
            }
          else
            render json: {
              success: false,
              error: workflow.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/approvals/workflows/:id
        def destroy_workflow
          workflow = current_company.gl_approval_workflows.find(params[:id])

          if workflow.approval_requests.pending.any?
            return render json: {
              success: false,
              error: "Cannot delete workflow with pending approvals"
            }, status: :unprocessable_entity
          end

          workflow.destroy

          render json: {
            success: true,
            message: "Workflow deleted"
          }
        end

        # ==========================================
        # APPROVAL REQUESTS
        # ==========================================

        # GET /api/v1/gl/approvals/pending
        def pending
          requests = current_company.gl_approval_requests
                                    .pending
                                    .includes(:approvable, :workflow, :requested_by)

          # Filter to requests user can approve
          if params[:for_me] == "true"
            requests = requests.select { |r| r.can_be_approved_by?(current_user) }
          end

          render json: {
            success: true,
            data: requests.map { |r| request_json(r) }
          }
        end

        # GET /api/v1/gl/approvals/requests/:id
        def show_request
          request = current_company.gl_approval_requests.find(params[:id])

          render json: {
            success: true,
            data: request_json(request, include_history: true)
          }
        end

        # POST /api/v1/gl/approvals/requests/:id/approve
        def approve
          request = current_company.gl_approval_requests.find(params[:id])

          if request.approve!(user: current_user, comments: params[:comments])
            render json: {
              success: true,
              data: request_json(request.reload, include_history: true),
              message: request.status == "approved" ? "Fully approved" : "Step approved"
            }
          else
            render json: {
              success: false,
              error: "You cannot approve this request"
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/approvals/requests/:id/reject
        def reject
          request = current_company.gl_approval_requests.find(params[:id])

          unless params[:comments].present?
            return render json: {
              success: false,
              error: "Comments required when rejecting"
            }, status: :unprocessable_entity
          end

          if request.reject!(user: current_user, comments: params[:comments])
            render json: {
              success: true,
              data: request_json(request.reload, include_history: true),
              message: "Request rejected"
            }
          else
            render json: {
              success: false,
              error: "You cannot reject this request"
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/approvals/requests/:id/delegate
        def delegate
          request = current_company.gl_approval_requests.find(params[:id])
          to_user = User.find(params[:to_user_id])

          request.delegate!(
            from_user: current_user,
            to_user: to_user,
            comments: params[:comments]
          )

          render json: {
            success: true,
            data: request_json(request.reload, include_history: true),
            message: "Delegated to #{to_user.name}"
          }
        end

        # POST /api/v1/gl/approvals/requests/:id/cancel
        def cancel
          request = current_company.gl_approval_requests.find(params[:id])

          request.cancel!(user: current_user, reason: params[:reason])

          render json: {
            success: true,
            message: "Approval request cancelled"
          }
        end

        # POST /api/v1/gl/approvals/submit
        def submit
          document = find_document(params[:document_type], params[:document_id])

          request = Gl::ApprovalRequest.submit!(document, user: current_user)

          render json: {
            success: true,
            data: request_json(request),
            message: "Submitted for approval"
          }
        end

        # GET /api/v1/gl/approvals/history
        def history
          requests = current_company.gl_approval_requests
                                    .where.not(status: "pending")
                                    .includes(:approvable, :workflow)
                                    .order(completed_at: :desc)
                                    .limit(params[:limit] || 50)

          render json: {
            success: true,
            data: requests.map { |r| request_json(r) }
          }
        end

        # GET /api/v1/gl/approvals/stats
        def stats
          requests = current_company.gl_approval_requests

          render json: {
            success: true,
            data: {
              pending: requests.pending.count,
              approved_today: requests.where(status: "approved", completed_at: Date.current.all_day).count,
              rejected_today: requests.where(status: "rejected", completed_at: Date.current.all_day).count,
              my_pending: requests.pending.select { |r| r.can_be_approved_by?(current_user) }.count,
              avg_approval_time_hours: calculate_avg_approval_time(requests.where(status: "approved"))
            }
          }
        end

        private

        def workflow_params
          params.permit(
            :name, :document_type, :description, :min_amount, :max_amount,
            :category, :active, :priority,
            steps_attributes: [:id, :step_order, :approval_type, :approver_id, :required_role, :required, :timeout_hours, :_destroy, approver_ids: []]
          )
        end

        def workflow_json(workflow, include_steps: false)
          data = {
            id: workflow.id,
            name: workflow.name,
            document_type: workflow.document_type,
            description: workflow.description,
            min_amount: workflow.min_amount,
            max_amount: workflow.max_amount,
            category: workflow.category,
            active: workflow.active,
            priority: workflow.priority,
            total_steps: workflow.total_steps,
            created_by: workflow.created_by&.name
          }

          if include_steps
            data[:steps] = workflow.steps.map do |step|
              {
                id: step.id,
                step_order: step.step_order,
                approval_type: step.approval_type,
                approver_id: step.approver_id,
                approver_name: step.approver&.name,
                required_role: step.required_role,
                approver_ids: step.approver_ids_array,
                required: step.required,
                timeout_hours: step.timeout_hours,
                description: step.step_description
              }
            end
          end

          data
        end

        def request_json(request, include_history: false)
          data = {
            id: request.id,
            document_type: request.approvable_type,
            document_id: request.approvable_id,
            document_reference: document_reference(request.approvable),
            amount: request.amount,
            status: request.status,
            current_step: request.current_step,
            total_steps: request.total_steps,
            workflow_name: request.workflow&.name,
            pending_approvers: request.pending_approvers.map(&:name),
            can_approve: request.can_be_approved_by?(current_user),
            requested_by: request.requested_by&.name,
            submitted_at: request.submitted_at,
            completed_at: request.completed_at,
            notes: request.notes
          }

          data[:history] = request.approval_history if include_history

          data
        end

        def document_reference(document)
          if document.respond_to?(:invoice_number)
            document.invoice_number
          elsif document.respond_to?(:reference)
            document.reference
          elsif document.respond_to?(:number)
            document.number
          else
            "##{document.id}"
          end
        end

        def find_document(type, id)
          case type
          when "bill", "Gl::Invoice"
            Gl::Invoice.find(id)
          when "purchase_order", "PurchaseOrder"
            PurchaseOrder.find(id)
          when "journal", "Gl::JournalEntry"
            Gl::JournalEntry.find(id)
          else
            raise "Unknown document type: #{type}"
          end
        end

        def calculate_avg_approval_time(requests)
          times = requests.where.not(submitted_at: nil, completed_at: nil).map do |r|
            (r.completed_at - r.submitted_at) / 1.hour
          end
          return 0 if times.empty?

          (times.sum / times.count).round(1)
        end

        def current_company
          @current_company ||= Corporate.find(
            params[:corporate_company_id] || current_user.corporate_company_id
          )
        end
      end
    end
  end
end
