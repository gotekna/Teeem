module Api
  module V1
    # StorageConfigurationsController - Provider-agnostic storage configuration
    #
    # SSoT: This controller manages StorageConfiguration settings for ANY storage provider
    # (SharePoint, S3, Wasabi, local). Use this instead of the legacy sharepoint endpoints.
    #
    # Replaces: /api/v1/corporate_company_settings/sharepoint
    # New endpoint: /api/v1/storage_configuration
    class StorageConfigurationsController < ApplicationController
      before_action :require_admin, only: %i[update test_connection]

      # GET /api/v1/storage_configuration
      # Returns storage configuration for the current provider
      def show
        config_hash = StorageConfiguration.instance&.to_config_hash || {}

        render json: {
          success: true,
          data: config_hash
        }
      end

      # PATCH /api/v1/storage_configuration
      # Updates storage configuration (provider-agnostic)
      def update
        storage_config = StorageConfiguration.instance

        unless storage_config
          return render json: {
            success: false,
            error: "Storage configuration not found. Please ensure your organization has a document provider configured."
          }, status: :unprocessable_entity
        end

        sp = storage_params

        # Get provider type and normalize legacy values (s3/wasabi → s3_compatible)
        raw_type = sp[:provider_type].presence || storage_config.provider_type || "s3_compatible"
        provider_type = %w[s3 wasabi].include?(raw_type) ? "s3_compatible" : raw_type

        # Build connection_config based on provider type
        connection_config = storage_config.connection_config || {}

        case provider_type
        when "sharepoint"
          connection_config["site_url"] = sp[:site_url] if sp.key?(:site_url)
          connection_config["site_id"] = sp[:site_id] if sp.key?(:site_id)
          connection_config["drive_id"] = sp[:drive_id] if sp.key?(:drive_id)
          connection_config["drive_name"] = sp[:drive_name] if sp.key?(:drive_name)
        when "s3_compatible"
          connection_config["endpoint"] = sp[:endpoint] if sp.key?(:endpoint)
          connection_config["bucket"] = sp[:bucket] if sp.key?(:bucket)
          connection_config["region"] = sp[:region] if sp.key?(:region)
          connection_config["access_key_id"] = sp[:access_key_id] if sp.key?(:access_key_id)
          connection_config["secret_access_key"] = sp[:secret_access_key] if sp.key?(:secret_access_key)
        when "local"
          connection_config["base_path"] = sp[:base_path] if sp.key?(:base_path)
        end

        # Determine status based on provider and connection config
        new_status = case provider_type
        when "sharepoint"
          (connection_config["site_id"].present? && connection_config["drive_id"].present?) ? "connected" : "disconnected"
        when "s3_compatible"
          (connection_config["endpoint"].present? && connection_config["bucket"].present?) ? "connected" : "disconnected"
        when "local"
          "connected"
        else
          "disconnected"
        end

        # Update attributes
        update_attrs = {
          provider_type: provider_type,
          connection_config: connection_config,
          status: new_status
        }
        update_attrs[:root_path] = sp[:root_path] if sp.key?(:root_path)
        # NOTE: scope_folders column was removed - EntityTab is now SSoT for tab paths
        # Only warehouse_folders is stored on StorageConfiguration

        # SSoT: warehouse_folders column is THE ONE source (no merging, just replace)
        # Accept both old and new param names for backwards compatibility
        if sp.key?(:warehouse_folders)
          update_attrs[:warehouse_folders] = sp[:warehouse_folders].to_h
        elsif sp.key?(:scope_root_folders)
          update_attrs[:warehouse_folders] = sp[:scope_root_folders].to_h
        end

        # File name templates (for document downloads)
        if sp.key?(:file_name_templates)
          existing_file_templates = storage_config.file_name_templates || {}
          update_attrs[:file_name_templates] = existing_file_templates.merge(sp[:file_name_templates].to_h)
        end

        # Display name templates (for document display in UI)
        if sp.key?(:display_name_templates)
          existing_display_templates = storage_config.display_name_templates || {}
          update_attrs[:display_name_templates] = existing_display_templates.merge(sp[:display_name_templates].to_h)
        end

        if sp.key?(:config_links)
          existing_config_links = storage_config.config_links || {}
          new_config_links = sp[:config_links].to_h
          merged_links = existing_config_links.merge(new_config_links).reject { |_, v| v.blank? }
          update_attrs[:config_links] = merged_links
        end

        # SSoT: Document routing configuration (which model to use for each source)
        if sp.key?(:document_routing)
          existing_routing = storage_config.document_routing || {}
          update_attrs[:document_routing] = existing_routing.merge(sp[:document_routing].to_h)
        end

        # Phase 4: Virtual warehouses (which warehouse types render from DB instead of S3)
        # Accept both old and new param names for backwards compatibility
        if sp.key?(:virtual_warehouses)
          existing_virtual = storage_config.virtual_warehouses || {}
          # Merge and convert values to booleans
          merged_virtual = existing_virtual.merge(sp[:virtual_warehouses].to_h.transform_values { |v| v.to_s == "true" })
          update_attrs[:virtual_warehouses] = merged_virtual
        elsif sp.key?(:virtual_scopes)
          existing_virtual = storage_config.virtual_warehouses || {}
          # Merge and convert values to booleans
          merged_virtual = existing_virtual.merge(sp[:virtual_scopes].to_h.transform_values { |v| v.to_s == "true" })
          update_attrs[:virtual_warehouses] = merged_virtual
        end

        # SM task exclusion setting (replaces scope_options.task.exclude_sm_linked)
        # Accept both new boolean and legacy nested format
        if sp.key?(:exclude_sm_tasks)
          update_attrs[:exclude_sm_tasks] = sp[:exclude_sm_tasks].to_s == "true"
        elsif sp.key?(:scope_options) && sp[:scope_options].dig(:task, :exclude_sm_linked).present?
          update_attrs[:exclude_sm_tasks] = sp[:scope_options][:task][:exclude_sm_linked].to_s == "true"
        end

        # Update link_expiry_days in CorporateCompanySetting (SSoT)
        if sp.key?(:link_expiry_days)
          CorporateCompanySetting.instance.update!(link_expiry_days: sp[:link_expiry_days].to_i)
        end

        if storage_config.update(update_attrs)
          render json: {
            success: true,
            data: storage_config.to_config_hash
          }
        else
          render json: {
            success: false,
            errors: storage_config.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/storage_configuration/test
      # Test connection to the configured storage provider
      def test_connection
        storage_config = StorageConfiguration.instance

        unless storage_config&.connected?
          return render json: {
            success: false,
            error: "Storage is not configured. Please configure your storage provider."
          }, status: :unprocessable_entity
        end

        case storage_config.provider_type
        when "sharepoint"
          test_sharepoint_connection(storage_config)
        when "s3_compatible"
          test_s3_connection(storage_config)
        when "local"
          test_local_connection(storage_config)
        else
          render json: {
            success: false,
            error: "Unknown storage provider: #{storage_config.provider_type}"
          }, status: :unprocessable_entity
        end
      end

      private

      def storage_params
        # Get permitted warehouse folder keys - safely handle nil instance
        warehouse_folder_keys = StorageConfiguration.instance&.effective_warehouse_folders&.keys&.map(&:to_sym) || []

        params.require(:storage).permit(
          :provider_type,
          # Provider-agnostic connection params
          :site_url, :site_id, :drive_id, :drive_name,  # SharePoint
          :endpoint, :bucket, :region, :access_key_id, :secret_access_key,  # S3/Wasabi
          :base_path,  # Local
          :root_path,
          :exclude_sm_tasks,  # SM task exclusion setting (replaces scope_options)
          :link_expiry_days,  # Link expiry for presigned URLs (saved to CorporateCompanySetting)
          # SSoT: warehouse_folders is THE ONE place for warehouse type roots (includes identifier patterns)
          warehouse_folders: {},
          scope_root_folders: {},  # Legacy backwards compat
          file_name_templates: {},
          display_name_templates: {},
          config_links: {},
          document_routing: {},  # SSoT: Which model to use for each document source
          virtual_warehouses: {},  # Phase 4: Virtual File Warehouse - which warehouse types render from DB
          virtual_scopes: {},      # Legacy backwards compat
          scope_options: {}        # Legacy backwards compat
        )
      end

      def test_sharepoint_connection(storage_config)
        begin
          credential = MicrosoftCredential.sharepoint_credential

          unless credential
            return render json: {
              success: false,
              error: "No active SharePoint credential found. Please connect in Admin > System > Connections."
            }, status: :unprocessable_entity
          end

          client = MicrosoftAppGraphClient.new(credential)
          site_info = client.get_site(storage_config.site_id)

          render json: {
            success: true,
            message: "SharePoint connection successful",
            provider: "sharepoint",
            details: {
              name: site_info["displayName"],
              web_url: site_info["webUrl"]
            }
          }
        rescue => e
          render json: {
            success: false,
            error: "SharePoint connection failed: #{e.message}"
          }, status: :unprocessable_entity
        end
      end

      def test_s3_connection(storage_config)
        begin
          # Use the S3 client to test connection
          client = S3StorageClient.new(storage_config)
          result = client.test_connection

          if result[:success]
            render json: {
              success: true,
              message: "#{storage_config.provider_type.titleize} connection successful",
              provider: storage_config.provider_type,
              details: result[:details]
            }
          else
            render json: {
              success: false,
              error: result[:error]
            }, status: :unprocessable_entity
          end
        rescue => e
          render json: {
            success: false,
            error: "#{storage_config.provider_type.titleize} connection failed: #{e.message}"
          }, status: :unprocessable_entity
        end
      end

      def test_local_connection(storage_config)
        base_path = storage_config.connection_config&.dig("base_path") || Rails.root.join("storage")

        if Dir.exist?(base_path)
          render json: {
            success: true,
            message: "Local storage connection successful",
            provider: "local",
            details: { path: base_path }
          }
        else
          render json: {
            success: false,
            error: "Local storage path does not exist: #{base_path}"
          }, status: :unprocessable_entity
        end
      end

    end
  end
end
