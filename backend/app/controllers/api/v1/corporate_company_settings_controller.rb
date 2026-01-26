module Api
  module V1
    class CorporateCompanySettingsController < ApplicationController
      # Security: Require admin for all mutating actions
      before_action :require_admin, only: %i[update update_sharepoint test_twilio test_sharepoint update_brand apply_brand]

      # GET /api/v1/company_settings
      def show
        @company_setting = CorporateCompanySetting.instance
        render json: @company_setting
      end

      # PATCH/PUT /api/v1/company_settings
      def update
        @company_setting = CorporateCompanySetting.instance

        if @company_setting.update(company_setting_params)
          render json: @company_setting
        else
          render json: { errors: @company_setting.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/company_settings/test_twilio
      def test_twilio
        result = TwilioService.test_connection

        if result[:success]
          render json: {
            success: true,
            message: "Twilio connection successful",
            account: result[:account]
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/corporate_company_settings/document_paths
      # SSoT: StorageConfiguration is THE ONE source for storage paths
      # Deprecated: Use /api/v1/storage_configuration instead
      def document_paths
        storage_config = StorageConfiguration.instance
        render json: {
          success: true,
          data: {
            # SSoT: StorageConfiguration is THE ONE source for storage paths
            company_documents_base_path: storage_config&.path_for(:corporate) || "Corporate",
            people_documents_base_path: storage_config&.path_for(:people) || "People",
            job_documents_base_path: storage_config&.path_for(:job) || "Jobs"
          }
        }
      end

      # PATCH /api/v1/corporate_company_settings/document_paths
      # SSoT: StorageConfiguration is THE ONE source for storage paths
      # Deprecated: Use /api/v1/storage_configuration instead
      def update_document_paths
        storage_config = StorageConfiguration.instance

        # SSoT: Update scope_root_folders in StorageConfiguration
        update_attrs = {}
        new_scope_root_folders = storage_config.scope_root_folders&.dup || {}

        if params.dig(:settings, :company_documents_base_path)
          new_scope_root_folders['corporate_entity'] = params.dig(:settings, :company_documents_base_path)
        end
        if params.dig(:settings, :people_documents_base_path)
          new_scope_root_folders['people'] = params.dig(:settings, :people_documents_base_path)
        end
        if params.dig(:settings, :job_documents_base_path)
          new_scope_root_folders['job'] = params.dig(:settings, :job_documents_base_path)
        end

        update_attrs[:scope_root_folders] = new_scope_root_folders if new_scope_root_folders.present?

        if update_attrs.empty? || storage_config.update(update_attrs)
          render json: {
            success: true,
            data: {
              company_documents_base_path: storage_config.path_for(:corporate) || "Corporate",
              people_documents_base_path: storage_config.path_for(:people) || "People",
              job_documents_base_path: storage_config.path_for(:job) || "Jobs"
            }
          }
        else
          render json: {
            success: false,
            errors: storage_config.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # ========================================
      # SharePoint Configuration (SSoT)
      # ========================================

      # GET /api/v1/corporate_company_settings/sharepoint
      # SSoT: Now uses StorageConfiguration for path/connection config
      def sharepoint
        render json: {
          success: true,
          data: StorageConfiguration.instance&.to_config_hash || {}
        }
      end

      # PATCH /api/v1/corporate_company_settings/sharepoint
      # SSoT: Updates StorageConfiguration directly (Jan 2026)
      def update_sharepoint
        storage_config = StorageConfiguration.instance

        # Map frontend params to StorageConfiguration structure
        sp = sharepoint_params

        # Get provider type (default to current or sharepoint)
        provider_type = sp[:provider_type].presence || storage_config.provider_type || "sharepoint"

        # Build connection_config based on provider type
        connection_config = storage_config.connection_config || {}

        if provider_type == "sharepoint"
          # SharePoint connection config
          connection_config["site_url"] = sp[:sharepoint_site_url] if sp.key?(:sharepoint_site_url)
          connection_config["site_id"] = sp[:sharepoint_site_id] if sp.key?(:sharepoint_site_id)
          connection_config["drive_id"] = sp[:sharepoint_drive_id] if sp.key?(:sharepoint_drive_id)
          connection_config["drive_name"] = sp[:sharepoint_drive_name] if sp.key?(:sharepoint_drive_name)
        elsif provider_type.in?(%w[s3 wasabi])
          # S3/Wasabi connection config
          connection_config["endpoint"] = sp[:s3_endpoint] if sp.key?(:s3_endpoint)
          connection_config["bucket"] = sp[:s3_bucket] if sp.key?(:s3_bucket)
          connection_config["region"] = sp[:s3_region] if sp.key?(:s3_region)
        end

        # SSoT: Folder paths are managed by EntityTab (Entity Configurator)
        # StorageConfiguration only handles CONNECTION config
        # paths/templates columns are deprecated and will be removed in future migration

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

        # Update StorageConfiguration (connection + paths)
        update_attrs = {
          provider_type: provider_type,
          connection_config: connection_config,
          status: new_status
        }
        update_attrs[:root_path] = sp[:sharepoint_root_path] if sp.key?(:sharepoint_root_path)
        update_attrs[:scope_folders] = sp[:scope_folders] if sp.key?(:scope_folders)

        # SSoT: Track old templates BEFORE update for automatic file reorganization
        # File name templates (for document downloads)
        if sp.key?(:file_name_templates)
          existing_file_templates = storage_config.file_name_templates || {}
          update_attrs[:file_name_templates] = existing_file_templates.merge(sp[:file_name_templates].to_h)
        end
        # SSoT: Config links for scope folders (URL to external config page)
        # Format: { "contact": "/admin/system/entity-config/contact" } or { "contact": null } to remove
        if sp.key?(:config_links)
          existing_config_links = storage_config.config_links || {}
          new_config_links = sp[:config_links].to_h
          # Merge, but remove keys with null/empty values
          merged_links = existing_config_links.merge(new_config_links).reject { |_, v| v.blank? }
          update_attrs[:config_links] = merged_links
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

      # POST /api/v1/corporate_company_settings/sharepoint/test
      def test_sharepoint
        storage_config = StorageConfiguration.instance

        unless storage_config&.connected?
          return render json: {
            success: false,
            error: "SharePoint is not configured. Please set site_id and drive_id."
          }, status: :unprocessable_entity
        end

        # SSoT: Use MicrosoftCredential.sharepoint_credential
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
            site: {
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

      # ========================================
      # Brand Colors (SSoT for UI Theming)
      # ========================================

      # GET /api/v1/corporate_company_settings/brand
      # Returns current brand colors and settings
      def brand
        render json: {
          success: true,
          data: {
            colors: CorporateCompanySetting.brand_colors,
            website_url: CorporateCompanySetting.instance.website,
            logo_url: CorporateCompanySetting.instance.logo_url,
            logo_mobile: CorporateCompanySetting.instance.logo_mobile,
            logo_dark: CorporateCompanySetting.instance.logo_dark
          }
        }
      end

      # PATCH /api/v1/corporate_company_settings/brand
      # Update brand colors (accepts either HSL or hex values)
      def update_brand
        settings = CorporateCompanySetting.instance

        if settings.update(brand_params)
          render json: {
            success: true,
            data: {
              colors: CorporateCompanySetting.brand_colors,
              website_url: settings.website,
              logo_url: settings.logo_url
            }
          }
        else
          render json: {
            success: false,
            errors: settings.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/corporate_company_settings/brand/detect
      # Auto-detect brand colors from a website URL
      def detect_brand
        url = params[:url]
        return render json: { success: false, error: "URL is required" }, status: :bad_request if url.blank?

        result = BrandExtractorService.extract(url)

        if result[:success]
          # Convert hex colors to HSL for storage
          hsl_colors = {}
          result[:colors].each do |key, hex|
            hsl_colors[key] = CorporateCompanySetting.hex_to_hsl(hex) if hex.present?
          end

          render json: {
            success: true,
            data: {
              company_name: result[:company_name],
              logo_url: result[:logo_url],
              logo_dark_url: result[:logo_dark_url],
              favicon_url: result[:favicon_url],
              colors: {
                hex: result[:colors],
                hsl: hsl_colors
              }
            }
          }
        else
          render json: {
            success: false,
            error: result[:error] || "Could not extract brand from website"
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/corporate_company_settings/brand/apply
      # Apply detected brand colors from a URL
      def apply_brand
        url = params[:url]
        return render json: { success: false, error: "URL is required" }, status: :bad_request if url.blank?

        result = BrandExtractorService.extract(url)

        unless result[:success]
          return render json: {
            success: false,
            error: result[:error] || "Could not extract brand from website"
          }, status: :unprocessable_entity
        end

        settings = CorporateCompanySetting.instance
        applied = []
        skipped = []

        # Only apply colors if not already set (enhance, don't overwrite)
        if settings.brand_color_primary.blank?
          CorporateCompanySetting.update_brand_colors_from_hex(result[:colors])
          applied << "colors"
        else
          skipped << "colors (already set)"
        end

        # Only fill in missing brand assets (enhance, don't overwrite)
        updates = {}

        if settings.website.blank?
          updates[:website] = url
          applied << "website"
        else
          skipped << "website (already set)"
        end

        if settings.logo_url.blank? && result[:logo_url].present?
          updates[:logo_url] = result[:logo_url]
          applied << "logo"
        elsif settings.logo_url.present?
          skipped << "logo (already set)"
        end

        if settings.logo_dark.blank? && result[:logo_dark_url].present?
          updates[:logo_dark] = result[:logo_dark_url]
          applied << "dark logo"
        elsif settings.logo_dark.present?
          skipped << "dark logo (already set)"
        end

        settings.update!(updates) if updates.any?

        # Build message
        message_parts = []
        message_parts << "Applied: #{applied.join(', ')}" if applied.any?
        message_parts << "Skipped: #{skipped.join(', ')}" if skipped.any?

        render json: {
          success: true,
          message: message_parts.join(". "),
          data: {
            colors: CorporateCompanySetting.brand_colors,
            logo_url: settings.logo_url,
            website_url: settings.website
          }
        }
      end

      # ========================================
      # Email Configuration (SSoT)
      # ========================================

      # GET /api/v1/corporate_company_settings/email_config
      def email_config
        render json: {
          success: true,
          data: CorporateCompanySetting.email_config
        }
      end

      # PATCH /api/v1/corporate_company_settings/email_config
      def update_email_config
        settings = CorporateCompanySetting.instance

        if settings.update(email_config_params)
          render json: {
            success: true,
            data: CorporateCompanySetting.email_config
          }
        else
          render json: {
            success: false,
            errors: settings.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      private

      def company_setting_params
        params.require(:company_setting).permit(
          :company_name,
          :abn,
          :gst_number,
          :email,
          :phone,
          :address,
          :logo_url,
          :twilio_account_sid,
          :twilio_auth_token,
          :twilio_phone_number,
          :twilio_enabled,
          :timezone,
          :contact_documents_path,
          # SSoT: contact_folder_format removed - use StorageConfiguration.template_for(:contact)
          working_days: [
            :monday,
            :tuesday,
            :wednesday,
            :thursday,
            :friday,
            :saturday,
            :sunday
          ],
          job_cascade_sort: [ :key, :label, :enabled ]
        )
      end

      def document_paths_params
        params.require(:settings).permit(
          :company_documents_base_path,
          :people_documents_base_path,
          :job_documents_base_path
        )
      end

      def sharepoint_params
        params.require(:sharepoint).permit(
          # Provider type (SSoT)
          :provider_type,
          # SharePoint configuration
          :sharepoint_site_url,
          :sharepoint_site_id,
          :sharepoint_drive_id,
          :sharepoint_drive_name,
          # S3/Wasabi configuration
          :s3_endpoint,
          :s3_bucket,
          :s3_region,
          # Root path
          :sharepoint_root_path,
          # SSoT: Scope folders from StorageConfiguration.effective_scope_folders
          scope_folders: StorageConfiguration.instance.effective_scope_folders.keys.map(&:to_sym),
          # SSoT: File name templates (auto-saved from Entity Config)
          file_name_templates: {},
          # SSoT: Config links for scope folders (URL to external config page)
          config_links: {}
        )
      end

      def email_config_params
        params.require(:email_config).permit(
          :internal_email_domains,
          :monitored_mailbox_pay,
          :monitored_mailbox_newtask,
          :monitored_mailbox_newjob,
          :monitored_mailbox_newcase
        )
      end

      def brand_params
        params.require(:brand).permit(
          :brand_color_primary,
          :brand_color_primary_foreground,
          :brand_color_secondary,
          :brand_color_muted,
          :brand_color_accent,
          :website,
          :logo_url,
          :logo_mobile,
          :logo_dark
        )
      end
    end
  end
end
