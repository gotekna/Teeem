# frozen_string_literal: true

module Api
  module V1
    module Gl
      class ScheduledReportsController < ApplicationController
        # GET /api/v1/gl/scheduled_reports
        def index
          reports = current_company.gl_scheduled_reports
                                   .includes(:created_by)
                                   .order(created_at: :desc)

          # Filter by status
          reports = reports.active if params[:active] == "true"
          reports = reports.where(active: false) if params[:active] == "false"

          # Filter by report type
          reports = reports.where(report_type: params[:report_type]) if params[:report_type].present?

          render json: {
            success: true,
            data: reports.map { |r| report_json(r) }
          }
        end

        # GET /api/v1/gl/scheduled_reports/:id
        def show
          report = find_report

          render json: {
            success: true,
            data: report_json(report)
          }
        end

        # POST /api/v1/gl/scheduled_reports
        def create
          report = current_company.gl_scheduled_reports.build(report_params)
          report.created_by = current_user
          report.recipients_array = params[:recipients] if params[:recipients].is_a?(Array)

          if report.save
            render json: {
              success: true,
              data: report_json(report),
              message: "Report schedule created"
            }
          else
            render json: {
              success: false,
              error: report.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/scheduled_reports/:id
        def update
          report = find_report
          report.recipients_array = params[:recipients] if params[:recipients].is_a?(Array)

          if report.update(report_params)
            render json: {
              success: true,
              data: report_json(report),
              message: "Report schedule updated"
            }
          else
            render json: {
              success: false,
              error: report.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/scheduled_reports/:id
        def destroy
          report = find_report
          report.destroy

          render json: {
            success: true,
            message: "Report schedule deleted"
          }
        end

        # POST /api/v1/gl/scheduled_reports/:id/pause
        def pause
          report = find_report
          report.pause!

          render json: {
            success: true,
            data: report_json(report),
            message: "Report schedule paused"
          }
        end

        # POST /api/v1/gl/scheduled_reports/:id/resume
        def resume
          report = find_report
          report.resume!

          render json: {
            success: true,
            data: report_json(report),
            message: "Report schedule resumed"
          }
        end

        # POST /api/v1/gl/scheduled_reports/:id/send_now
        def send_now
          report = find_report

          if report.generate_and_send!
            render json: {
              success: true,
              data: report_json(report.reload),
              message: "Report sent successfully"
            }
          else
            render json: {
              success: false,
              error: report.last_error || "Failed to send report"
            }, status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/scheduled_reports/report_types
        def report_types
          render json: {
            success: true,
            data: {
              types: ::Gl::ScheduledReport::REPORT_TYPES.map do |type|
                {
                  value: type,
                  label: type.titleize,
                  description: report_type_description(type)
                }
              end,
              frequencies: ::Gl::ScheduledReport::FREQUENCIES,
              formats: ::Gl::ScheduledReport::FORMATS
            }
          }
        end

        # GET /api/v1/gl/scheduled_reports/history
        def history
          reports = current_company.gl_scheduled_reports
                                   .where.not(last_sent_at: nil)
                                   .order(last_sent_at: :desc)
                                   .limit(params[:limit] || 50)

          render json: {
            success: true,
            data: reports.map do |r|
              {
                id: r.id,
                name: r.name,
                report_type: r.report_type,
                last_sent_at: r.last_sent_at,
                recipients: r.recipients_array,
                send_count: r.send_count
              }
            end
          }
        end

        private

        def find_report
          current_company.gl_scheduled_reports.find(params[:id])
        end

        def report_params
          params.permit(
            :name, :report_type, :frequency, :format,
            :day_of_week, :day_of_month, :send_at,
            :email_subject, :email_body, :active,
            parameters: {}
          )
        end

        def report_json(report)
          {
            id: report.id,
            name: report.name,
            report_type: report.report_type,
            report_type_label: report.report_type.titleize,
            frequency: report.frequency,
            format: report.format,
            day_of_week: report.day_of_week,
            day_of_month: report.day_of_month,
            send_at: report.send_at&.strftime("%H:%M"),
            recipients: report.recipients_array,
            email_subject: report.email_subject,
            email_body: report.email_body,
            parameters: report.parameters,
            active: report.active,
            last_sent_at: report.last_sent_at,
            next_send_at: report.next_send_at,
            send_count: report.send_count,
            last_error: report.last_error,
            created_by: report.created_by&.name,
            created_at: report.created_at
          }
        end

        def report_type_description(type)
          {
            "profit_loss" => "Income and expenses for a period",
            "balance_sheet" => "Assets, liabilities, and equity at a point in time",
            "trial_balance" => "All account balances for verification",
            "aged_receivables" => "Outstanding customer invoices by age",
            "aged_payables" => "Outstanding supplier bills by age",
            "cash_flow" => "Cash inflows and outflows",
            "gst_summary" => "GST collected and paid for BAS",
            "bank_reconciliation" => "Bank statement vs. book balance",
            "job_costing" => "Revenue and costs by job"
          }[type] || ""
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
