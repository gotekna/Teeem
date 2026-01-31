module Api
  module V1
    class CompanySettingsController < ApplicationController
      # GET /api/v1/company_settings
      def show
        settings = current_tenant_settings
        render json: {
          success: true,
          data: settings_json(settings)
        }
      end

      # PUT/PATCH /api/v1/company_settings
      def update
        settings = current_tenant_settings

        # Extract api_environment - this goes to TenantSetting, not TenantSetting
        # api_environment is an org-wide setting that determines which backend env the company uses
        update_params = company_settings_params.to_h
        api_environment = update_params.delete("api_environment")

        # Update api_environment on TenantSetting (the org-wide singleton)
        # Also sync to CorporateGroup.environment for sidebar badge display
        if api_environment.present?
          corporate_settings = TenantSetting.instance
          unless corporate_settings.update(api_environment: api_environment)
            return render json: {
              success: false,
              error: "Failed to update environment: #{corporate_settings.errors.full_messages.join(', ')}"
            }, status: :unprocessable_entity
          end

          # Keep CorporateGroup.environment in sync (used by sidebar badge)
          tenant = ActsAsTenant.current_tenant
          if tenant && tenant.respond_to?(:environment=)
            tenant.update(environment: api_environment)
          end
        end

        if settings.update(update_params)
          render json: {
            success: true,
            message: "Settings updated successfully",
            data: settings_json(settings)
          }
        else
          render json: {
            success: false,
            error: settings.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/company_settings/test_twilio
      def test_twilio
        settings = current_tenant_settings

        unless settings.twilio_enabled && settings.twilio_account_sid.present? && settings.twilio_auth_token.present? && settings.twilio_phone_number.present?
          return render json: { success: false, error: "Twilio is not configured" }, status: :bad_request
        end

        # Test Twilio connection
        begin
          client = Twilio::REST::Client.new(settings.twilio_account_sid, settings.twilio_auth_token)
          account = client.api.accounts(settings.twilio_account_sid).fetch
          render json: { success: true, message: "Twilio connected successfully", account_name: account.friendly_name }
        rescue Twilio::REST::RestError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        rescue StandardError => e
          render json: { success: false, error: "Failed to connect to Twilio: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/company_settings/upload_logo
      def upload_logo
        settings = current_tenant_settings

        unless params[:logo].present?
          return render json: { success: false, error: "No logo file provided" }, status: :bad_request
        end

        begin
          # Upload to storage (e.g., ActiveStorage or direct URL)
          # For now, we'll store it in the logo_url field
          # You may want to use ActiveStorage for proper file handling
          file = params[:logo]

          # If using ActiveStorage (recommended):
          # settings.logo.attach(file)
          # logo_url = url_for(settings.logo)

          # For now, store the file and save URL
          # This is a placeholder - implement your preferred storage method
          settings.update!(logo_url: "uploaded_logo_placeholder")

          render json: {
            success: true,
            message: "Logo uploaded successfully",
            logo_url: settings.logo_url
          }
        rescue StandardError => e
          render json: {
            success: false,
            error: "Failed to upload logo: #{e.message}"
          }, status: :internal_server_error
        end
      end

      private

      # Get TenantSetting for the current tenant (multi-tenant aware)
      def current_tenant_settings
        tenant = ActsAsTenant.current_tenant
        if tenant
          tenant.settings || tenant.create_tenant_setting!
        else
          # Fallback to legacy singleton if no tenant context (shouldn't happen)
          Rails.logger.warn "[CompanySettings] No tenant context, falling back to TenantSetting"
          TenantSetting.instance
        end
      end

      # Standard JSON response for settings
      def settings_json(settings)
        base = {
          company_name: settings.company_name,
          abn: settings.abn,
          qbcc_license: settings.qbcc_license,
          gst_number: settings.gst_number,
          email: settings.email,
          phone: settings.phone,
          website: settings.website,
          address: settings.address,
          logo_url: settings.logo_url,
          logo_mobile: settings.logo_mobile,
          logo_dark: settings.logo_dark,
          timezone: settings.timezone,
          working_days: settings.working_days || default_working_days,
          team_email_domains: settings.team_email_domains || [],
          # Bank details for invoices
          bank_name: settings.bank_name,
          bank_bsb: settings.bank_bsb,
          bank_account_number: settings.bank_account_number,
          bank_account_name: settings.bank_account_name
        }

        # Always get api_environment from TenantSetting (org-wide singleton)
        # This determines which backend environment the company uses (production/beta/staging)
        base[:api_environment] = TenantSetting.api_environment

        # Link expiry days for presigned URLs (SSoT)
        base[:link_expiry_days] = TenantSetting.link_expiry_days

        # Brand colors in hex format (for email signatures, PDFs, etc.)
        base[:brand_colors] = TenantSetting.brand_colors_hex

        # Company-wide default email signature style (users can override)
        base[:default_email_signature_style] = settings.default_email_signature_style || 'modern-dark'

        base
      end

      def default_working_days
        {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: true
        }
      end

      def company_settings_params
        params.require(:company_setting).permit(
          :company_name,
          :abn,
          :qbcc_license,
          :gst_number,
          :email,
          :phone,
          :website,
          :address,
          :logo_url,
          :logo_mobile,
          :logo_dark,
          :timezone,
          :twilio_account_sid,
          :twilio_auth_token,
          :twilio_phone_number,
          :twilio_enabled,
          # Bank details for invoices
          :bank_name,
          :bank_bsb,
          :bank_account_number,
          :bank_account_name,
          # API Environment (production backend is the "router")
          :api_environment,
          # Company-wide default email signature style
          :default_email_signature_style,
          # NOTE: link_expiry_days is managed via Storage Config (warehouse_providers_controller)
          # It's returned in settings_json for reading but not editable via this endpoint
          working_days: [ :monday, :tuesday, :wednesday, :thursday, :friday, :saturday, :sunday ],
          team_email_domains: []
        )
      end
    end
  end
end
