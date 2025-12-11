module Api
  module V1
    class CorporateCompanySettingsController < ApplicationController
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
      def document_paths
        settings = CorporateCompanySetting.instance
        render json: {
          success: true,
          data: {
            company_documents_base_path: settings.company_documents_base_path,
            people_documents_base_path: settings.people_documents_base_path,
            job_documents_base_path: settings.job_documents_base_path
          }
        }
      end

      # PATCH /api/v1/corporate_company_settings/document_paths
      def update_document_paths
        settings = CorporateCompanySetting.instance

        if settings.update(document_paths_params)
          render json: {
            success: true,
            data: {
              company_documents_base_path: settings.company_documents_base_path,
              people_documents_base_path: settings.people_documents_base_path,
              job_documents_base_path: settings.job_documents_base_path
            }
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
    end
  end
end
