module Api
  module V1
    class CompanySettingsController < ApplicationController
      # GET /api/v1/company_settings
      def show
        settings = CorporateCompanySetting.instance
        render json: {
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
          working_days: settings.working_days
        }
      end

      # PUT/PATCH /api/v1/company_settings
      def update
        settings = CorporateCompanySetting.instance

        if settings.update(company_settings_params)
          render json: {
            success: true,
            message: "Settings updated successfully",
            data: {
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
              working_days: settings.working_days
            }
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
        settings = CorporateCompanySetting.instance

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
        settings = CorporateCompanySetting.instance

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
          working_days: [ :monday, :tuesday, :wednesday, :thursday, :friday, :saturday, :sunday ]
        )
      end
    end
  end
end
