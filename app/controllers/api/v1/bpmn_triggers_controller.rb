module Api
  module V1
    class BpmnTriggersController < ApplicationController
      before_action :set_process
      before_action :set_trigger, only: [:show, :update, :destroy, :activate, :deactivate]

      def index
        @triggers = @process.bpmn_triggers.order(:created_at)

        render json: {
          success: true,
          triggers: @triggers.map { |t| serialize_trigger(t) }
        }
      end

      def show
        render json: {
          success: true,
          trigger: serialize_trigger(@trigger)
        }
      end

      def create
        @trigger = @process.bpmn_triggers.build(trigger_params)

        if @trigger.save
          render json: { success: true, trigger: serialize_trigger(@trigger) }, status: :created
        else
          render json: { success: false, errors: @trigger.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def update
        if @trigger.update(trigger_params)
          render json: { success: true, trigger: serialize_trigger(@trigger) }
        else
          render json: { success: false, errors: @trigger.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def destroy
        @trigger.destroy!
        render json: { success: true }
      end

      def activate
        @trigger.activate!
        render json: { success: true, trigger: serialize_trigger(@trigger) }
      end

      def deactivate
        @trigger.deactivate!
        render json: { success: true, trigger: serialize_trigger(@trigger) }
      end

      private

      def set_process
        @process = BpmnProcess.find(params[:bpmn_process_id])
      end

      def set_trigger
        @trigger = @process.bpmn_triggers.find(params[:id])
      end

      def trigger_params
        params.require(:bpmn_trigger).permit(
          :trigger_type, :name, :is_active,
          config: {}
        )
      end

      def serialize_trigger(trigger)
        {
          id: trigger.id,
          bpmn_process_id: trigger.bpmn_process_id,
          trigger_type: trigger.trigger_type,
          name: trigger.name,
          is_active: trigger.is_active,
          config: trigger.config,
          description: trigger.description,
          created_at: trigger.created_at,
          updated_at: trigger.updated_at
        }
      end
    end
  end
end
