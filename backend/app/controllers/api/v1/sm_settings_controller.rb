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

      # GET /api/v1/sm_settings/tags
      def tags
        @settings = SmSetting.instance
        render json: {
          success: true,
          tags: @settings.tags
        }
      end

      # POST /api/v1/sm_settings/tags
      def add_tag
        @settings = SmSetting.instance
        tag_name = params[:tag]&.strip

        if tag_name.blank?
          return render json: { success: false, error: "Tag name is required" }, status: :unprocessable_entity
        end

        if @settings.add_tag(tag_name)
          render json: {
            success: true,
            message: "Tag added",
            tags: @settings.tags
          }
        else
          render json: {
            success: false,
            error: "Tag already exists or invalid"
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_settings/tags/:tag
      def remove_tag
        @settings = SmSetting.instance
        tag_name = params[:tag]

        if @settings.remove_tag(tag_name)
          render json: {
            success: true,
            message: "Tag removed",
            tags: @settings.tags
          }
        else
          render json: {
            success: false,
            error: "Tag not found"
          }, status: :not_found
        end
      end

      # PATCH /api/v1/sm_settings/tags/:tag
      def rename_tag
        @settings = SmSetting.instance
        old_name = params[:tag]
        new_name = params[:new_name]&.strip

        if new_name.blank?
          return render json: { success: false, error: "New name is required" }, status: :unprocessable_entity
        end

        if @settings.rename_tag(old_name, new_name)
          render json: {
            success: true,
            message: "Tag renamed",
            tags: @settings.tags
          }
        else
          render json: {
            success: false,
            error: "Tag not found or new name already exists"
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/sm_settings/trades
      def trades
        @settings = SmSetting.instance
        render json: {
          success: true,
          trades: @settings.trades
        }
      end

      # POST /api/v1/sm_settings/trades
      def add_trade
        @settings = SmSetting.instance
        trade_name = params[:trade]&.strip

        if trade_name.blank?
          return render json: { success: false, error: "Trade name is required" }, status: :unprocessable_entity
        end

        if @settings.add_trade(trade_name)
          render json: {
            success: true,
            message: "Trade added",
            trades: @settings.trades
          }
        else
          render json: {
            success: false,
            error: "Trade already exists or invalid"
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_settings/trades/:trade
      def remove_trade
        @settings = SmSetting.instance
        trade_name = params[:trade]

        if @settings.remove_trade(trade_name)
          render json: {
            success: true,
            message: "Trade removed",
            trades: @settings.trades
          }
        else
          render json: {
            success: false,
            error: "Trade not found"
          }, status: :not_found
        end
      end

      # GET /api/v1/sm_settings/stages
      def stages
        @settings = SmSetting.instance
        render json: {
          success: true,
          stages: @settings.stages
        }
      end

      # POST /api/v1/sm_settings/stages
      def add_stage
        @settings = SmSetting.instance
        stage_name = params[:stage]&.strip

        if stage_name.blank?
          return render json: { success: false, error: "Stage name is required" }, status: :unprocessable_entity
        end

        if @settings.add_stage(stage_name)
          render json: {
            success: true,
            message: "Stage added",
            stages: @settings.stages
          }
        else
          render json: {
            success: false,
            error: "Stage already exists or invalid"
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_settings/stages/:stage
      def remove_stage
        @settings = SmSetting.instance
        stage_name = params[:stage]

        if @settings.remove_stage(stage_name)
          render json: {
            success: true,
            message: "Stage removed",
            stages: @settings.stages
          }
        else
          render json: {
            success: false,
            error: "Stage not found"
          }, status: :not_found
        end
      end

      # GET /api/v1/sm_settings/roles
      # Returns configurable schedule master roles (custom per-org)
      def roles
        @settings = SmSetting.instance
        render json: {
          success: true,
          roles: @settings.roles
        }
      end

      # GET /api/v1/sm_settings/assignable_roles
      # SSoT: Returns User::ASSIGNABLE_ROLES for task assignment dropdowns
      # Frontend should fetch this instead of hardcoding roles
      def assignable_roles
        render json: {
          success: true,
          assignable_roles: User::ASSIGNABLE_ROLES.map do |role|
            { value: role, label: role.titleize }
          end
        }
      end

      # POST /api/v1/sm_settings/roles
      def add_role
        @settings = SmSetting.instance
        role_name = params[:role]&.strip

        if role_name.blank?
          return render json: { success: false, error: "Role name is required" }, status: :unprocessable_entity
        end

        if @settings.add_role(role_name)
          render json: {
            success: true,
            message: "Role added",
            roles: @settings.roles
          }
        else
          render json: {
            success: false,
            error: "Role already exists or invalid"
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_settings/roles/:role
      def remove_role
        @settings = SmSetting.instance
        role_name = params[:role]

        if @settings.remove_role(role_name)
          render json: {
            success: true,
            message: "Role removed",
            roles: @settings.roles
          }
        else
          render json: {
            success: false,
            error: "Role not found"
          }, status: :not_found
        end
      end

      private

      def settings_params
        permitted = params.require(:settings).permit(
          :rollover_time,
          :rollover_timezone,
          :rollover_enabled,
          :notify_on_hold,
          :notify_on_supplier_confirm,
          :notify_on_rollover
        )

        # Handle gantt_column_config as arbitrary JSON (array of column configs)
        if params[:settings][:gantt_column_config].present?
          permitted[:gantt_column_config] = params[:settings][:gantt_column_config].map do |col|
            col.permit(:id, :label, :shortLabel, :width, :visible, :align).to_h
          end
        end

        permitted
      end

      def settings_to_json(settings)
        # Get default template from SmScheduleMasterTemplate (THE ONE template system - SSoT)
        default_template = SmScheduleMasterTemplate.default_template.first

        {
          id: settings.id,
          rollover_time: settings.rollover_time&.strftime("%H:%M"),
          rollover_timezone: settings.rollover_timezone,
          rollover_enabled: settings.rollover_enabled,
          notify_on_hold: settings.notify_on_hold,
          notify_on_supplier_confirm: settings.notify_on_supplier_confirm,
          notify_on_rollover: settings.notify_on_rollover,
          gantt_column_config: settings.gantt_column_config,
          default_template_id: default_template&.id,
          default_template: default_template&.slice(:id, :name),
          # Schedule Master tags for grouping
          schedule_master_tags: settings.tags,
          # Computed values
          current_time: settings.current_time,
          today: settings.today,
          rollover_due: settings.rollover_due?,
          updated_at: settings.updated_at
        }
      end

      def available_templates
        # Use SmScheduleMasterTemplate (THE ONE template system - SSoT)
        SmScheduleMasterTemplate.order(:name).pluck(:id, :name).map do |id, name|
          { id: id, name: name }
        end
      end
    end
  end
end
