# frozen_string_literal: true

module Api
  module V1
    module Gl
      class SyncController < ApplicationController
        before_action :set_corporate_company, except: [:providers, :logs]

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
          sync_entity(:sync_accounts, 'Chart of accounts')
        end

        # POST /api/v1/gl/sync/tax_rates
        def tax_rates
          sync_entity(:sync_tax_rates, 'Tax rates')
        end

        # POST /api/v1/gl/sync/currencies
        def currencies
          sync_entity(:sync_currencies, 'Currencies')
        end

        # POST /api/v1/gl/sync/contacts
        def contacts
          sync_entity(:sync_contacts, 'Contacts')
        end

        # POST /api/v1/gl/sync/invoices
        def invoices
          sync_entity(:sync_invoices, 'Invoices')
        end

        # POST /api/v1/gl/sync/bills
        def bills
          sync_entity(:sync_bills, 'Bills')
        end

        # POST /api/v1/gl/sync/payments
        def payments
          sync_entity(:sync_payments, 'Payments')
        end

        # POST /api/v1/gl/sync/bank_transactions
        def bank_transactions
          sync_entity(:sync_bank_transactions, 'Bank transactions')
        end

        # POST /api/v1/gl/sync/credit_notes
        def credit_notes
          sync_entity(:sync_credit_notes, 'Credit notes')
        end

        # POST /api/v1/gl/sync/manual_journals
        def manual_journals
          sync_entity(:sync_manual_journals, 'Manual journals')
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
          # Query sync logs directly - no corporate company required
          scope = ::Gl::SyncLog.order(started_at: :desc)
          scope = scope.where(external_provider: params[:provider]) if params[:provider].present?
          scope = scope.where(external_tenant_id: params[:tenant_id]) if params[:tenant_id].present?
          logs = scope.limit(params[:limit]&.to_i || 20)

          render json: {
            success: true,
            data: logs.map { |log| sync_log_json(log) }
          }
        rescue ActiveRecord::StatementInvalid
          # Table may not exist yet
          render json: { success: true, data: [] }
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
          data = []

          # Get ALL Xero credentials with their associated company connections
          # This allows syncing any company's Xero data, not just the current user's company
          XeroCredential.includes(:corporate_company_xero_connections).order(:tenant_name).each do |xc|
            # Find associated company through connection
            connection = xc.corporate_company_xero_connections.first
            company = connection&.corporate_company

            # Count synced GL accounts for this tenant
            # Note: GL accounts table may not have external_provider/tenant columns yet
            account_count = begin
              ::Gl::Account.where(
                external_provider: 'xero',
                external_tenant_id: xc.tenant_id
              ).count
            rescue ActiveRecord::StatementInvalid
              0
            end

            data << {
              id: "xero_#{xc.id}",
              provider: 'xero',
              tenant_id: xc.tenant_id,
              tenant_name: xc.tenant_name,
              status: xc.status,
              connected: xc.usable?,
              last_sync_at: nil,
              sync_enabled: true,
              two_way_sync: false,
              source: 'xero_credential',
              company_id: company&.id,
              company_name: company&.name,
              account_count: account_count
            }
          end

          # Also check GL::ProviderCredential for any that aren't Xero
          gl_credentials = ::Gl::ProviderCredential
            .where.not(provider: 'xero')
            .order(:provider, :tenant_name)

          gl_credentials.each do |cred|
            data << {
              id: cred.id,
              provider: cred.provider,
              tenant_id: cred.tenant_id,
              tenant_name: cred.tenant_name,
              status: cred.status,
              connected: cred.connected?,
              last_sync_at: cred.last_sync_at,
              sync_enabled: cred.sync_enabled,
              two_way_sync: cred.two_way_sync,
              source: 'gl_provider_credential',
              company_id: cred.corporate_company_id,
              company_name: cred.corporate_company&.name,
              account_count: 0
            }
          end

          render json: { success: true, data: data }
        end

        private

        def set_corporate_company
          # Try to find by explicit param first
          if params[:corporate_company_id].present?
            @corporate_company = CorporateCompany.find(params[:corporate_company_id])
            return
          end

          # Try to find via tenant_id from XeroCredential connection
          if params[:tenant_id].present?
            xero_cred = XeroCredential.find_by(tenant_id: params[:tenant_id])
            if xero_cred
              connection = xero_cred.corporate_company_xero_connections.first
              @corporate_company = connection&.corporate_company
              return if @corporate_company
            end
          end

          # Fallback to current_user's company
          @corporate_company = CorporateCompany.find(current_user&.corporate_company_id)
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: 'Company not found' }, status: :not_found
        end

        def get_adapter
          if params[:provider].present? && params[:provider] != 'standalone'
            # First try GL::ProviderCredential
            credential = ::Gl::ProviderCredential.find_by(
              corporate_company: @corporate_company,
              provider: params[:provider],
              tenant_id: params[:tenant_id]
            )

            if credential
              ::Gl::Adapters.for(@corporate_company, credential: credential)
            elsif params[:provider] == 'xero'
              # Fallback: Use existing XeroCredential via CorporateCompanyXeroConnection
              xero_credential = find_xero_credential
              if xero_credential
                ::Gl::Adapters::Xero.new(@corporate_company, xero_credential: xero_credential)
              else
                ::Gl::Adapters::Standalone.new(@corporate_company)
              end
            else
              ::Gl::Adapters::Standalone.new(@corporate_company)
            end
          else
            ::Gl::Adapters::Standalone.new(@corporate_company)
          end
        end

        def find_xero_credential
          # Find XeroCredential for this company via CorporateCompanyXeroConnection
          connection = CorporateCompanyXeroConnection
            .joins(:xero_credential)
            .where(corporate_company: @corporate_company)
            .first

          xc = connection&.xero_credential
          return xc if xc&.usable?

          # If tenant_id provided, try to match
          if params[:tenant_id].present?
            XeroCredential.find_by(tenant_id: params[:tenant_id], status: 'connected')
          else
            nil
          end
        end

        def render_not_connected
          render json: {
            success: false,
            error: 'Provider not connected'
          }, status: :unprocessable_entity
        end

        # Generic sync entity handler
        def sync_entity(method, entity_name)
          adapter = get_adapter
          return render_not_connected unless adapter.connected?

          # Check if adapter responds to this method
          unless adapter.respond_to?(method)
            return render json: {
              success: true,
              message: "#{entity_name} sync not supported for this provider",
              data: { synced: 0 }
            }
          end

          result = adapter.send(method)

          # Try to extract count from result
          synced = case result
                   when Integer then result
                   when Hash then result[:synced] || result[:count] || 0
                   when Array then result.length
                   else 0
                   end

          render json: {
            success: true,
            message: "#{entity_name} synced",
            data: { synced: synced }
          }
        rescue StandardError => e
          render json: {
            success: false,
            error: "#{entity_name} sync failed: #{e.message}"
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
