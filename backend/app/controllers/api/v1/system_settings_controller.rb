module Api
  module V1
    class SystemSettingsController < ApplicationController
      # GET /api/v1/system_settings
      # Get all system settings or specific settings by keys
      def index
        if params[:keys].present?
          keys = params[:keys].split(",")
          settings = keys.each_with_object({}) do |key, hash|
            hash[key] = SystemSetting.get(key)
          end
          render json: { settings: settings }
        else
          settings = SystemSetting.all
          render json: { settings: settings }
        end
      end

      # GET /api/v1/system_settings/sharepoint_path_templates
      # Get SharePoint path templates
      def sharepoint_path_templates
        templates = SystemSetting.sharepoint_path_templates
        render json: { templates: templates }
      end

      # PUT /api/v1/system_settings/sharepoint_path_templates
      # Update SharePoint path templates
      def update_sharepoint_path_templates
        templates = params.require(:templates).permit(:company, :job, :people)

        SystemSetting.update_sharepoint_path_templates(
          company: templates[:company],
          job: templates[:job],
          people: templates[:people]
        )

        render json: {
          success: true,
          templates: SystemSetting.sharepoint_path_templates
        }
      rescue StandardError => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      # PUT /api/v1/system_settings/:key
      # Update a single setting
      def update
        key = params[:key]
        value = params[:value]
        type = params[:type] || "string"
        description = params[:description]

        setting = SystemSetting.set(key, value, type: type, description: description)

        render json: {
          success: true,
          setting: setting
        }
      rescue StandardError => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end
    end
  end
end
