module Bpmn
  class EngineService
    class << self
      # Start a new process instance
      def start_process(process_id:, subject:, variables: {}, triggered_by: nil)
        process = BpmnProcess.published.find(process_id)
        start_node = process.start_node

        raise ProcessError, "No start event found in process" unless start_node
        raise ProcessError, "Process has invalid structure" unless process.valid_structure?

        ActiveRecord::Base.transaction do
          instance = BpmnProcessInstance.create!(
            bpmn_process: process,
            subject: subject,
            status: "active",
            started_at: Time.current,
            variables: variables.merge(
              "_triggered_by" => triggered_by,
              "_started_at" => Time.current.iso8601,
              "_subject_type" => subject.class.name,
              "_subject_id" => subject.id
            )
          )

          # Create initial token at start event
          token = instance.bpmn_tokens.create!(
            current_node: start_node,
            status: "active",
            arrived_at: Time.current
          )

          # Immediately advance past start event
          advance_token(token)

          instance
        end
      end

      # Advance a token to next node(s)
      def advance_token(token)
        return if token.status != "active"

        node = token.current_node
        instance = token.bpmn_process_instance

        Rails.logger.info("BPMN: Advancing token ##{token.id} at node '#{node.display_name}' (#{node.node_type})")

        case node.node_type
        when "start_event"
          advance_from_simple_node(token)
        when "end_event"
          handle_end_event(token)
        when "user_task"
          create_user_task(token)
        when "service_task"
          execute_service_task(token)
        when "exclusive_gateway"
          handle_exclusive_gateway(token)
        when "parallel_gateway"
          handle_parallel_gateway(token)
        when "timer_event"
          handle_timer_event(token)
        else
          Rails.logger.warn("BPMN: Unknown node type: #{node.node_type}")
          advance_from_simple_node(token)
        end
      rescue StandardError => e
        Rails.logger.error("BPMN: Error advancing token ##{token.id}: #{e.message}")
        instance.fail!(e.message)
        raise
      end

      private

      def advance_from_simple_node(token)
        outgoing = token.current_node.outgoing_edges.first
        return complete_token(token) unless outgoing

        move_token_to_node(token, outgoing.target_node)
      end

      def handle_end_event(token)
        complete_token(token)
        check_process_completion(token.bpmn_process_instance)
      end

      def create_user_task(token)
        # Check if task already exists and is completed
        existing_task = BpmnTaskInstance.find_by(bpmn_token: token, bpmn_node: token.current_node)

        if existing_task&.completed?
          # Task is done, advance to next node
          Rails.logger.info("BPMN: User task already completed, advancing token ##{token.id}")
          advance_from_simple_node(token)
          return
        end

        if existing_task
          # Task exists but not completed, just wait
          token.wait!
          Rails.logger.info("BPMN: User task exists but pending, token ##{token.id} waiting")
          return
        end

        # Create new task
        config = token.current_node.config || {}
        role_value = config["assignee_type"] == "role" ? config["assignee_value"] : nil

        BpmnTaskInstance.create!(
          bpmn_token: token,
          bpmn_node: token.current_node,
          task_type: "user_task",
          status: "pending",
          assigned_to: resolve_assignee(config, token.bpmn_process_instance),
          assigned_to_role: role_value,
          due_date: calculate_due_date(config)
        )

        token.wait!
        Rails.logger.info("BPMN: User task created, token ##{token.id} waiting")
      end

      def execute_service_task(token)
        # Check if task already exists and is completed
        existing_task = BpmnTaskInstance.find_by(bpmn_token: token, bpmn_node: token.current_node)

        if existing_task&.completed?
          # Task is done, advance to next node
          Rails.logger.info("BPMN: Service task already completed, advancing token ##{token.id}")
          advance_from_simple_node(token)
          return
        end

        if existing_task&.in_progress?
          # Task is still running, just wait
          token.wait!
          Rails.logger.info("BPMN: Service task in progress, token ##{token.id} waiting")
          return
        end

        # Execute the service task
        token.wait!
        BpmnServiceTaskJob.perform_later(token.id)
      end

      def handle_exclusive_gateway(token)
        instance = token.bpmn_process_instance
        edges = token.current_node.outgoing_edges.to_a
        default_edge = edges.find(&:is_default)

        # Evaluate conditions to find the first matching edge
        selected_edge = edges.reject(&:is_default).find do |edge|
          edge.condition_met?(instance.variables)
        end

        selected_edge ||= default_edge

        if selected_edge
          Rails.logger.info("BPMN: Exclusive gateway selecting edge '#{selected_edge.display_name}' to '#{selected_edge.target_node.display_name}'")
          move_token_to_node(token, selected_edge.target_node)
        else
          complete_token(token)
          instance.fail!("No valid path from exclusive gateway '#{token.current_node.display_name}'")
        end
      end

      def handle_parallel_gateway(token)
        instance = token.bpmn_process_instance
        node = token.current_node
        incoming = node.incoming_edges.to_a
        outgoing = node.outgoing_edges.to_a

        Rails.logger.info("BPMN: Parallel gateway - #{incoming.count} incoming, #{outgoing.count} outgoing")

        if incoming.count > 1 && outgoing.count == 1
          # Joining gateway - wait for all tokens
          handle_parallel_join(token, node, instance)
        elsif incoming.count == 1 && outgoing.count > 1
          # Splitting gateway - create parallel tokens
          handle_parallel_split(token, node, instance)
        elsif incoming.count > 1 && outgoing.count > 1
          # Mixed gateway - join first, then split
          if all_incoming_tokens_arrived?(node, instance)
            merge_incoming_tokens(node, instance)
            handle_parallel_split(token, node, instance)
          else
            token.wait!
          end
        else
          # Single in, single out - just pass through
          advance_from_simple_node(token)
        end
      end

      def handle_parallel_split(token, node, instance)
        Rails.logger.info("BPMN: Parallel split - creating #{node.outgoing_edges.count} child tokens")

        node.outgoing_edges.each do |edge|
          new_token = instance.bpmn_tokens.create!(
            current_node: edge.target_node,
            parent_token: token,
            status: "active",
            arrived_at: Time.current
          )
          Rails.logger.info("BPMN: Created child token ##{new_token.id} at '#{edge.target_node.display_name}'")
          advance_token(new_token)
        end

        token.complete!
      end

      def handle_parallel_join(token, node, instance)
        # Count tokens at this gateway (waiting + the current one)
        waiting_count = instance.bpmn_tokens
          .where(current_node: node, status: "waiting")
          .count

        incoming_count = node.incoming_edges.count
        total_arrived = waiting_count + 1

        Rails.logger.info("BPMN: Parallel join - #{total_arrived}/#{incoming_count} tokens arrived")

        if total_arrived >= incoming_count
          # All tokens arrived - merge and continue
          merge_incoming_tokens(node, instance)
          advance_from_simple_node(token)
        else
          # Wait for more tokens
          token.wait!
        end
      end

      def all_incoming_tokens_arrived?(node, instance)
        incoming_count = node.incoming_edges.count
        waiting_count = instance.bpmn_tokens
          .where(current_node: node)
          .where(status: %w[waiting active])
          .count

        waiting_count >= incoming_count
      end

      def merge_incoming_tokens(node, instance)
        instance.bpmn_tokens
          .where(current_node: node, status: "waiting")
          .update_all(status: "merged", completed_at: Time.current)
      end

      def handle_timer_event(token)
        config = token.current_node.config || {}
        duration = parse_iso8601_duration(config["duration"])

        token.wait!
        BpmnTimerJob.set(wait: duration).perform_later(token.id)
        Rails.logger.info("BPMN: Timer event scheduled for #{duration.inspect}")
      end

      def move_token_to_node(token, node)
        token.move_to!(node)
        advance_token(token)
      end

      def complete_token(token)
        token.complete!
        Rails.logger.info("BPMN: Token ##{token.id} completed")
      end

      def check_process_completion(instance)
        return if instance.bpmn_tokens.active.exists?
        return if instance.bpmn_tokens.waiting.exists?

        instance.complete!
        Rails.logger.info("BPMN: Process instance ##{instance.id} completed")
      end

      def resolve_assignee(config, instance)
        case config["assignee_type"]
        when "user"
          User.find_by(id: config["assignee_value"])
        when "role"
          nil # Will be picked up by users with matching role
        when "variable"
          var_value = instance.variables[config["assignee_value"]]
          User.find_by(id: var_value)
        when "subject_field"
          field = config["assignee_value"]
          instance.subject.try(field)
        else
          nil
        end
      end

      def calculate_due_date(config)
        return nil unless config["due_days"]

        config["due_days"].to_i.days.from_now
      end

      def parse_iso8601_duration(duration_string)
        return 1.hour if duration_string.blank?

        # Parse ISO 8601 duration (e.g., "P1D", "PT2H", "P1W")
        ActiveSupport::Duration.parse(duration_string)
      rescue StandardError
        1.hour # Default fallback
      end
    end

    class ProcessError < StandardError; end
  end
end
