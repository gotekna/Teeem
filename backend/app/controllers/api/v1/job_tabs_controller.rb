module Api
  module V1
    class JobTabsController < ApplicationController
      before_action :require_authentication

      # GET /api/v1/job_tabs
      # Returns user's personalized job tab configuration
      def index
        # Initialize or sync user's tab config if needed
        unless current_user.user_job_tab_configs.exists?
          UserJobTabConfig.initialize_for_user(current_user)
        else
          UserJobTabConfig.sync_new_tabs_for_user(current_user)
        end

        # Get hierarchical tab config for user
        tabs = UserJobTabConfig.hierarchical_for_user(current_user)

        render json: {
          success: true,
          tabs: tabs
        }
      end

      # PATCH /api/v1/job_tabs/reorder
      # Update user's tab order and hierarchy
      def reorder
        ActiveRecord::Base.transaction do
          reorder_params.each do |tab_data|
            config = current_user.user_job_tab_configs.find_by(job_tab_id: tab_data[:id])
            next unless config

            config.update!(
              position: tab_data[:position],
              parent_job_tab_id: tab_data[:parent_id]
            )
          end
        end

        render json: { success: true }
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # PATCH /api/v1/job_tabs/:id/toggle_hidden
      def toggle_hidden
        config = current_user.user_job_tab_configs.find_by(job_tab_id: params[:id])

        if config
          config.update!(is_hidden: !config.is_hidden)
          render json: { success: true, is_hidden: config.is_hidden }
        else
          render json: { success: false, error: "Config not found" }, status: :not_found
        end
      end

      # PATCH /api/v1/job_tabs/:id/set_parent
      def set_parent
        config = current_user.user_job_tab_configs.find_by(job_tab_id: params[:id])

        if config
          parent_id = params[:parent_id].presence
          config.update!(parent_job_tab_id: parent_id)
          render json: { success: true }
        else
          render json: { success: false, error: "Config not found" }, status: :not_found
        end
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/job_tabs/reset
      # Reset user's tab config to system defaults
      def reset
        UserJobTabConfig.reset_for_user(current_user)
        tabs = UserJobTabConfig.hierarchical_for_user(current_user)

        render json: { success: true, tabs: tabs }
      end

      private

      def reorder_params
        params.require(:tabs).map do |tab|
          tab.permit(:id, :position, :parent_id).to_h.symbolize_keys
        end
      end
    end
  end
end
