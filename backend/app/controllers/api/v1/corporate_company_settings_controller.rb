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
      # SSoT: Reads from sharepoint_* columns (the SSoT) but returns legacy key names for compatibility
      # Deprecated: Use /api/v1/corporate_company_settings/sharepoint instead
      def document_paths
        settings = CorporateCompanySetting.instance
        render json: {
          success: true,
          data: {
            # SSoT: Use sharepoint_* columns, return with legacy key names for backward compatibility
            company_documents_base_path: settings.sharepoint_company_path.presence || "Corporate",
            people_documents_base_path: settings.sharepoint_people_path.presence || "Corporate/People",
            job_documents_base_path: settings.sharepoint_jobs_path.presence || "Jobs"
          }
        }
      end

      # PATCH /api/v1/corporate_company_settings/document_paths
      # SSoT: Writes to sharepoint_* columns (the SSoT)
      # Deprecated: Use /api/v1/corporate_company_settings/sharepoint instead
      def update_document_paths
        settings = CorporateCompanySetting.instance

        # SSoT: Map legacy param names to SSoT column names
        ssot_params = {}
        ssot_params[:sharepoint_company_path] = params.dig(:settings, :company_documents_base_path) if params.dig(:settings, :company_documents_base_path)
        ssot_params[:sharepoint_people_path] = params.dig(:settings, :people_documents_base_path) if params.dig(:settings, :people_documents_base_path)
        ssot_params[:sharepoint_jobs_path] = params.dig(:settings, :job_documents_base_path) if params.dig(:settings, :job_documents_base_path)

        if settings.update(ssot_params)
          render json: {
            success: true,
            data: {
              company_documents_base_path: settings.sharepoint_company_path.presence || "Corporate",
              people_documents_base_path: settings.sharepoint_people_path.presence || "Corporate/People",
              job_documents_base_path: settings.sharepoint_jobs_path.presence || "Jobs"
            }
          }
        else
          render json: {
            success: false,
            errors: settings.errors.full_messages
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
      # NOTE: Still updates CorporateCompanySetting for backwards compatibility
      # TODO: Migrate to updating StorageConfiguration directly
      def update_sharepoint
        settings = CorporateCompanySetting.instance

        if settings.update(sharepoint_params)
          render json: {
            success: true,
            data: StorageConfiguration.instance&.to_config_hash || {}
          }
        else
          render json: {
            success: false,
            errors: settings.errors.full_messages
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
          :contact_folder_format,
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
          # Site configuration
          :sharepoint_site_url,
          :sharepoint_site_id,
          :sharepoint_drive_id,
          :sharepoint_drive_name,
          # Folder paths (relative to root)
          :sharepoint_root_path,
          :sharepoint_jobs_path,
          :sharepoint_tasks_path,
          :sharepoint_people_path,
          :sharepoint_company_path,
          :sharepoint_contacts_path,
          # Path templates (with placeholders)
          :sharepoint_job_template,
          :sharepoint_task_template,
          :sharepoint_company_template,
          :sharepoint_people_template,
          :sharepoint_contacts_template
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
