module Api
  module V1
    class BpmnProcessesController < ApplicationController
      before_action :set_process, only: [ :show, :update, :destroy, :publish, :unpublish, :duplicate, :validate, :test_run ]

      def index
        @processes = BpmnProcess.includes(:bpmn_nodes, :bpmn_edges, :bpmn_triggers)
                                .order(updated_at: :desc)

        # Optional filtering
        @processes = @processes.published if params[:published] == "true"
        @processes = @processes.draft if params[:published] == "false"

        render json: {
          success: true,
          bpmn_processes: @processes.map { |p| serialize_process_summary(p) }
        }
      end

      def show
        render json: {
          success: true,
          bpmn_process: serialize_process_full(@process)
        }
      end

      def create
        @process = BpmnProcess.new(process_params)

        ActiveRecord::Base.transaction do
          @process.save!
          create_nodes_and_edges if params[:nodes].present?
        end

        render json: { success: true, bpmn_process: serialize_process_full(@process) }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        ActiveRecord::Base.transaction do
          @process.update!(process_params)
          sync_nodes_and_edges if params[:nodes].present? || params[:edges].present?
        end

        render json: { success: true, bpmn_process: serialize_process_full(@process.reload) }
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        if @process.has_active_instances?
          render json: { success: false, error: "Cannot delete process with active instances" }, status: :unprocessable_entity
        else
          @process.destroy!
          render json: { success: true }
        end
      end

      def publish
        validation_errors = @process.validate_structure
        if validation_errors.any?
          render json: { success: false, errors: validation_errors }, status: :unprocessable_entity
        else
          @process.publish!
          render json: { success: true, bpmn_process: serialize_process_full(@process) }
        end
      end

      def unpublish
        @process.unpublish!
        render json: { success: true, bpmn_process: serialize_process_full(@process) }
      end

      def duplicate
        new_name = params[:name] || "#{@process.name} (Copy)"
        new_process = @process.duplicate(new_name: new_name)
        render json: { success: true, bpmn_process: serialize_process_full(new_process) }, status: :created
      end

      def validate
        errors = @process.validate_structure
        render json: {
          success: errors.empty?,
          valid: errors.empty?,
          errors: errors
        }
      end

      # POST /api/v1/bpmn_processes/:id/test_run
      # Create a test instance of the workflow for a specific job
      def test_run
        job = Job.find_by(id: params[:job_id])

        unless job
          render json: { success: false, error: "Job not found" }, status: :not_found
          return
        end

        # Sync nodes from XML if needed
        if @process.bpmn_nodes.empty? && @process.bpmn_xml.present?
          Rails.logger.info("Test run: Syncing nodes from BPMN XML for process ##{@process.id}")
          @process.sync_nodes_from_xml!
        end

        # Check that the process has a start node
        unless @process.start_node
          render json: { success: false, error: "Workflow must have a Start Event. Please add one and save." }, status: :unprocessable_entity
          return
        end

        # Check valid structure
        validation_errors = @process.validate_structure
        if validation_errors.any?
          render json: { success: false, error: "Workflow issues: #{validation_errors.join(', ')}" }, status: :unprocessable_entity
          return
        end

        begin
          # Start the process instance using the engine (bypasses publish requirement for test)
          instance = ActiveRecord::Base.transaction do
            inst = BpmnProcessInstance.create!(
              bpmn_process: @process,
              subject: job,
              status: "active",
              started_at: Time.current,
              variables: {
                job_id: job.id,
                test_run: true,
                "_triggered_by" => "test_run",
                "_started_at" => Time.current.iso8601,
                "_subject_type" => "Job",
                "_subject_id" => job.id
              }
            )

            # Create initial token at start event
            token = inst.bpmn_tokens.create!(
              current_node: @process.start_node,
              status: "active",
              arrived_at: Time.current
            )

            # Advance token past start event
            Bpmn::EngineService.advance_token(token)

            inst
          end

          render json: {
            success: true,
            instance_id: instance.id,
            status: instance.reload.status,
            message: "Test run started",
            job: {
              id: job.id,
              name: job.name,
              job_number: job.try(:job_number)
            }
          }
        rescue StandardError => e
          Rails.logger.error("Test run failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
          render json: { success: false, error: "Test run failed: #{e.message}" }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/bpmn_processes/import
      # Import a Compoza BPMN XML file
      def import
        unless params[:file].present? || params[:xml_content].present?
          render json: { success: false, error: "No BPMN file or content provided" }, status: :bad_request
          return
        end

        xml_content = if params[:file].present?
                        params[:file].read
        else
                        params[:xml_content]
        end

        importer = CompozaBpmnImporter.new(
          xml_content,
          name: params[:name],
          user: current_user
        )

        if params[:preview] == "true"
          preview = importer.preview
          render json: { success: true, preview: preview }
        else
          process = importer.import!
          render json: {
            success: true,
            bpmn_process: serialize_process_full(process),
            message: "Workflow imported successfully"
          }, status: :created
        end
      rescue CompozaBpmnImporter::ImportError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      rescue StandardError => e
        Rails.logger.error("BPMN Import failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
        render json: { success: false, error: "Import failed: #{e.message}" }, status: :unprocessable_entity
      end

      private

      def set_process
        @process = BpmnProcess.find(params[:id])
      end

      def process_params
        params.require(:bpmn_process).permit(
          :name, :description, :workflow_definition_id,
          :bpmn_xml, :svg_preview,
          canvas_data: {}
        )
      end

      def create_nodes_and_edges
        node_map = {}

        # Create nodes first
        params[:nodes].each do |node_params|
          node = @process.bpmn_nodes.create!(
            node_key: node_params[:node_key] || node_params[:id],
            node_type: node_params[:node_type] || node_params[:type],
            name: node_params[:name],
            description: node_params[:description],
            position_x: node_params.dig(:position, :x) || node_params[:position_x] || 0,
            position_y: node_params.dig(:position, :y) || node_params[:position_y] || 0,
            config: node_params[:config] || {}
          )
          node_map[node_params[:node_key] || node_params[:id]] = node.id
        end

        # Then create edges
        params[:edges]&.each do |edge_params|
          source_key = edge_params[:source_key] || edge_params[:source]
          target_key = edge_params[:target_key] || edge_params[:target]

          @process.bpmn_edges.create!(
            edge_key: edge_params[:edge_key] || edge_params[:id],
            source_node_id: node_map[source_key],
            target_node_id: node_map[target_key],
            name: edge_params[:name],
            condition_expression: edge_params[:condition_expression],
            is_default: edge_params[:is_default] || false,
            style: edge_params[:style] || {}
          )
        end
      end

      def sync_nodes_and_edges
        # Full sync - delete and recreate
        @process.bpmn_edges.destroy_all
        @process.bpmn_nodes.destroy_all
        create_nodes_and_edges
      end

      def serialize_process_summary(process)
        {
          id: process.id,
          name: process.name,
          description: process.description,
          is_published: process.is_published,
          published_at: process.published_at,
          node_count: process.bpmn_nodes.size,
          instance_count: process.bpmn_process_instances.count,
          active_instance_count: process.active_instances.count,
          trigger_count: process.bpmn_triggers.size,
          created_at: process.created_at,
          updated_at: process.updated_at
        }
      end

      def serialize_process_full(process)
        {
          id: process.id,
          name: process.name,
          description: process.description,
          is_published: process.is_published,
          published_at: process.published_at,
          version: process.version,
          canvas_data: process.canvas_data,
          bpmn_xml: process.bpmn_xml,
          svg_preview: process.svg_preview,
          nodes: process.bpmn_nodes.map { |n| serialize_node(n) },
          edges: process.bpmn_edges.map { |e| serialize_edge(e) },
          triggers: process.bpmn_triggers.map { |t| serialize_trigger(t) },
          created_at: process.created_at,
          updated_at: process.updated_at
        }
      end

      def serialize_node(node)
        {
          id: node.id,
          node_key: node.node_key,
          node_type: node.node_type,
          name: node.name,
          description: node.description,
          position: { x: node.position_x, y: node.position_y },
          config: node.config,
          icon: node.icon_name,
          color: node.color
        }
      end

      def serialize_edge(edge)
        {
          id: edge.id,
          edge_key: edge.edge_key,
          source_key: edge.source_node.node_key,
          source_node_id: edge.source_node_id,
          target_key: edge.target_node.node_key,
          target_node_id: edge.target_node_id,
          name: edge.name,
          condition_expression: edge.condition_expression,
          is_default: edge.is_default,
          style: edge.style
        }
      end

      def serialize_trigger(trigger)
        {
          id: trigger.id,
          trigger_type: trigger.trigger_type,
          name: trigger.name,
          is_active: trigger.is_active,
          config: trigger.config,
          description: trigger.description
        }
      end
    end
  end
end
