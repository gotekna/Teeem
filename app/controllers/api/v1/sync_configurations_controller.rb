module Api
  module V1
    class SyncConfigurationsController < ApplicationController
      before_action :set_sync_configuration, only: [ :show, :update, :preview ]

      # GET /api/v1/sync_configurations
      def index
        @configs = SyncConfiguration.all

        render json: {
          success: true,
          sync_configurations: @configs.map { |config| serialize_config(config) }
        }
      end

      # GET /api/v1/sync_configurations/:xero_tenant_id
      def show
        render json: {
          success: true,
          sync_configuration: serialize_config(@sync_configuration)
        }
      end

      # PUT /api/v1/sync_configurations/:xero_tenant_id
      def update
        if @sync_configuration.update(sync_configuration_params)
          render json: {
            success: true,
            sync_configuration: serialize_config(@sync_configuration)
          }
        else
          render json: {
            success: false,
            errors: @sync_configuration.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/sync_configurations/:xero_tenant_id/preview
      def preview
        # Calculate what would happen if sync ran now
        tenant_id = @sync_configuration.xero_tenant_id

        # Get all contacts linked to this tenant
        links = ContactXeroLink.for_tenant(tenant_id).enabled

        preview_data = {
          total_linked_contacts: links.count,
          contacts_with_errors: links.with_errors.count,
          contacts_with_conflicts: links.with_conflicts.count,
          pending_changes: calculate_pending_changes(links),
          last_full_sync: @sync_configuration.last_full_sync_at,
          webhooks_enabled: @sync_configuration.webhooks_enabled
        }

        render json: {
          success: true,
          preview: preview_data
        }
      end

      # GET /api/v1/sync_configurations/field_mappings
      def field_mappings
        # Return all available field mappings with their options
        render json: {
          success: true,
          available_fields: available_field_mappings,
          directions: [ "import", "export", "bidirectional", "none" ]
        }
      end

      # GET /api/v1/sync_configurations/health
      def health
        # Get comprehensive sync health across all tenants
        configs = SyncConfiguration.all

        health_data = {
          overall_status: calculate_overall_status,
          total_organizations: configs.count,
          sync_enabled_count: configs.where(sync_enabled: true).count,
          webhooks_enabled_count: configs.where(webhooks_enabled: true).count,
          total_linked_contacts: ContactXeroLink.count,
          total_contacts_with_errors: ContactXeroLink.with_errors.count,
          total_contacts_with_conflicts: ContactXeroLink.with_conflicts.count,
          last_sync_activity: ContactXeroLink.maximum(:last_synced_at),
          organizations: configs.map { |config| organization_health(config) },
          recent_errors: recent_sync_errors
        }

        render json: {
          success: true,
          health: health_data
        }
      end

      private

      def set_sync_configuration
        @sync_configuration = SyncConfiguration.find_by(xero_tenant_id: params[:xero_tenant_id])

        # Auto-create config if it doesn't exist (for GET/PUT requests)
        unless @sync_configuration
          # Try to get tenant name from xero_links
          link = ContactXeroLink.find_by(xero_tenant_id: params[:xero_tenant_id])
          tenant_name = link&.xero_tenant_name || "Unknown"

          @sync_configuration = SyncConfiguration.create!(
            xero_tenant_id: params[:xero_tenant_id],
            xero_tenant_name: tenant_name,
            accounting_system: "xero",
            sync_enabled: true,
            field_mappings: SyncConfiguration::DEFAULT_FIELD_MAPPINGS,
            cleanup_options: SyncConfiguration::DEFAULT_CLEANUP_OPTIONS,
            default_sync_direction: SyncConfiguration::DEFAULT_SYNC_DIRECTION
          )
        end
      end

      def sync_configuration_params
        params.require(:sync_configuration).permit(
          :xero_tenant_name,
          :sync_enabled,
          :webhooks_enabled,
          :default_sync_direction,
          field_mappings: {},
          cleanup_options: {}
        )
      end

      def serialize_config(config)
        {
          id: config.id,
          xero_tenant_id: config.xero_tenant_id,
          xero_tenant_name: config.xero_tenant_name,
          accounting_system: config.accounting_system,
          badge_color: config.badge_color,
          sync_enabled: config.sync_enabled,
          webhooks_enabled: config.webhooks_enabled,
          default_sync_direction: config.effective_sync_direction,
          import_enabled: config.import_enabled?,
          export_enabled: config.export_enabled?,
          available_sync_directions: SyncConfiguration::SYNC_DIRECTIONS,
          field_mappings: config.field_mappings.presence || SyncConfiguration::DEFAULT_FIELD_MAPPINGS,
          cleanup_options: config.cleanup_options.presence || SyncConfiguration::DEFAULT_CLEANUP_OPTIONS,
          validation_rules: {
            skip_sync_employees: config.skip_sync_employees?,
            skip_sync_default_suppliers: config.skip_sync_default_suppliers?
          },
          last_full_sync_at: config.last_full_sync_at,
          webhooks_registered_at: config.webhooks_registered_at,
          created_at: config.created_at,
          updated_at: config.updated_at
        }
      end

      def calculate_pending_changes(links)
        # TODO: Compare TEEEM data with cached Xero data to determine pending changes
        # For now, return placeholder counts
        {
          will_import: 0,
          will_export: 0,
          conflicts_to_resolve: links.with_conflicts.count
        }
      end

      def available_field_mappings
        [
          { field: "name", label: "Contact Name", xero_field: "Name", required: true },
          { field: "first_name", label: "First Name", xero_field: "FirstName", required: false },
          { field: "last_name", label: "Last Name", xero_field: "LastName", required: false },
          { field: "email", label: "Email", xero_field: "EmailAddress", required: true },
          { field: "mobile_phone", label: "Mobile Phone", xero_field: "Phones.MOBILE", required: false },
          { field: "office_phone", label: "Office Phone", xero_field: "Phones.DEFAULT", required: false },
          { field: "tax_number", label: "ABN", xero_field: "TaxNumber", required: true },
          { field: "bank_bsb", label: "Bank BSB", xero_field: "BankAccountDetails.BSB", required: true },
          { field: "bank_account_number", label: "Bank Account", xero_field: "BankAccountDetails.AccountNumber", required: true },
          { field: "bank_account_name", label: "Bank Account Name", xero_field: "BankAccountDetails.AccountName", required: true },
          { field: "bill_due_day", label: "Bill Due Day", xero_field: "PaymentTerms.Bills.Day", required: true },
          { field: "bill_due_type", label: "Bill Due Type", xero_field: "PaymentTerms.Bills.Type", required: true },
          { field: "sales_due_day", label: "Sales Due Day", xero_field: "PaymentTerms.Sales.Day", required: true },
          { field: "sales_due_type", label: "Sales Due Type", xero_field: "PaymentTerms.Sales.Type", required: true },
          { field: "contact_persons", label: "Primary Person", xero_field: "ContactPersons", required: false }
        ]
      end

      def calculate_overall_status
        errors_count = ContactXeroLink.with_errors.count
        conflicts_count = ContactXeroLink.with_conflicts.count
        sync_enabled = SyncConfiguration.where(sync_enabled: true).exists?

        if !sync_enabled
          "disabled"
        elsif errors_count > 0
          "error"
        elsif conflicts_count > 0
          "warning"
        else
          "healthy"
        end
      end

      def organization_health(config)
        links = ContactXeroLink.for_tenant(config.xero_tenant_id)

        {
          xero_tenant_id: config.xero_tenant_id,
          xero_tenant_name: config.xero_tenant_name,
          accounting_system: config.accounting_system,
          sync_enabled: config.sync_enabled,
          webhooks_enabled: config.webhooks_enabled,
          linked_contacts: links.count,
          contacts_with_errors: links.with_errors.count,
          contacts_with_conflicts: links.with_conflicts.count,
          last_full_sync: config.last_full_sync_at,
          last_sync_activity: links.maximum(:last_synced_at),
          status: organization_status(config, links)
        }
      end

      def organization_status(config, links)
        return "disabled" unless config.sync_enabled

        errors_count = links.with_errors.count
        conflicts_count = links.with_conflicts.count

        if errors_count > 0
          "error"
        elsif conflicts_count > 0
          "warning"
        else
          "healthy"
        end
      end

      def recent_sync_errors
        ContactXeroLink.with_errors
          .order(updated_at: :desc)
          .limit(10)
          .includes(:contact)
          .map do |link|
            {
              contact_id: link.contact_id,
              contact_name: link.contact&.name,
              xero_tenant_id: link.xero_tenant_id,
              error: link.sync_error,
              last_attempt: link.updated_at
            }
          end
      end
    end
  end
end
