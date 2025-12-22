# frozen_string_literal: true

module Api
  module V1
    class SmSettingsController < ApplicationController
      # GET /api/v1/sm_settings
      def show
        @settings = SmSetting.instance

        render json: {
          success: true,
          settings: settings_to_json(@settings),
          available_timezones: SmSetting::TIMEZONES,
          available_templates: available_templates
        }
      end

      # PATCH /api/v1/sm_settings
      def update
        @settings = SmSetting.instance

        if @settings.update(settings_params)
          render json: {
            success: true,
            message: "Settings updated successfully",
            settings: settings_to_json(@settings)
          }
        else
          render json: {
            success: false,
            errors: @settings.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      private

      def settings_params
        params.require(:settings).permit(
          :rollover_time,
          :rollover_timezone,
          :rollover_enabled,
          :notify_on_hold,
          :notify_on_supplier_confirm,
          :notify_on_rollover
        )
      end

      def settings_to_json(settings)
        # Get default template from SmTemplate (THE ONE template system - SSoT)
        default_template = SmTemplate.default_template.first

        {
          id: settings.id,
          rollover_time: settings.rollover_time&.strftime("%H:%M"),
          rollover_timezone: settings.rollover_timezone,
          rollover_enabled: settings.rollover_enabled,
          notify_on_hold: settings.notify_on_hold,
          notify_on_supplier_confirm: settings.notify_on_supplier_confirm,
          notify_on_rollover: settings.notify_on_rollover,
          default_template_id: default_template&.id,
          default_template: default_template&.slice(:id, :name),
          # Computed values
          current_time: settings.current_time,
          today: settings.today,
          rollover_due: settings.rollover_due?,
          updated_at: settings.updated_at
        }
      end

      def available_templates
        # Use SmTemplate (THE ONE template system - SSoT)
        SmTemplate.order(:name).pluck(:id, :name).map do |id, name|
          { id: id, name: name }
        end
      end
    end
  end
end
