module Api
  module V1
    class BpmnProcessInstancesController < ApplicationController
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

      before_action :set_instance, only: [:show, :cancel, :suspend, :resume]

      def index
        @instances = BpmnProcessInstance
          .includes(:bpmn_process, :bpmn_tokens)
          .order(created_at: :desc)

        # Filtering
        @instances = @instances.where(status: params[:status]) if params[:status].present?
        @instances = @instances.where(bpmn_process_id: params[:process_id]) if params[:process_id].present?
        @instances = @instances.where(subject_type: params[:subject_type]) if params[:subject_type].present?
        @instances = @instances.where(subject_id: params[:subject_id]) if params[:subject_id].present?

        # Pagination
        @instances = @instances.limit(params[:limit] || 100)
        @instances = @instances.offset(params[:offset]) if params[:offset].present?

        render json: {
          success: true,
          instances: @instances.map { |i| serialize_instance(i) },
          total: BpmnProcessInstance.count
        }
      end

      def show
        render json: {
          success: true,
          instance: serialize_instance_full(@instance)
        }
      end

      def create
        process = BpmnProcess.published.find(params[:bpmn_process_id])
        subject = find_subject

        @instance = Bpmn::EngineService.start_process(
          process_id: process.id,
          subject: subject,
          variables: params[:variables]&.to_unsafe_h || {},
          triggered_by: "user:#{current_user&.id}"
        )

        render json: { success: true, instance: serialize_instance(@instance) }, status: :created
      rescue ArgumentError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      rescue Bpmn::EngineService::ProcessError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      rescue ActiveRecord::RecordNotFound => e
        render json: { success: false, error: e.message }, status: :not_found
      end

      def cancel
        @instance.cancel!(params[:reason])
        render json: { success: true, instance: serialize_instance(@instance) }
      end

      def suspend
        @instance.suspend!
        render json: { success: true, instance: serialize_instance(@instance) }
      end

      def resume
        @instance.resume!
        render json: { success: true, instance: serialize_instance(@instance) }
      end

      # Get instances for a specific subject
      def for_subject
        subject = find_subject
        @instances = BpmnProcessInstance.for_subject(subject).order(created_at: :desc)

        render json: {
          success: true,
          instances: @instances.map { |i| serialize_instance(i) }
        }
      rescue ArgumentError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      rescue ActiveRecord::RecordNotFound => e
        render json: { success: false, error: e.message }, status: :not_found
      end

      private

      def set_instance
        @instance = BpmnProcessInstance.find(params[:id])
      end

      def find_subject
        subject_type_name = params[:subject_type].to_s

        unless ALLOWED_SUBJECT_TYPES.include?(subject_type_name)
          raise ArgumentError, "Invalid subject_type: #{subject_type_name}. Allowed types: #{ALLOWED_SUBJECT_TYPES.join(', ')}"
        end

        subject_type = subject_type_name.constantize
        subject_type.find(params[:subject_id])
      end

      def serialize_instance(instance)
        # Count pending tasks for this instance
        pending_tasks = BpmnTaskInstance.joins(:bpmn_token)
          .where(bpmn_tokens: { bpmn_process_instance_id: instance.id })
          .actionable
          .count

        # Get current node names
        current_nodes = instance.current_nodes.map(&:display_name)

        {
          id: instance.id,
          process_id: instance.bpmn_process_id,
          process_name: instance.bpmn_process.name,
          subject_type: instance.subject_type,
          subject_id: instance.subject_id,
          subject_name: instance.subject_display_name,
          status: instance.status,
          progress: instance.progress_percentage,
          started_at: instance.started_at,
          completed_at: instance.completed_at,
          active_tokens: instance.active_tokens.count,
          waiting_tokens: instance.waiting_tokens.count,
          pending_tasks: pending_tasks,
          current_node: current_nodes.first,
          current_nodes: current_nodes,
          error_message: instance.error_message,
          created_at: instance.created_at
        }
      end

      def serialize_instance_full(instance)
        serialize_instance(instance).merge(
          variables: instance.variables,
          tokens: instance.bpmn_tokens.includes(:current_node).map { |t| serialize_token(t) },
          tasks: BpmnTaskInstance.joins(:bpmn_token)
                   .where(bpmn_tokens: { bpmn_process_instance_id: instance.id })
                   .includes(:bpmn_node, :assigned_to)
                   .order(created_at: :desc)
                   .map { |t| serialize_task(t) },
          current_nodes: instance.current_nodes.map(&:display_name)
        )
      end

      def serialize_token(token)
        {
          id: token.id,
          node_id: token.current_node_id,
          node_key: token.current_node.node_key,
          node_name: token.current_node.display_name,
          node_type: token.current_node.node_type,
          status: token.status,
          parent_token_id: token.parent_token_id,
          arrived_at: token.arrived_at,
          completed_at: token.completed_at
        }
      end

      def serialize_task(task)
        {
          id: task.id,
          node_id: task.bpmn_node_id,
          node_name: task.bpmn_node.display_name,
          task_type: task.task_type,
          status: task.status,
          assigned_to_type: task.assigned_to_type,
          assigned_to_id: task.assigned_to_id,
          assigned_to_name: task.assignee_name,
          due_date: task.due_date,
          is_overdue: task.overdue?,
          started_at: task.started_at,
          completed_at: task.completed_at,
          error_message: task.error_message,
          created_at: task.created_at
        }
      end
    end
  end
end
