# frozen_string_literal: true

module Api
  module V1
    class AgentsController < ApplicationController
      # GET /api/v1/agents
      # Returns all agent definitions with shortcuts and display info
      def index
        agents = AgentDefinition.where(active: true).order(priority: :desc, name: :asc)
        
        render json: agents.map { |agent|
          {
            agent_id: agent.agent_id,
            name: agent.name,
            agent_type: agent.agent_type,
            focus: agent.focus,
            shortcuts: parse_shortcuts(agent.example_invocations),
            icon: get_agent_icon(agent.agent_id),
            description: agent.purpose || agent.focus,
            priority: agent.priority,
            last_run_at: agent.last_run_at,
            last_status: agent.last_status,
            total_runs: agent.total_runs || 0,
            success_rate: calculate_success_rate(agent)
          }
        }
      end
      
      # GET /api/v1/agents/shortcuts
      # Returns formatted shortcuts for AgentShortcutsTab
      def shortcuts
        agents = AgentDefinition.where(active: true).order(priority: :desc)
        
        shortcuts = agents.map.with_index do |agent, index|
          {
            id: index + 1,
            command: "Run #{agent.name}",
            shortcut: agent.example_invocations
          }
        end
        
        render json: shortcuts
      end
      
      private
      
      def parse_shortcuts(invocations)
        return [] unless invocations
        invocations.split('|').map(&:strip)
      end
      
      def get_agent_icon(agent_id)
        icons = {
          'backend-developer' => '🔧',
          'frontend-developer' => '🎨',
          'production-bug-hunter' => '🐛',
          'gantt-bug-hunter' => '📊',
          'deploy-manager' => '🚀',
          'planning-collaborator' => '📋',
          'trinity-sync-validator' => '✅',
          'ui-compliance-auditor' => '🎨'
        }
        icons[agent_id] || '🤖'
      end
      
      def calculate_success_rate(agent)
        return 0 if agent.total_runs.zero?
        ((agent.successful_runs.to_f / agent.total_runs) * 100).round(1)
      end
    end
  end
end
