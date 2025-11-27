# frozen_string_literal: true

module Api
  module V1
    class SmDependenciesController < ApplicationController
      before_action :set_sm_task, only: [:index, :create]
      before_action :set_dependency, only: [:show, :update, :destroy, :restore]

      # GET /api/v1/sm_tasks/:sm_task_id/dependencies
      def index
        @dependencies = SmDependency.active.for_task(@task.id).includes(
          :predecessor_task, :successor_task
        )

        render json: {
          success: true,
          dependencies: @dependencies.map { |dep| dependency_to_json(dep) },
          meta: {
            task_id: @task.id,
            predecessor_count: @task.active_predecessor_dependencies.count,
            successor_count: @task.active_successor_dependencies.count
          }
        }
      end

      # GET /api/v1/sm_dependencies/:id
      def show
        render json: {
          success: true,
          dependency: dependency_to_json(@dependency)
        }
      end

      # POST /api/v1/sm_tasks/:sm_task_id/dependencies
      def create
        @dependency = SmDependency.new(dependency_params)
        @dependency.successor_task = @task
        @dependency.created_by = current_user

        if @dependency.save
          render json: {
            success: true,
            message: 'Dependency created successfully',
            dependency: dependency_to_json(@dependency)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @dependency.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/sm_dependencies/:id
      def update
        if @dependency.update(dependency_params)
          render json: {
            success: true,
            dependency: dependency_to_json(@dependency)
          }
        else
          render json: {
            success: false,
            errors: @dependency.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_dependencies/:id
      def destroy
        reason = params[:reason] || 'user_manual'

        @dependency.soft_delete!(reason: reason, user: current_user)

        render json: {
          success: true,
          message: 'Dependency removed successfully'
        }
      end

      # POST /api/v1/sm_dependencies/:id/restore
      def restore
        unless @dependency.deleted_at.present?
          return render json: {
            success: false,
            error: 'Dependency is not deleted'
          }, status: :unprocessable_entity
        end

        @dependency.restore!

        render json: {
          success: true,
          message: 'Dependency restored successfully',
          dependency: dependency_to_json(@dependency)
        }
      end

      private

      def set_sm_task
        @task = SmTask.find(params[:sm_task_id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: 'Task not found'
        }, status: :not_found
      end

      def set_dependency
        @dependency = SmDependency.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: 'Dependency not found'
        }, status: :not_found
      end

      def dependency_params
        params.require(:dependency).permit(
          :predecessor_task_id,
          :dependency_type,
          :lag_days
        )
      end

      def dependency_to_json(dep)
        {
          id: dep.id,
          predecessor_task_id: dep.predecessor_task_id,
          successor_task_id: dep.successor_task_id,
          predecessor_task: {
            id: dep.predecessor_task.id,
            task_number: dep.predecessor_task.task_number,
            name: dep.predecessor_task.name,
            status: dep.predecessor_task.status
          },
          successor_task: {
            id: dep.successor_task.id,
            task_number: dep.successor_task.task_number,
            name: dep.successor_task.name,
            status: dep.successor_task.status
          },
          dependency_type: dep.dependency_type,
          dependency_type_name: dep.type_name,
          lag_days: dep.lag_days,
          display: dep.type_display,
          active: dep.active,
          deleted_at: dep.deleted_at,
          deleted_reason: dep.deleted_reason,
          created_at: dep.created_at,
          updated_at: dep.updated_at
        }
      end
    end
  end
end
