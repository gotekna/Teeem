# frozen_string_literal: true

module Api
  module V1
    class AgentDefinitionsController < ApplicationController
      skip_before_action :authorize_request, only: [:index, :show, :record_run]

      # GET /api/v1/agent_definitions
      # Returns list of all agents
      def index
        agents = AgentDefinition.active.by_priority.includes(:created_by, :updated_by, :last_run_by)

        render json: {
          success: true,
          data: agents.as_json(
            methods: [:status_emoji, :success_rate],
            include: {
              created_by: { only: [:id, :name, :email] },
              updated_by: { only: [:id, :name, :email] },
              last_run_by: { only: [:id, :name, :email] }
            }
          )
        }
      end

      # GET /api/v1/agent_definitions/:id
      # Returns single agent with full details
      def show
        agent = AgentDefinition.includes(:created_by, :updated_by, :last_run_by).find_by!(agent_id: params[:id])

        render json: {
          success: true,
          data: agent.as_json(
            methods: [:status_emoji, :success_rate],
            include: {
              created_by: { only: [:id, :name, :email] },
              updated_by: { only: [:id, :name, :email] },
              last_run_by: { only: [:id, :name, :email] }
            }
          )
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Agent not found' }, status: :not_found
      end

      # POST /api/v1/agent_definitions/:id/record_run
      # Records a run result
      # Accepts user_email param for CLI runs (looks up user by email)
      def record_run
        agent = AgentDefinition.find_by!(agent_id: params[:id])
        status = params[:status] # 'success' or 'failure'
        message = params[:message]
        details = params[:details] || {}

        # Determine the user who ran the agent
        # Priority: 1) authenticated user, 2) user_email param, 3) nil
        run_user = current_user
        if run_user.nil? && params[:user_email].present?
          run_user = User.find_by(email: params[:user_email])
        end

        if status == 'success'
          agent.record_success(message, details, user: run_user)
        else
          agent.record_failure(message, details, user: run_user)
        end

        render json: {
          success: true,
          data: agent.as_json(
            include: {
              last_run_by: { only: [:id, :name, :email] }
            }
          )
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Agent not found' }, status: :not_found
      end

      # POST /api/v1/agent_definitions (admin only)
      # Creates a new agent
      def create
        agent = AgentDefinition.new(agent_params)

        if agent.save
          render json: { success: true, data: agent }, status: :created
        else
          render json: { success: false, errors: agent.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/agent_definitions/:id (admin only)
      # Updates an agent
      def update
        agent = AgentDefinition.find_by!(agent_id: params[:id])

        if agent.update(agent_params)
          render json: { success: true, data: agent }
        else
          render json: { success: false, errors: agent.errors.full_messages }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Agent not found' }, status: :not_found
      end

      # DELETE /api/v1/agent_definitions/:id (admin only)
      # Deactivates an agent
      def destroy
        agent = AgentDefinition.find_by!(agent_id: params[:id])
        agent.update!(active: false)

        render json: { success: true, message: 'Agent deactivated' }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Agent not found' }, status: :not_found
      end

      private

      def agent_params
        params.require(:agent_definition).permit(
          :agent_id, :name, :agent_type, :focus, :model,
          :purpose, :capabilities, :when_to_use, :tools_available,
          :success_criteria, :example_invocations, :important_notes,
          :active, :priority, metadata: {}
        )
      end
    end
  end
end
