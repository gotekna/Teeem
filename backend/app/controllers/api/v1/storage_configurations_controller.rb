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
        render json: {
          success: true,
          data: StorageConfiguration.instance&.to_config_hash || {}
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
        update_attrs[:scope_folders] = sp[:scope_folders] if sp.key?(:scope_folders)

        # Track old templates for file reorganization
        old_templates = storage_config.templates&.deep_dup || {}

        # Merge templates (don't replace entire hash)
        new_templates = nil
        if sp.key?(:scope_templates)
          existing_templates = storage_config.templates || {}
          new_templates = existing_templates.merge(sp[:scope_templates].to_h)
          update_attrs[:templates] = new_templates
        end
        if sp.key?(:file_name_templates)
          existing_file_templates = storage_config.file_name_templates || {}
          update_attrs[:file_name_templates] = existing_file_templates.merge(sp[:file_name_templates].to_h)
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

        # Phase 4: Virtual scopes (which scopes render from DB instead of S3)
        if sp.key?(:virtual_scopes)
          existing_virtual = storage_config.virtual_scopes || {}
          # Merge and convert values to booleans
          merged_virtual = existing_virtual.merge(sp[:virtual_scopes].to_h.transform_values { |v| v.to_s == "true" })
          update_attrs[:virtual_scopes] = merged_virtual
        end

        if storage_config.update(update_attrs)
          enqueue_folder_reorganization_jobs(old_templates, new_templates) if new_templates

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
        # Get permitted scope folder keys - safely handle nil instance
        scope_folder_keys = StorageConfiguration.instance&.effective_scope_folders&.keys&.map(&:to_sym) || []

        params.require(:storage).permit(
          :provider_type,
          # Provider-agnostic connection params
          :site_url, :site_id, :drive_id, :drive_name,  # SharePoint
          :endpoint, :bucket, :region, :access_key_id, :secret_access_key,  # S3/Wasabi
          :base_path,  # Local
          :root_path,
          scope_folders: scope_folder_keys,
          scope_templates: {},
          file_name_templates: {},
          config_links: {},
          document_routing: {},  # SSoT: Which model to use for each document source
          virtual_scopes: {}     # Phase 4: Virtual File Warehouse - which scopes render from DB
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

      def enqueue_folder_reorganization_jobs(old_templates, new_templates)
        return unless old_templates.is_a?(Hash) && new_templates.is_a?(Hash)

        changed_scopes = []

        new_templates.each do |scope, new_template|
          old_template = old_templates[scope.to_s]
          next if old_template == new_template
          next if old_template.blank?

          changed_scopes << {
            scope: scope.to_s,
            old_template: old_template,
            new_template: new_template
          }
        end

        changed_scopes.each do |change|
          Rails.logger.info "[FolderReorg] Template changed for scope '#{change[:scope]}': '#{change[:old_template]}' -> '#{change[:new_template]}'"

          FolderTemplateReorganizationJob.perform_later(
            scope: change[:scope],
            old_template: change[:old_template],
            new_template: change[:new_template]
          )
        end

        Rails.logger.info "[FolderReorg] Enqueued #{changed_scopes.count} reorganization jobs" if changed_scopes.any?
      end
    end
  end
end
