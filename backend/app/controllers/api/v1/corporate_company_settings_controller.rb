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

      # ========================================
      # SharePoint Configuration (SSoT)
      # ========================================

      # GET /api/v1/corporate_company_settings/sharepoint
      def sharepoint
        render json: {
          success: true,
          data: CorporateCompanySetting.sharepoint_config
        }
      end

      # PATCH /api/v1/corporate_company_settings/sharepoint
      def update_sharepoint
        settings = CorporateCompanySetting.instance

        if settings.update(sharepoint_params)
          render json: {
            success: true,
            data: CorporateCompanySetting.sharepoint_config
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
        config = CorporateCompanySetting.sharepoint_config

        unless config[:configured]
          return render json: {
            success: false,
            error: "SharePoint is not configured. Please set site_id and drive_id."
          }, status: :unprocessable_entity
        end

        # SSoT: Use MicrosoftCredential only
        begin
          credential = MicrosoftCredential.active.app_credentials.connected.first

          unless credential
            return render json: {
              success: false,
              error: "No active SharePoint credential found. Please connect in Admin > System > Connections."
            }, status: :unprocessable_entity
          end

          client = MicrosoftAppGraphClient.new(credential)
          site_info = client.get_site(config[:site_id])

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
          :sharepoint_people_path,
          :sharepoint_company_path,
          :sharepoint_contacts_path,
          # Path templates (with placeholders)
          :sharepoint_job_template,
          :sharepoint_company_template,
          :sharepoint_people_template,
          :sharepoint_contacts_template
        )
      end
    end
  end
end
