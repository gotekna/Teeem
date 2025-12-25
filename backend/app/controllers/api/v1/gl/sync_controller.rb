# frozen_string_literal: true

module Api
  module V1
    module Gl
      class SyncController < ApplicationController
        before_action :set_corporate_company

        # GET /api/v1/gl/sync/status
        def status
          adapter = get_adapter
          service = ::Gl::SyncService.new(adapter)

          render json: {
            success: true,
            data: service.sync_status
          }
        end

        # POST /api/v1/gl/sync/full
        def full
          adapter = get_adapter
          return render_not_connected unless adapter.connected?

          service = ::Gl::SyncService.new(adapter)

          # Run in background if requested
          if params[:background] == 'true'
            GlSyncJob.perform_later(@corporate_company.id, params[:provider], params[:tenant_id], 'full')

            render json: {
              success: true,
              message: 'Full sync started in background',
              data: { status: 'queued' }
            }
          else
            service.sync_all

            render json: {
              success: true,
              message: 'Full sync completed',
              data: service.sync_status
            }
          end
        rescue StandardError => e
          render json: {
            success: false,
            error: "Sync failed: #{e.message}"
          }, status: :unprocessable_entity
        end

        # POST /api/v1/gl/sync/incremental
        def incremental
          adapter = get_adapter
          return render_not_connected unless adapter.connected?

          service = ::Gl::SyncService.new(adapter)

          if params[:background] == 'true'
            GlSyncJob.perform_later(@corporate_company.id, params[:provider], params[:tenant_id], 'incremental')

            render json: {
              success: true,
              message: 'Incremental sync started in background',
              data: { status: 'queued' }
            }
          else
            service.sync_incremental

            render json: {
              success: true,
              message: 'Incremental sync completed',
              data: service.sync_status
            }
          end
        rescue StandardError => e
          render json: {
            success: false,
            error: "Sync failed: #{e.message}"
          }, status: :unprocessable_entity
        end

        # POST /api/v1/gl/sync/accounts
        def accounts
          adapter = get_adapter
          return render_not_connected unless adapter.connected?

          adapter.sync_accounts

          render json: {
            success: true,
            message: 'Chart of accounts synced'
          }
        rescue StandardError => e
          render json: {
            success: false,
            error: "Sync failed: #{e.message}"
          }, status: :unprocessable_entity
        end

        # POST /api/v1/gl/sync/recalculate_balances
        def recalculate_balances
          adapter = get_adapter
          service = ::Gl::SyncService.new(adapter)

          service.recalculate_balances

          render json: {
            success: true,
            message: 'Balances recalculated'
          }
        rescue StandardError => e
          render json: {
            success: false,
            error: "Recalculation failed: #{e.message}"
          }, status: :unprocessable_entity
        end

        # GET /api/v1/gl/sync/logs
        def logs
          adapter = get_adapter
          service = ::Gl::SyncService.new(adapter)

          logs = service.recent_syncs(limit: params[:limit]&.to_i || 20)

          render json: {
            success: true,
            data: logs.map { |log| sync_log_json(log) }
          }
        end

        # GET /api/v1/gl/sync/logs/:id
        def log_detail
          log = ::Gl::SyncLog.find(params[:id])

          render json: {
            success: true,
            data: sync_log_json(log, detailed: true)
          }
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: 'Log not found' }, status: :not_found
        end

        # GET /api/v1/gl/sync/providers
        def providers
          credentials = ::Gl::ProviderCredential
            .where(corporate_company: @corporate_company)
            .order(:provider, :tenant_name)

          data = credentials.map do |cred|
            {
              id: cred.id,
              provider: cred.provider,
              tenant_id: cred.tenant_id,
              tenant_name: cred.tenant_name,
              status: cred.status,
              connected: cred.connected?,
              last_sync_at: cred.last_sync_at,
              sync_enabled: cred.sync_enabled,
              two_way_sync: cred.two_way_sync
            }
          end

          # Add standalone option
          data.unshift({
            id: nil,
            provider: 'standalone',
            tenant_id: 'local',
            tenant_name: 'TEEEM Standalone',
            status: 'connected',
            connected: true,
            last_sync_at: nil,
            sync_enabled: true,
            two_way_sync: false
          })

          render json: { success: true, data: data }
        end

        private

        def set_corporate_company
          @corporate_company = CorporateCompany.find(params[:corporate_company_id] || current_user&.corporate_company_id)
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: 'Company not found' }, status: :not_found
        end

        def get_adapter
          if params[:provider].present? && params[:provider] != 'standalone'
            credential = ::Gl::ProviderCredential.find_by(
              corporate_company: @corporate_company,
              provider: params[:provider],
              tenant_id: params[:tenant_id]
            )

            if credential
              ::Gl::Adapters.for(@corporate_company, credential: credential)
            else
              ::Gl::Adapters::Standalone.new(@corporate_company)
            end
          else
            ::Gl::Adapters::Standalone.new(@corporate_company)
          end
        end

        def render_not_connected
          render json: {
            success: false,
            error: 'Provider not connected'
          }, status: :unprocessable_entity
        end

        def sync_log_json(log, detailed: false)
          json = {
            id: log.id,
            provider: log.external_provider,
            tenant_id: log.external_tenant_id,
            sync_type: log.sync_type,
            status: log.status,
            status_badge: log.status_badge,
            started_at: log.started_at,
            completed_at: log.completed_at,
            duration: log.formatted_duration,
            trigger: log.trigger,
            stats: log.stats_summary
          }

          if detailed
            json[:error_message] = log.error_message
            json[:error_details] = log.error_details
            json[:details] = log.details
          end

          json
        end
      end
    end
  end
end
