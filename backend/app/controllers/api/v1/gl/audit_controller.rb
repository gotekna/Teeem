# frozen_string_literal: true

module Api
  module V1
    module Gl
      # Controller for audit trail and snapshots
      class AuditController < ApplicationController
        before_action :set_corporate_company

        # GET /api/v1/gl/audit/logs
        def logs
          logs = @corporate_company.gl_audit_logs
                                   .includes(:user)
                                   .recent

          logs = logs.for_type(params[:type]) if params[:type].present?
          logs = logs.where(action: params[:action]) if params[:action].present?
          logs = logs.by_user(User.find(params[:user_id])) if params[:user_id].present?

          if params[:start_date].present? && params[:end_date].present?
            logs = logs.in_period(Date.parse(params[:start_date]), Date.parse(params[:end_date]))
          end

          logs = logs.limit(params[:limit] || 100)

          render json: { success: true, data: logs.as_json(include: { user: { only: [:id, :name] } }) }
        end

        # GET /api/v1/gl/audit/record/:type/:id
        def record_history
          logs = @corporate_company.gl_audit_logs
                                   .where(auditable_type: params[:type], auditable_id: params[:id])
                                   .includes(:user)
                                   .recent

          render json: { success: true, data: logs.as_json(include: { user: { only: [:id, :name] } }) }
        end

        # GET /api/v1/gl/audit/snapshots
        def snapshots
          snapshots = @corporate_company.gl_audit_snapshots
                                        .includes(:created_by)
                                        .recent

          snapshots = snapshots.for_type(params[:type]) if params[:type].present?

          render json: { success: true, data: snapshots.as_json(include: { created_by: { only: [:id, :name] } }) }
        end

        # POST /api/v1/gl/audit/snapshots
        def create_snapshot
          snapshot = case params[:snapshot_type]
                     when "daily"
                       ::Gl::AuditSnapshot.daily_snapshot!(@corporate_company, user: current_user)
                     when "monthly"
                       ::Gl::AuditSnapshot.monthly_snapshot!(@corporate_company, user: current_user)
                     when "eofy"
                       ::Gl::AuditSnapshot.eofy_snapshot!(@corporate_company, user: current_user)
                     else
                       render json: { success: false, error: "Invalid snapshot type" }, status: :unprocessable_entity
                       return
                     end

          render json: { success: true, data: snapshot }, status: :created
        end

        # GET /api/v1/gl/audit/snapshots/:id/export
        def export_snapshot
          snapshot = @corporate_company.gl_audit_snapshots.find(params[:id])
          data = snapshot.export_data!

          send_data data,
                    filename: "#{snapshot.reference}_audit_export.json",
                    type: "application/json",
                    disposition: "attachment"
        end

        # GET /api/v1/gl/audit/summary
        def summary
          render json: {
            success: true,
            data: {
              total_logs: @corporate_company.gl_audit_logs.count,
              today: @corporate_company.gl_audit_logs.where("created_at >= ?", Date.current).count,
              this_week: @corporate_company.gl_audit_logs.where("created_at >= ?", 1.week.ago).count,
              by_action: @corporate_company.gl_audit_logs.group(:action).count,
              by_type: @corporate_company.gl_audit_logs.group(:auditable_type).count,
              snapshots: {
                daily: @corporate_company.gl_audit_snapshots.for_type("daily").count,
                monthly: @corporate_company.gl_audit_snapshots.for_type("monthly").count,
                eofy: @corporate_company.gl_audit_snapshots.for_type("eofy").count,
                last_snapshot: @corporate_company.gl_audit_snapshots.recent.first&.snapshot_date
              }
            }
          }
        end

        # GET /api/v1/gl/audit/retainage_releases
        def retainage_releases
          releases = @corporate_company.gl_retainage_releases
                                       .includes(:job, :invoice, :approved_by)
                                       .order(release_date: :desc)

          releases = releases.for_job(Job.find(params[:job_id])) if params[:job_id].present?
          releases = releases.where(status: params[:status]) if params[:status].present?

          render json: { success: true, data: releases.as_json(include: [:job, :invoice]) }
        end

        # POST /api/v1/gl/audit/retainage_releases
        def create_retainage_release
          job = Job.find(params[:job_id])

          release = ::Gl::RetainageRelease.request!(
            job: job,
            amount: params[:amount].to_d,
            release_type: params[:release_type] || "partial",
            conditions: params[:conditions]
          )

          render json: { success: true, data: release }, status: :created
        end

        # POST /api/v1/gl/audit/retainage_releases/:id/approve
        def approve_retainage_release
          release = @corporate_company.gl_retainage_releases.find(params[:id])

          if release.approve!(current_user)
            render json: { success: true, data: release }
          else
            render json: { success: false, error: "Cannot approve release" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/audit/retainage_releases/:id/invoice
        def invoice_retainage_release
          release = @corporate_company.gl_retainage_releases.find(params[:id])
          invoice = release.generate_invoice!

          if invoice
            render json: { success: true, data: { release: release, invoice: invoice } }
          else
            render json: { success: false, error: "Cannot generate invoice. Release must be approved." },
                   status: :unprocessable_entity
          end
        end

        private

        def set_corporate_company
          @corporate_company = Corporate.find(params[:corporate_company_id])
        end
      end
    end
  end
end
