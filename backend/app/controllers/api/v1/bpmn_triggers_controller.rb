module Api
  module V1
    class BpmnTriggersController < ApplicationController
      # Whitelist of allowed subject types for BPMN workflows
      # Add new models here when they include BpmnTriggerable
      ALLOWED_SUBJECT_TYPES = %w[
        Job
        Contact
        Construction
        Case
        SmTask
        PurchaseOrder
        Estimate
        QuoteRequest
      ].freeze

      before_action :set_process
      before_action :set_trigger, only: [:show, :update, :destroy, :activate, :deactivate, :fire]

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

      # POST /api/v1/bpmn_processes/:bpmn_process_id/bpmn_triggers/:id/fire
      # Manually fire a trigger to start a workflow
      def fire
        subject_type_name = params[:subject_type].to_s
        subject_id = params[:subject_id]
        variables = params[:variables] || {}

        unless subject_type_name.present? && subject_id.present?
          return render json: {
            success: false,
            error: "subject_type and subject_id are required"
          }, status: :unprocessable_entity
        end

        # Validate subject_type against whitelist to prevent RCE
        unless ALLOWED_SUBJECT_TYPES.include?(subject_type_name)
          return render json: {
            success: false,
            error: "Invalid subject_type: #{subject_type_name}. Allowed types: #{ALLOWED_SUBJECT_TYPES.join(', ')}"
          }, status: :unprocessable_entity
        end

        # Resolve the subject (safe - subject_type is whitelisted)
        begin
          subject = subject_type_name.constantize.find(subject_id)
        rescue ActiveRecord::RecordNotFound
          return render json: { success: false, error: "Subject not found" }, status: :not_found
        end

        # Fire the trigger
        instance = Bpmn::TriggerFiringService.fire_manual(
          trigger_id: @trigger.id,
          subject: subject,
          variables: variables,
          user: current_user
        )

        render json: {
          success: true,
          process_instance: {
            id: instance.id,
            status: instance.status,
            started_at: instance.started_at
          }
        }
      rescue ArgumentError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
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
