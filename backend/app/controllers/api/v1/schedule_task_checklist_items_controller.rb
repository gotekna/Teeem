# DEPRECATED: Part of the deprecated ScheduleTask system.
# This controller will be removed when ScheduleTask is removed.
module Api
  module V1
    class ScheduleTaskChecklistItemsController < ApplicationController
      before_action :log_deprecation_warning
      before_action :set_schedule_task
      before_action :set_checklist_item, only: [ :update, :destroy, :toggle ]

      # GET /api/v1/schedule_tasks/:schedule_task_id/checklist_items
      def index
        @items = @schedule_task.schedule_task_checklist_items.ordered
        render json: @items
      end

      # POST /api/v1/schedule_tasks/:schedule_task_id/checklist_items
      def create
        @item = @schedule_task.schedule_task_checklist_items.new(checklist_item_params)

        if @item.save
          render json: @item, status: :created
        else
          render json: { errors: @item.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/schedule_tasks/:schedule_task_id/checklist_items/:id
      def update
        if @item.update(checklist_item_params)
          render json: @item
        else
          render json: { errors: @item.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/schedule_tasks/:schedule_task_id/checklist_items/:id/toggle
      def toggle
        if @item.is_completed?
          @item.uncomplete!
        else
          # Get current user name from auth context if available
          user_name = current_user&.name || "User"
          @item.complete!(user_name)
        end

        render json: @item
      end

      # DELETE /api/v1/schedule_tasks/:schedule_task_id/checklist_items/:id
      def destroy
        @item.destroy
        head :no_content
      end

      private

      def log_deprecation_warning
        Rails.logger.warn "[DEPRECATED] ScheduleTaskChecklistItemsController accessed. Part of deprecated ScheduleTask system."
      end

      def set_schedule_task
        @schedule_task = ScheduleTask.find(params[:schedule_task_id])
      end

      def set_checklist_item
        @item = @schedule_task.schedule_task_checklist_items.find(params[:id])
      end

      def checklist_item_params
        params.require(:schedule_task_checklist_item).permit(
          :name,
          :description,
          :category,
          :sequence_order,
          :is_completed
        )
      end
    end
  end
end
