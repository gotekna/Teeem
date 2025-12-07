module Api
  module V1
    class CompanySettingsController < ApplicationController
      # GET /api/v1/company_settings
      def show
        @company_setting = CompanySetting.instance
        render json: @company_setting
      end

      # PATCH/PUT /api/v1/company_settings
      def update
        @company_setting = CompanySetting.instance

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
    end
  end
end
