# frozen_string_literal: true

module Api
  module V1
    module Gl
      # Controller for advanced reporting features
      class AdvancedReportingController < ApplicationController
        before_action :set_corporate_company

        # === Departments ===

        # GET /api/v1/gl/advanced_reporting/departments
        def departments
          departments = @corporate_company.gl_departments.includes(:parent, :manager).ordered
          departments = departments.active if params[:active_only] == "true"

          render json: {
            success: true,
            data: departments.as_json(include: { parent: { only: [:id, :name] }, manager: { only: [:id, :name] } })
          }
        end

        # GET /api/v1/gl/advanced_reporting/departments/tree
        def department_tree
          render json: { success: true, data: ::Gl::Department.tree(@corporate_company) }
        end

        # POST /api/v1/gl/advanced_reporting/departments
        def create_department
          dept = @corporate_company.gl_departments.build(department_params)

          if dept.save
            render json: { success: true, data: dept }, status: :created
          else
            render json: { success: false, error: dept.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/advanced_reporting/departments/:id
        def update_department
          dept = @corporate_company.gl_departments.find(params[:id])

          if dept.update(department_params)
            render json: { success: true, data: dept }
          else
            render json: { success: false, error: dept.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/advanced_reporting/departments/:id/profit_loss
        def department_profit_loss
          dept = @corporate_company.gl_departments.find(params[:id])
          start_date = params[:start_date]&.to_date || Date.current.beginning_of_month
          end_date = params[:end_date]&.to_date || Date.current.end_of_month

          pl = dept.profit_loss(start_date: start_date, end_date: end_date)
          variance = dept.budget_variance(start_date: start_date, end_date: end_date)

          render json: { success: true, data: { profit_loss: pl, budget_variance: variance } }
        end

        # GET /api/v1/gl/advanced_reporting/departmental_pnl
        def departmental_pnl
          start_date = params[:start_date]&.to_date || Date.current.beginning_of_month
          end_date = params[:end_date]&.to_date || Date.current.end_of_month

          departments = @corporate_company.gl_departments.active.ordered.map do |dept|
            pl = dept.profit_loss(start_date: start_date, end_date: end_date)
            variance = dept.budget_variance(start_date: start_date, end_date: end_date)
            dept.as_json.merge(profit_loss: pl, budget_variance: variance)
          end

          render json: { success: true, data: departments }
        end

        # === Tracking Classes ===

        # GET /api/v1/gl/advanced_reporting/tracking_classes
        def tracking_classes
          classes = @corporate_company.gl_tracking_classes.includes(:parent)
          classes = classes.active if params[:active_only] == "true"
          classes = classes.for_type(params[:type]) if params[:type].present?

          render json: { success: true, data: classes }
        end

        # GET /api/v1/gl/advanced_reporting/tracking_classes/types
        def tracking_class_types
          render json: { success: true, data: ::Gl::TrackingClass.summary_by_type(@corporate_company) }
        end

        # GET /api/v1/gl/advanced_reporting/tracking_classes/tree/:type
        def tracking_class_tree
          tree = ::Gl::TrackingClass.tree_by_type(@corporate_company, params[:type])
          render json: { success: true, data: tree }
        end

        # POST /api/v1/gl/advanced_reporting/tracking_classes
        def create_tracking_class
          tc = @corporate_company.gl_tracking_classes.build(tracking_class_params)

          if tc.save
            render json: { success: true, data: tc }, status: :created
          else
            render json: { success: false, error: tc.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/advanced_reporting/tracking_classes/:id
        def update_tracking_class
          tc = @corporate_company.gl_tracking_classes.find(params[:id])

          if tc.update(tracking_class_params)
            render json: { success: true, data: tc }
          else
            render json: { success: false, error: tc.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # === Split Transactions ===

        # GET /api/v1/gl/advanced_reporting/splits
        def splits
          splits = @corporate_company.gl_split_transactions.includes(:lines, :created_by).recent
          splits = splits.pending if params[:pending_only] == "true"

          render json: {
            success: true,
            data: splits.as_json(include: [:lines, :created_by])
          }
        end

        # POST /api/v1/gl/advanced_reporting/splits
        def create_split
          # Find the original transaction
          transaction = find_original_transaction

          split = ::Gl::SplitTransaction.create_split!(
            transaction,
            params[:lines],
            user: current_user
          )

          render json: { success: true, data: split.as_json(include: :lines) }, status: :created
        rescue StandardError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end

        # POST /api/v1/gl/advanced_reporting/splits/:id/complete
        def complete_split
          split = @corporate_company.gl_split_transactions.find(params[:id])

          if split.complete!(current_user)
            render json: { success: true, data: split }
          else
            render json: { success: false, error: "Cannot complete split" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/advanced_reporting/splits/:id/reverse
        def reverse_split
          split = @corporate_company.gl_split_transactions.find(params[:id])

          if split.reverse!(current_user)
            render json: { success: true, data: split }
          else
            render json: { success: false, error: "Cannot reverse split" }, status: :unprocessable_entity
          end
        end

        # === Comparative Reporting ===

        # GET /api/v1/gl/advanced_reporting/snapshots
        def period_snapshots
          snapshots = @corporate_company.gl_period_snapshots.recent
          snapshots = snapshots.for_type(params[:type]) if params[:type].present?
          snapshots = snapshots.finalized if params[:finalized_only] == "true"

          render json: { success: true, data: snapshots }
        end

        # POST /api/v1/gl/advanced_reporting/snapshots/generate
        def generate_snapshot
          period_type = params[:period_type] || "month"
          period_start = params[:period_start]&.to_date || Date.current.beginning_of_month
          period_end = params[:period_end]&.to_date || Date.current.end_of_month

          snapshot = ::Gl::PeriodSnapshot.generate!(
            @corporate_company,
            period_type: period_type,
            period_start: period_start,
            period_end: period_end,
            label: params[:label]
          )

          render json: { success: true, data: snapshot }, status: :created
        end

        # POST /api/v1/gl/advanced_reporting/snapshots/:id/finalize
        def finalize_snapshot
          snapshot = @corporate_company.gl_period_snapshots.find(params[:id])
          snapshot.finalize!

          render json: { success: true, data: snapshot }
        end

        # GET /api/v1/gl/advanced_reporting/snapshots/:id/compare
        def compare_snapshots
          current_snapshot = @corporate_company.gl_period_snapshots.find(params[:id])

          comparison = if params[:compare_to_id].present?
                         other = @corporate_company.gl_period_snapshots.find(params[:compare_to_id])
                         current_snapshot.compare_to(other)
                       elsif params[:yoy] == "true"
                         current_snapshot.year_over_year
                       else
                         current_snapshot.period_over_period
                       end

          render json: { success: true, data: comparison }
        end

        # GET /api/v1/gl/advanced_reporting/comparative_report
        def comparative_report
          period_type = params[:period_type] || "month"
          periods = params[:periods]&.to_i || 6

          snapshots = @corporate_company.gl_period_snapshots
                                        .for_type(period_type)
                                        .recent
                                        .limit(periods)

          render json: { success: true, data: snapshots.reverse }
        end

        # === KPIs ===

        # GET /api/v1/gl/advanced_reporting/kpis
        def kpis
          kpis = @corporate_company.gl_kpi_definitions.ordered
          kpis = kpis.active if params[:active_only] == "true"
          kpis = kpis.on_dashboard if params[:dashboard_only] == "true"

          render json: { success: true, data: kpis }
        end

        # POST /api/v1/gl/advanced_reporting/kpis
        def create_kpi
          kpi = @corporate_company.gl_kpi_definitions.build(kpi_params)

          if kpi.save
            render json: { success: true, data: kpi }, status: :created
          else
            render json: { success: false, error: kpi.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/advanced_reporting/kpis/:id
        def update_kpi
          kpi = @corporate_company.gl_kpi_definitions.find(params[:id])

          if kpi.update(kpi_params)
            render json: { success: true, data: kpi }
          else
            render json: { success: false, error: kpi.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/advanced_reporting/kpis/:id/calculate
        def calculate_kpi
          kpi = @corporate_company.gl_kpi_definitions.find(params[:id])
          start_date = params[:start_date]&.to_date
          end_date = params[:end_date]&.to_date

          value = kpi.calculate(start_date: start_date, end_date: end_date)
          status = kpi.status(value)

          render json: {
            success: true,
            data: {
              kpi: kpi,
              value: value,
              formatted: kpi.format_value(value),
              status: status
            }
          }
        end

        # GET /api/v1/gl/advanced_reporting/kpi_dashboard
        def kpi_dashboard
          start_date = params[:start_date]&.to_date || Date.current.beginning_of_month
          end_date = params[:end_date]&.to_date || Date.current.end_of_month

          kpis = @corporate_company.gl_kpi_definitions.active.on_dashboard.ordered.map do |kpi|
            value = kpi.calculate(start_date: start_date, end_date: end_date)
            {
              id: kpi.id,
              name: kpi.name,
              code: kpi.code,
              category: kpi.category,
              value: value,
              formatted: kpi.format_value(value),
              status: kpi.status(value),
              target: kpi.target_value
            }
          end

          render json: { success: true, data: kpis }
        end

        # POST /api/v1/gl/advanced_reporting/kpis/seed
        def seed_kpis
          ::Gl::KpiDefinition.seed_common!(@corporate_company)
          render json: { success: true, message: "Common KPIs seeded" }
        end

        # === Benchmarks ===

        # GET /api/v1/gl/advanced_reporting/benchmarks/:kpi_code
        def benchmark_for_kpi
          industry_code = params[:industry_code] || "E" # Default to Construction
          benchmark = ::Gl::Benchmark.for_kpi_and_industry(params[:kpi_code], industry_code)

          return render json: { success: false, error: "No benchmark found" }, status: :not_found unless benchmark

          # Get current value to compare
          kpi = @corporate_company.gl_kpi_definitions.find_by(code: params[:kpi_code])
          current_value = kpi&.calculate

          comparison = benchmark.percentile_for(current_value)

          render json: {
            success: true,
            data: {
              benchmark: benchmark,
              current_value: current_value,
              comparison: comparison
            }
          }
        end

        # === Document Requests ===

        # GET /api/v1/gl/advanced_reporting/document_requests
        def document_requests
          requests = @corporate_company.gl_document_requests
                                       .includes(:contact, :requested_documents)
                                       .recent

          requests = requests.pending if params[:pending_only] == "true"
          requests = requests.overdue if params[:overdue_only] == "true"

          render json: {
            success: true,
            data: requests.as_json(include: [:contact, :requested_documents])
          }
        end

        # GET /api/v1/gl/advanced_reporting/document_requests/:id
        def show_document_request
          request = @corporate_company.gl_document_requests.find(params[:id])

          render json: {
            success: true,
            data: request.as_json(include: [:contact, :requested_documents, :created_by]).merge(
              summary: request.summary,
              portal_url: request.portal_url
            )
          }
        end

        # POST /api/v1/gl/advanced_reporting/document_requests
        def create_document_request
          request = @corporate_company.gl_document_requests.build(document_request_params)
          request.created_by = current_user

          if request.save
            # Add requested documents
            params[:documents]&.each do |doc|
              request.requested_documents.create!(
                document_type: doc[:type],
                name: doc[:name],
                instructions: doc[:instructions],
                required: doc[:required] != false
              )
            end

            render json: { success: true, data: request.as_json(include: :requested_documents) }, status: :created
          else
            render json: { success: false, error: request.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/advanced_reporting/document_requests/:id/send
        def send_document_request
          request = @corporate_company.gl_document_requests.find(params[:id])

          if request.send_request!
            render json: { success: true, data: request }
          else
            render json: { success: false, error: "Cannot send request" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/advanced_reporting/document_requests/:id/remind
        def remind_document_request
          request = @corporate_company.gl_document_requests.find(params[:id])

          if request.send_reminder!
            render json: { success: true, message: "Reminder sent" }
          else
            render json: { success: false, error: "Cannot send reminder" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/advanced_reporting/documents/:id/approve
        def approve_document
          doc = ::Gl::RequestedDocument.joins(:document_request)
                                       .where(gl_document_requests: { corporate_company_id: @corporate_company.id })
                                       .find(params[:id])
          doc.approve!(current_user)

          render json: { success: true, data: doc }
        end

        # POST /api/v1/gl/advanced_reporting/documents/:id/reject
        def reject_document
          doc = ::Gl::RequestedDocument.joins(:document_request)
                                       .where(gl_document_requests: { corporate_company_id: @corporate_company.id })
                                       .find(params[:id])
          doc.reject!(current_user, reason: params[:reason])

          render json: { success: true, data: doc }
        end

        private

        def set_corporate_company
          @corporate_company = CorporateCompany.find(params[:corporate_company_id])
        end

        def department_params
          params.require(:department).permit(:name, :code, :parent_id, :manager_id, :active, :budget_amount, :description, :position)
        end

        def tracking_class_params
          params.require(:tracking_class).permit(:name, :class_type, :code, :parent_id, :active, metadata: {})
        end

        def kpi_params
          params.require(:kpi).permit(
            :name, :code, :category, :formula_type, :format, :target_value,
            :target_direction, :warning_threshold, :critical_threshold,
            :active, :show_on_dashboard, :position,
            formula: {}
          )
        end

        def document_request_params
          params.require(:request).permit(:contact_id, :job_id, :title, :description, :due_date, email_settings: {})
        end

        def find_original_transaction
          type = params[:transaction_type]
          id = params[:transaction_id]

          case type
          when "invoice" then @corporate_company.gl_invoices.find(id)
          when "payment" then @corporate_company.gl_payments.find(id)
          else raise "Unknown transaction type: #{type}"
          end
        end
      end
    end
  end
end
