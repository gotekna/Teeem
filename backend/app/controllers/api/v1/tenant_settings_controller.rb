# frozen_string_literal: true

module Api
  module V1
    # TenantSettingsController - SSoT for all tenant configuration
    #
    # Handles: company info, email config, brand colors, storage config
    class TenantSettingsController < ApplicationController
      before_action :require_admin, only: %i[update update_sharepoint test_sharepoint update_brand apply_brand update_email_config]

      # GET /api/v1/tenant_settings
      def show
        render json: TenantSetting.instance
      end

      # PATCH /api/v1/tenant_settings
      def update
        settings = TenantSetting.instance
        if settings.update(tenant_setting_params)
          render json: settings
        else
          render json: { errors: settings.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/tenant_settings/test_twilio
      def test_twilio
        result = TwilioService.test_connection
        if result[:success]
          render json: { success: true, message: "Twilio connection successful", account: result[:account] }
        else
          render json: { success: false, error: result[:error] }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/tenant_settings/document_paths
      def document_paths
        storage_config = WarehouseProvider.instance
        render json: {
          success: true,
          data: {
            company_documents_base_path: storage_config&.path_for(:corporate),
            people_documents_base_path: storage_config&.path_for(:people),
            job_documents_base_path: storage_config&.path_for(:job)
          }
        }
      end

      # GET /api/v1/tenant_settings/sharepoint
      def sharepoint
        render json: { success: true, data: WarehouseProvider.instance&.to_config_hash }
      end

      # PATCH /api/v1/tenant_settings/sharepoint
      def update_sharepoint
        storage_config = WarehouseProvider.instance
        sp = sharepoint_params
        provider_type = sp[:provider_type].presence || storage_config.provider_type

        connection_config = storage_config.connection_config || {}
        case provider_type
        when "sharepoint"
          connection_config["site_url"] = sp[:sharepoint_site_url] if sp.key?(:sharepoint_site_url)
          connection_config["site_id"] = sp[:sharepoint_site_id] if sp.key?(:sharepoint_site_id)
          connection_config["drive_id"] = sp[:sharepoint_drive_id] if sp.key?(:sharepoint_drive_id)
          connection_config["drive_name"] = sp[:sharepoint_drive_name] if sp.key?(:sharepoint_drive_name)
        when "s3_compatible", "wasabi"
          connection_config["endpoint"] = sp[:s3_endpoint] if sp.key?(:s3_endpoint)
          connection_config["bucket"] = sp[:s3_bucket] if sp.key?(:s3_bucket)
          connection_config["region"] = sp[:s3_region] if sp.key?(:s3_region)
        end

        new_status = determine_status(provider_type, connection_config)

        update_attrs = { provider_type: provider_type, connection_config: connection_config, status: new_status }
        update_attrs[:root_path] = sp[:sharepoint_root_path] if sp.key?(:sharepoint_root_path)
        update_attrs[:scope_folders] = sp[:scope_folders] if sp.key?(:scope_folders)

        # Download name templates - accept both old and new param names
        if sp.key?(:download_name_templates)
          update_attrs[:download_name_templates] = (storage_config.download_name_templates || {}).merge(sp[:download_name_templates].to_h)
        elsif sp.key?(:file_name_templates)
          update_attrs[:download_name_templates] = (storage_config.download_name_templates || {}).merge(sp[:file_name_templates].to_h)
        end
        if sp.key?(:config_links)
          update_attrs[:config_links] = (storage_config.config_links || {}).merge(sp[:config_links].to_h).compact_blank
        end

        if storage_config.update(update_attrs)
          render json: { success: true, data: storage_config.to_config_hash }
        else
          render json: { success: false, errors: storage_config.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/tenant_settings/sharepoint/test
      def test_sharepoint
        storage_config = WarehouseProvider.instance
        return render json: { success: false, error: "SharePoint not configured" }, status: :unprocessable_entity unless storage_config&.connected?

        credential = MicrosoftCredential.sharepoint_credential
        return render json: { success: false, error: "No SharePoint credential found" }, status: :unprocessable_entity unless credential

        client = MicrosoftAppGraphClient.new(credential)
        site_info = client.get_site(storage_config.site_id)
        render json: { success: true, message: "SharePoint connected", site: { name: site_info["displayName"], web_url: site_info["webUrl"] } }
      rescue => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/tenant_settings/brand
      def brand
        settings = TenantSetting.instance
        render json: {
          success: true,
          data: {
            colors: TenantSetting.brand_colors,
            website_url: settings.website,
            logo_url: settings.logo_url,
            logo_mobile: settings.logo_mobile,
            logo_dark: settings.logo_dark
          }
        }
      end

      # PATCH /api/v1/tenant_settings/brand
      def update_brand
        settings = TenantSetting.instance
        if settings.update(brand_params)
          render json: { success: true, data: { colors: TenantSetting.brand_colors, website_url: settings.website, logo_url: settings.logo_url } }
        else
          render json: { success: false, errors: settings.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/tenant_settings/brand/detect
      def detect_brand
        url = params[:url]
        return render json: { success: false, error: "URL required" }, status: :bad_request if url.blank?

        result = BrandExtractorService.extract(url)
        return render json: { success: false, error: result[:error] }, status: :unprocessable_entity unless result[:success]

        hsl_colors = result[:colors].transform_values { |hex| hex.present? ? TenantSetting.hex_to_hsl(hex) : nil }.compact
        render json: {
          success: true,
          data: {
            company_name: result[:company_name],
            logo_url: result[:logo_url],
            logo_dark_url: result[:logo_dark_url],
            favicon_url: result[:favicon_url],
            colors: { hex: result[:colors], hsl: hsl_colors }
          }
        }
      end

      # POST /api/v1/tenant_settings/brand/apply
      def apply_brand
        url = params[:url]
        return render json: { success: false, error: "URL required" }, status: :bad_request if url.blank?

        result = BrandExtractorService.extract(url)
        return render json: { success: false, error: result[:error] }, status: :unprocessable_entity unless result[:success]

        settings = TenantSetting.instance
        applied, skipped = [], []

        if settings.brand_color_primary.blank?
          TenantSetting.update_brand_colors_from_hex(result[:colors])
          applied << "colors"
        else
          skipped << "colors"
        end

        updates = {}
        updates[:website] = url if settings.website.blank?
        updates[:logo_url] = result[:logo_url] if settings.logo_url.blank? && result[:logo_url].present?
        updates[:logo_dark] = result[:logo_dark_url] if settings.logo_dark.blank? && result[:logo_dark_url].present?

        applied.concat(updates.keys.map(&:to_s))
        settings.update!(updates) if updates.any?

        render json: {
          success: true,
          message: "Applied: #{applied.join(', ')}#{skipped.any? ? ". Skipped: #{skipped.join(', ')}" : ''}",
          data: { colors: TenantSetting.brand_colors, logo_url: settings.logo_url, website_url: settings.website }
        }
      end

      # GET /api/v1/tenant_settings/email_config
      def email_config
        render json: { success: true, data: TenantSetting.email_config }
      end

      # PATCH /api/v1/tenant_settings/email_config
      def update_email_config
        settings = TenantSetting.instance
        if settings.update(email_config_params)
          render json: { success: true, data: TenantSetting.email_config }
        else
          render json: { success: false, errors: settings.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def determine_status(provider_type, config)
        case provider_type
        when "sharepoint"
          config["site_id"].present? && config["drive_id"].present? ? "connected" : "disconnected"
        when "s3_compatible", "wasabi"
          config["endpoint"].present? && config["bucket"].present? ? "connected" : "disconnected"
        when "local"
          "connected"
        else
          "disconnected"
        end
      end

      def tenant_setting_params
        params.require(:tenant_setting).permit(
          :company_name, :abn, :gst_number, :email, :phone, :address, :logo_url,
          :twilio_account_sid, :twilio_auth_token, :twilio_phone_number, :twilio_enabled,
          :timezone,
          working_days: %i[monday tuesday wednesday thursday friday saturday sunday],
          job_cascade_sort: %i[key label enabled]
        )
      end

      def sharepoint_params
        params.require(:sharepoint).permit(
          :provider_type,
          :sharepoint_site_url, :sharepoint_site_id, :sharepoint_drive_id, :sharepoint_drive_name,
          :s3_endpoint, :s3_bucket, :s3_region,
          :sharepoint_root_path,
          scope_folders: {},
          download_name_templates: {},
          file_name_templates: {},  # Legacy backwards compat
          config_links: {}
        )
      end

      def email_config_params
        params.require(:email_config).permit(
          :internal_email_domains,
          :monitored_mailbox_pay, :monitored_mailbox_newtask,
          :monitored_mailbox_newjob, :monitored_mailbox_newcase
        )
      end

      def brand_params
        params.require(:brand).permit(
          :brand_color_primary, :brand_color_primary_foreground,
          :brand_color_secondary, :brand_color_muted, :brand_color_accent,
          :website, :logo_url, :logo_mobile, :logo_dark
        )
      end
    end
  end
end
